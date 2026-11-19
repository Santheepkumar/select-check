# SelectCheck — Cross-Platform Floating Grammar & Rewrite Assistant

**SelectCheck** is a lightweight cross-platform desktop application (**Windows, macOS, and Linux**) built with **Tauri v2 (Rust + React/TypeScript/Tailwind CSS)** paired with a **Cloudflare Workers (Hono)** serverless edge backend.

When you select text in any application on your computer, a floating ball appears near your cursor. Clicking the ball sends the selected text to OpenAI (`gpt-4o-mini` with Structured Outputs) and presents the **Top 3 Improvement Suggestions**:
1. **Grammar Fix (`1`)** — Fixes only grammar, spelling, and punctuation with minimal changes.
2. **Clear & Concise (`2`)** — Crisp, natural rewrite that improves readability.
3. **Professional & Polished (`3`)** — Elevated, workplace-ready rewrite.

Clicking any suggestion (or pressing `1`, `2`, or `3`) **automatically replaces the selected text in-place** in the active application while preserving your clipboard.

---

## 📚 Complete Knowledge Base (`docs/`)

To understand the application inch by inch, browse the [`docs/`](./docs/README.md) directory:

- **[Knowledge Base Index & Glossary](./docs/README.md)**
- **[01. Architecture Overview & Diagrams](./docs/01-architecture-overview.md)**
- **[02. Desktop Native Core (Tauri v2 & Rust)](./docs/02-desktop-rust-core.md)**
- **[03. Desktop Frontend UI, LCS Word-Diff Engine & Simulator](./docs/03-desktop-frontend-ui.md)**
- **[04. Serverless Edge API, Quotas & OpenAI Integration](./docs/04-backend-edge-api.md)**
- **[05. Local Setup, Testing & Deployment Guide](./docs/05-local-setup-and-deployment.md)**
- **Architecture Decision Records (`docs/decisions/`)**:
  - [ADR-001: Tauri v2 (Rust) over Electron](./docs/decisions/ADR-001-tauri-v2-over-electron.md)
  - [ADR-002: Cloudflare Workers (Hono) Edge Proxy](./docs/decisions/ADR-002-cloudflare-workers-hono-edge-proxy.md)
  - [ADR-003: Non-Destructive Clipboard Selection & Replacement](./docs/decisions/ADR-003-non-destructive-clipboard-selection-and-replacement.md)
  - [ADR-004: OpenAI Structured Outputs & Local Fallback](./docs/decisions/ADR-004-openai-structured-outputs-and-local-fallback.md)

---

## 🚀 Quick Start

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Environment Variables (direnv configured)
# Simply edit .env with your keys (or copy from .env.example)
# direnv automatically loads .env whenever you enter the folder:
direnv allow

# 3. Start the Serverless Edge API on http://localhost:8787
pnpm dev:api

# 4. Start the Desktop UI / Interactive OS Simulator on http://localhost:5173
pnpm dev:desktop

# 5. Run the Native Tauri v2 Desktop App (requires Rust/Cargo)
pnpm tauri:dev
```

---

## 🛠️ Commands

| Command | Description |
| :--- | :--- |
| `pnpm dev:api` | Start the local Hono edge backend server on `http://localhost:8787` |
| `pnpm dev:desktop` | Start the Vite desktop frontend & multi-app simulator on `http://localhost:5173` |
| `pnpm tauri:dev` | Build and run the native Tauri v2 desktop overlay & system tray app |
| `pnpm tauri:build` | Package native OS installers (`.dmg`, `.msi`, `.deb`, `.AppImage`) |
| `pnpm test` | Run all Vitest unit and integration tests across the monorepo |
| `pnpm build` | Run strict TypeScript typechecking and production Vite builds |
