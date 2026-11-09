# 01. Architecture Overview

This document explains how **SelectCheck** is structured across the monorepo, how its components interact at runtime, and how data flows from an OS mouse gesture to an OpenAI grammar check and back into the active application.

---

## 1. Monorepo Structure

SelectCheck uses **pnpm workspaces** (`pnpm-workspace.yaml`) to share strict TypeScript contracts between the desktop client and the serverless edge backend:

```text
select-check/
├── package.json                 # Root scripts (dev:api, dev:desktop, tauri:dev, test, build)
├── pnpm-workspace.yaml          # Workspace definition (packages/*, apps/*)
├── tsconfig.base.json           # Shared strict TypeScript configuration (ES2022, bundler)
├── docs/                        # Complete technical knowledge base & ADRs
├── packages/
│   └── shared/                  # @select-check/shared — Shared types, API contracts, constants
│       └── src/index.ts
└── apps/
    ├── api/                     # @select-check/api — Cloudflare Workers + Hono edge backend
    │   ├── wrangler.toml        # Cloudflare KV, D1, and environment bindings
    │   ├── schema.sql           # D1 SQLite schema (users, usage_logs)
    │   ├── src/
    │   │   ├── index.ts         # Hono app router & CORS middleware
    │   │   ├── dev-server.ts    # Local Node HTTP server wrapper (@hono/node-server)
    │   │   ├── types.ts         # CloudflareBindings interface
    │   │   ├── routes/
    │   │   │   ├── check.ts     # POST /v1/check & GET /v1/quota
    │   │   │   └── auth.ts      # POST /v1/auth/otp & POST /v1/auth/verify
    │   │   └── services/
    │   │       ├── openai.ts    # OpenAI Structured Outputs + local heuristic fallback
    │   │       └── quota.ts     # JWT identity resolution + KV/memory daily counters
    │   └── test/
    │       └── api.test.ts      # Vitest integration tests for check, quota, and OTP auth
    └── desktop/                 # @select-check/desktop — Tauri v2 cross-platform app
        ├── src-tauri/           # Rust native OS layer
        │   ├── Cargo.toml       # Rust dependencies (tauri, rdev, arboard, enigo, active-win-pos-rs)
        │   ├── tauri.conf.json  # Multi-window config (overlay + settings) & bundle targets
        │   ├── capabilities/    # Tauri v2 fine-grained window permissions
        │   └── src/
        │       ├── main.rs      # Native binary entry point
        │       ├── lib.rs       # Shared state, settings commands, plugin initialization
        │       ├── selection.rs # Global mouse listener, blocklist check, safe text extraction
        │       ├── overlay.rs   # Window positioning, screen clamping, ball <-> card resize
        │       ├── replacer.rs  # Focus-safe in-place text replacement via clipboard/paste
        │       └── tray.rs      # OS system tray menu (Pause/Resume, Settings, Quit)
        ├── src/                 # React 19 + TypeScript + Tailwind CSS v4 frontend
        │   ├── App.tsx          # Window query-param router (?window=overlay | settings)
        │   ├── components/
        │   │   ├── FloatingBall.tsx
        │   │   └── SuggestionCard.tsx
        │   ├── views/
        │   │   ├── OverlayView.tsx
        │   │   ├── SettingsView.tsx
        │   │   └── InteractiveWorkspace.tsx
        │   ├── services/
        │   │   ├── api.ts
        │   │   └── tauriBridge.ts
        │   └── utils/
        │       └── diff.ts      # Word-level LCS diff algorithm
        └── test/
            └── diff.test.ts     # Unit tests for word-level diff segments
```

---

## 2. High-Level System Architecture

```mermaid
flowchart TB
    subgraph UserOS["User Operating System (Windows / macOS / Linux)"]
        ActiveApp["Third-Party Active App\n(Slack, Chrome, Mail, Notion, etc.)"]

        subgraph TauriProcess["SelectCheck Desktop App (Tauri v2)"]
            direction TB
            subgraph RustCore["Rust Native Core (src-tauri)"]
                MouseHook["Global Mouse Listener (rdev)\nDetects Click-Drag & Double-Click"]
                WinInspector["Active Window Inspector (active-win-pos-rs)\nChecks App Blocklist"]
                SafeClipboard["Safe Clipboard Extractor & Replacer\n(arboard + enigo)"]
                WinManager["Window & Tray Manager\n(overlay 44x44 <-> 392x360, settings)"]
            end

            subgraph WebviewUI["React + Tailwind Webviews (src)"]
                OverlayUI["Overlay Window (?window=overlay)\nFloatingBall + 3 SuggestionCards + WordDiff"]
                SettingsUI["Settings Window (?window=settings)\nOTP Login, Quota Bar, Blocklist Editor"]
            end
        end
    end

    subgraph CloudflareEdge["Cloudflare Edge Network (apps/api)"]
        HonoRouter["Hono API Router\n(/v1/check, /v1/quota, /v1/auth/*)"]
        QuotaService["Quota & Auth Service\n(HS256 JWT + KV Daily Counter)"]
        KV[("Cloudflare KV\n(QUOTA_KV)")]
        D1[("Cloudflare D1\n(usage_logs)")]
    end

    OpenAI["OpenAI API\n(gpt-4o-mini with JSON Schema Structured Outputs)"]

    ActiveApp -- "1. User selects text" --> MouseHook
    MouseHook -- "2. Verify app not blocked" --> WinInspector
    WinInspector -- "3. Snapshot clipboard & copy selection" --> SafeClipboard
    SafeClipboard -- "4. Show Ball at cursor & emit 'selection-detected'" --> WinManager
    WinManager --> OverlayUI
    OverlayUI -- "5. User clicks Ball -> invoke('expand_overlay')" --> WinManager
    OverlayUI -- "6. POST /v1/check (text, deviceId, Bearer JWT)" --> HonoRouter
    HonoRouter --> QuotaService
    QuotaService <--> KV
    HonoRouter -- "7. Prompt with strict JSON Schema" --> OpenAI
    OpenAI -- "8. { detectedLanguage, grammarFix, clearConcise, professionalPolished }" --> HonoRouter
    HonoRouter -. "9. Async audit insert" .-> D1
    HonoRouter -- "10. CheckResponse (3 suggestions + quota)" --> OverlayUI
    OverlayUI -- "11. Click suggestion or press 1/2/3 -> invoke('replace_selected_text')" --> SafeClipboard
    SafeClipboard -- "12. Hide overlay, paste replacement, restore clipboard" --> ActiveApp
```

