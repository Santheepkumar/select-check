# SelectCheck Knowledge Base (`docs/`)

Welcome to the complete technical documentation for **SelectCheck** — a cross-platform (**Windows, macOS, and Linux**) floating grammar checker and writing improvement assistant built with **Tauri v2 (Rust + React/TypeScript/Tailwind CSS)** and **Cloudflare Workers (Hono + OpenAI Structured Outputs)**.

---

## 📚 Documentation Map

| Document | Scope & Contents |
| :--- | :--- |
| **[01. Architecture Overview](./01-architecture-overview.md)** | System topology, monorepo layout, end-to-end Mermaid sequence & state diagrams, and data flow across OS, Rust, React, Cloudflare Edge, and OpenAI. |
| **[02. Desktop Native Core (Rust / Tauri v2)](./02-desktop-rust-core.md)** | Line-by-line guide to `apps/desktop/src-tauri`: global mouse hooks (`rdev`), active window detection (`active-win-pos-rs`), clipboard-safe selection capture, non-activating overlay window clamping, and focus-safe in-place text replacement. |
| **[03. Desktop Frontend UI & Diff Engine](./03-desktop-frontend-ui.md)** | Deep dive into `apps/desktop/src`: window routing (`overlay`, `settings`, `InteractiveWorkspace`), `FloatingBall`, `SuggestionCard`, the LCS word-level diff algorithm (`diff.ts`), and the dual Tauri/Browser bridge. |
| **[04. Serverless Edge API & OpenAI Integration](./04-backend-edge-api.md)** | Complete guide to `apps/api`: Hono routes, OpenAI `gpt-4o-mini` Structured Outputs JSON schema, local heuristic fallback, daily quota enforcement (`10/day` free device vs `100/day` signed-in), and Email OTP auth. |
| **[05. Local Setup, Testing & Deployment Guide](./05-local-setup-and-deployment.md)** | Step-by-step instructions to install prerequisites on macOS/Windows/Linux, run the API & desktop app locally, configure OpenAI/Supabase keys, run tests, and build production binaries. |

---

## 🏛️ Architecture Decision Records (`docs/decisions/`)

Key architectural choices, alternatives considered, and trade-offs are recorded in `docs/decisions/`:

- **[ADR-001: Use Tauri v2 (Rust) over Electron for the Desktop App](./decisions/ADR-001-tauri-v2-over-electron.md)**
- **[ADR-002: Use Cloudflare Workers (Hono) for the Serverless AI Proxy & Quota Engine](./decisions/ADR-002-cloudflare-workers-hono-edge-proxy.md)**
- **[ADR-003: Non-Destructive Clipboard Snapshot for Cross-Platform Selection & In-Place Replacement](./decisions/ADR-003-non-destructive-clipboard-selection-and-replacement.md)**
- **[ADR-004: OpenAI Structured Outputs (`json_schema`) with Deterministic Local Fallback](./decisions/ADR-004-openai-structured-outputs-and-local-fallback.md)**

---

## 📖 Domain Glossary

| Term | Definition in SelectCheck |
| :--- | :--- |
| **Floating Ball (`mode: 'ball'`)** | The `44x44px` transparent, always-on-top, non-activating orb shown near the cursor (`cursor + 12px`) immediately after text is selected in an unblocked application. Auto-hides after 4 seconds if ignored. |
| **Popover Card (`mode: 'card'`)** | The `392x360px` expanded overlay window shown when the user clicks the Floating Ball. Displays detected language, daily quota status, a Word-Diff toggle, and the 3 suggestion cards. |
| **Suggestion Styles** | The three distinct rewrites returned for every check: **1) `grammar_fix`** (minimal grammar/spelling/punctuation fixes), **2) `clear_concise`** (natural, crisp rewrite), and **3) `professional_polished`** (elevated workplace tone). |
| **In-Place Replacement** | Replacing the user's highlighted selection directly inside the target OS application (`Slack`, `Mail`, `Chrome`, etc.) when the user clicks a suggestion card or presses `1`, `2`, or `3`. |
| **Clipboard Snapshot** | Saving the user's existing OS clipboard text before synthesizing `Cmd+C`/`Ctrl+C` (to read selection) or `Cmd+V`/`Ctrl+V` (to paste replacement), then restoring the original clipboard within `<100ms`. |
| **App Blocklist** | User-configurable list of application names (defaulting to terminals like `Terminal`, `iTerm2`, `Warp`, `WindowsTerminal`) where selection detection is suppressed. |
| **Actor Identity (`CallerIdentity`)** | How the backend rate-limiter identifies a caller: either `device:<deviceId>` (`free_device` tier, 10 checks/UTC day) or `user:<userId>` (`authenticated` tier via Bearer JWT, 100 checks/UTC day). |
