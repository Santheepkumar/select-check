# 05. Local Setup, Testing & Deployment Guide

This guide walks you step by step through setting up **SelectCheck** on **macOS, Windows, or Linux**, running the serverless API and desktop app locally, executing the automated test suite, and building production deliverables.

---

## 1. Prerequisites

### Required for All Development Modes
- **Node.js**: `>= 20.0.0` (verified on `v24.x`)
- **pnpm**: `>= 9.0.0` (verified on `v10.x`)

### Required Only for Native Tauri v2 Desktop Builds (`pnpm tauri:dev` / `pnpm tauri:build`)
- **Rust & Cargo**: Install via [rustup.rs](https://rustup.rs/):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Platform-Specific OS Dependencies**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: Microsoft Visual Studio C++ Build Tools + WebView2 Runtime (pre-installed on Windows 10/11)
  - **Linux (Ubuntu/Debian)**:
    ```bash
    sudo apt update
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libxi-dev libxtst-dev
    ```

---

## 2. Step-by-Step Local Setup

### Step 1: Install Workspace Dependencies
From the repository root (`/Users/santheep/Desktop/personal/sst/select-check`):

```bash
pnpm install
```

---

### Step 2: Start the Serverless Backend (`https://select-check-api.santheepkumar.workers.dev`)

Open Terminal 1 and start the local Hono edge server:

```bash
pnpm dev:api
```

- **Without an OpenAI API Key (Zero-Config Mode)**:
  Works immediately out of the box using the built-in heuristic grammar & rewrite engine (`buildLocalHeuristicSuggestions`).
- **With a Live OpenAI API Key**:
  Pass your `OPENAI_API_KEY` environment variable before starting `pnpm dev:api`:
  ```bash
  export OPENAI_API_KEY="sk-your-openai-api-key"
  export OPENAI_MODEL="gpt-4o-mini"   # optional, defaults to gpt-4o-mini
  pnpm dev:api
  ```

Verify the API is healthy:
```bash
curl https://select-check-api.santheepkumar.workers.dev/health
# {"status":"ok","service":"select-check-api","timestamp":"..."}
```

---

### Step 3: Run the Desktop App

You can run the desktop frontend in two modes:

#### Mode A: Interactive Browser Workspace / Simulator (No Rust Required)
Open Terminal 2 and run:

```bash
pnpm dev:desktop
```

Open **`http://localhost:5173`** in your browser:
1. Choose an active simulated OS window (**Slack**, **Apple Mail / Outlook**, or **Terminal**).
2. Highlight any text in the editor (or click **"Select Sample Sentence"**).
3. The **Floating Ball** appears next to your cursor.
4. Click the **Floating Ball** to fetch the **Top 3 Suggestions** (`Grammar Fix`, `Clear & Concise`, `Professional & Polished`) from `https://select-check-api.santheepkumar.workers.dev/v1/check`.
5. Toggle **Diff** to inspect word-level additions/deletions, click **Copy** to copy only, or click a card (or press `1`, `2`, `3`) to **replace the selected text in-place**.
6. Click **Settings & Quota** in the top bar to test passwordless Email OTP sign-in (use code `123456` in dev mode to upgrade from `10/day` to `100/day`) or edit the **Blocked Applications** list.

You can also inspect the standalone native window routes directly in your browser:
- Overlay Window: `http://localhost:5173/?window=overlay`
- Settings Window: `http://localhost:5173/?window=settings`

#### Mode B: Native Tauri v2 OS Overlay & System Tray App
Once Rust/Cargo is installed on your machine, run:

```bash
pnpm tauri:dev
```

This compiles `apps/desktop/src-tauri`, creates the native OS System Tray icon, starts the background global mouse listener (`rdev`), and displays the transparent non-activating `overlay` window whenever you select text across any unblocked desktop application.

> **macOS First-Run Note**: When prompted by macOS, grant Accessibility permission to your terminal / `SelectCheck` binary in `System Settings → Privacy & Security → Accessibility` so `rdev` and `enigo` can detect selections and synthesize `Cmd+C`/`Cmd+V`.

---

## 3. Running Automated Tests & Typechecks

Run all unit and integration tests across the monorepo from the root directory:

```bash
pnpm test
```

What this runs:
1. **`@select-check/shared`**: Validates shared TypeScript types.
2. **`@select-check/api` (`apps/api/test/api.test.ts`)**:
   - Verifies `GET /health` (`200 OK`).
   - Verifies `POST /v1/check` input validation (`400` on `<2` chars).
   - Verifies `POST /v1/check` returns all 3 suggestion styles (`grammar_fix`, `clear_concise`, `professional_polished`) and increments daily quota.
   - Verifies `429 Too Many Requests` rate limiting on the 11th daily check for anonymous devices.
   - Verifies `POST /v1/auth/otp` and `POST /v1/auth/verify` issue a valid Bearer JWT that unlocks the `100/day` authenticated quota tier.
3. **`@select-check/desktop` (`apps/desktop/test/diff.test.ts`)**:
   - Verifies `computeWordDiff` identical-string fast path and word-level `<del>` / `<ins>` diff segments.

If Rust is installed, you can also run the native Rust unit tests (testing `is_app_blocked` and `clamp_to_screen`):

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Run a full production typecheck and Vite bundle build across all packages:

```bash
pnpm build
```

---

## 4. Production Deployment Guide

### 4.1 Deploying the Cloudflare Worker Backend (`apps/api`)

1. Authenticate with Cloudflare and create the KV namespace and D1 database:
   ```bash
   cd apps/api
   npx wrangler login
   npx wrangler kv namespace create QUOTA_KV
   npx wrangler d1 create select-check-db
   ```
2. Update `apps/api/wrangler.toml` with the returned `id` values for `QUOTA_KV` and `DB`, then initialize the D1 schema:
   ```bash
   npx wrangler d1 execute select-check-db --remote --file=./schema.sql
   ```
3. Configure production secrets:
   ```bash
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put JWT_SECRET
   # Optional if using Supabase Auth for production email delivery:
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   ```
4. Deploy to the Cloudflare global edge:
   ```bash
   pnpm --filter @select-check/api deploy
   ```
   Live Production API: `https://select-check-api.santheepkumar.workers.dev`

> For an in-depth, reusable guide on deploying Cloudflare Workers with KV, D1, CI/CD, and troubleshooting real-world issues, see the **[Universal Cloudflare Deployment Playbook](./CLOUDFLARE_DEPLOYMENT_GUIDE.md)**.

### 4.2 Building Cross-Platform Desktop Installers (`apps/desktop`)

To package native desktop installers (`.dmg`/`.app` on macOS, `.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux):

```bash
pnpm tauri:build
```

Compiled installers are output to `apps/desktop/src-tauri/target/release/bundle/`.
