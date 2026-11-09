# ADR-003: Non-Destructive Clipboard Snapshot for Cross-Platform Selection & In-Place Replacement

## Status
Accepted

## Date
2026-11-06

## Context
SelectCheck must read selected text and replace it in-place across arbitrary third-party desktop applications (native Cocoa/Win32 apps, browsers, Electron apps like Slack/VS Code/Notion, and Qt/GTK apps) on Windows, macOS, and Linux.
Two core technical challenges arise:
1. Many cross-platform apps (especially canvas-rendered or custom webview editors) do not expose their selected text or allow direct text mutation through OS Accessibility APIs alone.
2. Clicking the Floating Ball or Popover Card can steal window focus from the target application, causing `paste` events to land in the wrong window.

## Decision
1. **Non-Activating Ball Window**: Configure the `overlay` window with `focus: false` in `tauri.conf.json` so showing the Floating Ball does not steal OS focus from the active editor.
2. **Clipboard-Preserving Selection Capture (`capture_selected_text_safely`)**:
   - Snapshot the user's current clipboard text via `arboard`.
   - Clear the clipboard sentinel (`""`), synthesize `Cmd+C` (macOS) or `Ctrl+C` (Windows/Linux) via `enigo`, wait `55ms`, read the newly copied selection, and immediately restore the user's original clipboard snapshot.
3. **Focus-Safe In-Place Replacement (`replace_selected_text`)**:
   - Hide the `overlay` window first (`dismiss_overlay_window`) and wait `65ms` so the OS window manager returns focus to the underlying source application where the selection remains active.
   - Snapshot the user's clipboard, write the chosen suggestion text to the clipboard, synthesize `Cmd+V` / `Ctrl+V` via `enigo`, wait `90ms`, and restore the user's original clipboard.

## Alternatives Considered

### OS Accessibility APIs Only (`AXSelectedText` / `UIAutomation`)
- **Pros**: Does not touch the clipboard or synthesize keyboard shortcuts.
- **Cons**: Fails in many non-native, Electron, or custom-rendered text inputs across Windows and Linux, and requires platform-specific C/Objective-C bindings for every OS.
- **Rejected as sole mechanism**: Clipboard-preserving copy/paste works universally across every app that supports standard `Copy` and `Paste`.

## Consequences
- **Positive**: Works consistently across browsers, Slack, Notion, Mail, Word, and native text editors on Windows, macOS, and Linux X11.
- **Positive**: Preserves the user's existing text clipboard across both selection capture and replacement.
- **Caveat**: Clipboard snapshotting currently preserves plain text (`clipboard.get_text()`); if the user had binary image data in their clipboard, restoring plain text will not restore the binary image payload.
