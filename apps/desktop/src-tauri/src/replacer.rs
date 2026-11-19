use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings as EnigoSettings};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;

use crate::overlay::dismiss_overlay_window;

/// Replaces the currently highlighted selection in the active application while preserving the user's clipboard
#[tauri::command]
pub fn replace_selected_text(app: AppHandle, text: String) -> Result<(), String> {
    // 1. Hide the overlay first so OS keyboard focus returns to the target application
    dismiss_overlay_window(&app)?;

    // Give the window manager a brief moment to return focus to the active editor
    thread::sleep(Duration::from_millis(60));

    // 2. Open system clipboard and backup current user content
    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {e}"))?;
    let previous_clipboard = clipboard.get_text().ok();

    // 3. Write selected suggestion to system clipboard
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set replacement clipboard text: {e}"))?;

    // 4. Synthesize Command+V (macOS) or Ctrl+V (Windows/Linux) via enigo
    let mut enigo =
        Enigo::new(&EnigoSettings::default()).map_err(|e| format!("Enigo init error: {e:?}"))?;

    #[cfg(target_os = "macos")]
    let modifier_key = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier_key = Key::Control;

    // On macOS, Key::Unicode('v') triggers Carbon TSM layout resolution which crashes
    // background threads. Key::Other(9) directly uses raw virtual keycode kVK_ANSI_V (9).
    #[cfg(target_os = "macos")]
    let v_key = Key::Other(9);
    #[cfg(not(target_os = "macos"))]
    let v_key = Key::Unicode('v');

    let _ = enigo.key(modifier_key, Direction::Press);
    let _ = enigo.key(v_key, Direction::Click);
    let _ = enigo.key(modifier_key, Direction::Release);

    // 5. Restore original clipboard content in background after paste completes
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(350));
        if let Some(prev) = previous_clipboard {
            if let Ok(mut cb) = Clipboard::new() {
                let _ = cb.set_text(prev);
            }
        }
    });

    Ok(())
}
