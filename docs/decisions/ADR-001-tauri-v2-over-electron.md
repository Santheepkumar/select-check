# ADR-001: Use Tauri v2 (Rust) over Electron for the Cross-Platform Desktop App

## Status
Accepted

## Date
2026-11-06

## Context
SelectCheck is an always-on background system-tray utility for Windows, macOS, and Linux that listens for OS-wide mouse selection gestures and displays a tiny floating overlay (`44x44px` ball expanding to a `392x360px` card). Key requirements:
- Minimal idle memory footprint and tiny installer size so users keep it running in the background at all times.
- Direct, low-latency access to native OS mouse hooks, active window metadata, clipboard, and keyboard synthesis.
- Full support for React, TypeScript, and Tailwind CSS for the animated floating ball and diff-highlighted suggestion cards.

## Decision
Use **Tauri v2** (`tauri 2.1.0`) with a **Rust** native core (`rdev`, `arboard`, `enigo`, `active-win-pos-rs`) and a **React + TypeScript + Tailwind CSS** frontend rendered via the OS native webview (`WKWebView` on macOS, `WebView2` on Windows, `WebKitGTK` on Linux).

## Alternatives Considered

### Electron (Node.js + Chromium)
- **Pros**: Single JavaScript/TypeScript language across main and renderer processes; consistent Chromium rendering across all OSes.
- **Cons**: Bundles a full Chromium browser and Node.js runtime (`~150MB` installer, `180MB–300MB` idle RAM), and still requires native C++/Rust Node-API addons (`iohook`/`nut.js`) for global mouse hooks and keyboard synthesis.
- **Rejected**: Too heavy for an always-on floating grammar widget, and native C++ addons complicate cross-platform builds.

### Pure Rust Native GUI (`iced`, `egui`, or `Slint`)
- **Pros**: No webview overhead; single Rust codebase.
- **Cons**: Styling translucent glassmorphism cards, smooth CSS transitions, and inline `<del>`/`<ins>` rich-text word diffs takes significantly more boilerplate than Tailwind CSS + React.
- **Rejected**: Tauri v2 gives us native Rust OS hooks while retaining modern web UI velocity.

## Consequences
- **Positive**: Installer size is `~10–15MB` and idle RAM footprint stays low because Tauri reuses the OS system webview.
- **Positive**: Rust crates (`rdev`, `arboard`, `enigo`, `active-win-pos-rs`) compile directly into the binary without Node native-addon ABI mismatch issues.
- **Trade-off**: Developers building the native binary locally need the Rust toolchain (`rustup`/`cargo`) installed; we mitigated this by providing `tauriBridge.ts` and `InteractiveWorkspace.tsx` so UI and API development can also run in pure Vite/browser mode without Rust.