---

## 3. End-to-End Runtime Lifecycle (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Active App (e.g. Slack)
    participant Hook as Rust selection.rs
    participant Win as Rust overlay.rs / replacer.rs
    participant UI as React OverlayView
    participant Edge as Cloudflare Worker (Hono)
    participant AI as OpenAI (gpt-4o-mini)

    User->>App: Highlights text (drag > 12px or double-click < 360ms)
    Hook->>Hook: Check state.paused & settings.auto_show_on_select
    Hook->>App: get_active_window() -> verify app_name not in blocked_apps
    Hook->>App: capture_selected_text_safely() (save clipboard -> Cmd/Ctrl+C -> read -> restore clipboard)
    Hook->>Win: show_ball_at(cursor_x + 12, cursor_y + 12) (44x44px, focus: false)
    Hook->>UI: emit("selection-detected", { text, app_name, x, y })
    Note over UI: Starts 4-second auto-dismiss timer (paused while hovered)

    alt User ignores ball for 4 seconds
        UI->>Win: invoke("dismiss_overlay")
        Win->>UI: Hide overlay window
    else User clicks the Floating Ball
        User->>UI: Clicks FloatingBall
        UI->>Win: invoke("expand_overlay") -> resize to 392x360px (clamped to screen)
        UI->>Edge: POST /v1/check { text, deviceId } + Authorization header
        Edge->>Edge: resolveCallerIdentity() & getQuotaStatus() (10/day free or 100/day auth)
        Edge->>AI: POST /v1/chat/completions (gpt-4o-mini, strict json_schema)
        AI-->>Edge: Structured JSON (detectedLanguage + 3 suggestions)
        Edge->>Edge: incrementQuota() in KV
        Edge-->>UI: 200 OK CheckResponse
        UI->>User: Renders 3 SuggestionCards with word-level LCS diff highlights

        User->>UI: Clicks Suggestion Card #2 (or presses hotkey '2')
        UI->>Win: invoke("replace_selected_text", { text: suggestion[1].text })
        Win->>UI: Hide overlay window (returns OS focus to Active App)
        Win->>App: Snapshot clipboard -> set suggestion text -> synthesize Cmd/Ctrl+V -> restore clipboard
    end
```

---

## 4. Overlay Window State Machine

The overlay window (`?window=overlay`) transitions through four well-defined states managed jointly by `OverlayView.tsx` and `overlay.rs`:

```mermaid
stateDiagram-v2
    [*] --> Hidden: App startup

    Hidden --> BallMode: "selection-detected" event\n(44x44px at cursor + 12px, non-focused)

    BallMode --> Hidden: Auto-hide timer expires (4s)\nOR cursor clicks elsewhere

    BallMode --> LoadingCard: User clicks Floating Ball\ninvoke("expand_overlay") -> 392x360px

    LoadingCard --> SuggestionsReady: POST /v1/check succeeds\n(200 OK with 3 suggestions)
    LoadingCard --> ErrorCard: POST /v1/check fails\n(429 Quota Exceeded or Network Error)

    SuggestionsReady --> Hidden: User clicks Card or presses 1 / 2 / 3\ninvoke("replace_selected_text")
    SuggestionsReady --> Hidden: User clicks Close or presses Esc\ninvoke("dismiss_overlay")

    ErrorCard --> LoadingCard: User clicks Retry
    ErrorCard --> Hidden: User opens Settings or closes card
```

---

## 5. Shared Data Contract (`packages/shared/src/index.ts`)

Both `apps/api` and `apps/desktop` import `@select-check/shared` so request payloads, suggestion styles, and quota structures are guaranteed to stay in sync at compile time:

| Type / Constant | Purpose |
| :--- | :--- |
| `SuggestionStyle` | Union type: `'grammar_fix' \| 'clear_concise' \| 'professional_polished'` |
| `SuggestionItem` | `{ style, label, text, summary }` representing one of the 3 cards |
| `QuotaInfo` | `{ used, limit, tier: 'free_device' \| 'authenticated', resetsAt }` |
| `CheckRequest` | `{ text: string, deviceId: string }` sent to `POST /v1/check` |
| `CheckResponse` | `{ detectedLanguage, originalText, suggestions: [item1, item2, item3], quota }` |
| `AppSettings` | User preferences persisted locally and synced with the Rust core |
| `DEFAULT_BLOCKED_APPS` | Default ignore list (`Terminal`, `iTerm2`, `Warp`, `Alacritty`, `WindowsTerminal`, `cmd.exe`, `powershell.exe`) |
| `FREE_DEVICE_DAILY_LIMIT` | `10` checks per UTC day per anonymous `deviceId` |
| `AUTHENTICATED_DAILY_LIMIT` | `100` checks per UTC day per signed-in user |
