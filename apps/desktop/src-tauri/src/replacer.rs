use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings as EnigoSettings};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::overlay::dismiss_overlay_window;

/// Replaces the currently highlighted selection in the active application while preserving the user's clipboard
#[tauri::command]
pub fn replace_selected_text(app: AppHandle, text: String) -> Result<(), String> {
    // 1. Hide the overlay first so OS keyboard focus returns to the target application
    dismiss_overlay_window(&app)?;

    // Give the window manager a brief moment to return focus to the active editor
    thread::sleep(Duration::from_millis(65));

    let mut clipboard = Clipboard::new().map_err(|e| format!("Clipboard error: {e}"))?;
    let original_clipboard = clipboard.get_text().ok();

    // 2. Write replacement text to clipboard
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {e}"))?;

    // 3. Synthesize Paste (Cmd+V on macOS, Ctrl+V on Windows/Linux)
    let mut enigo =
        Enigo::new(&EnigoSettings::default()).map_err(|e| format!("Input synth error: {e}"))?;

    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;

    let _ = enigo.key(modifier, Direction::Press);
    let _ = enigo.key(Key::Unicode('v'), Direction::Click);
    let _ = enigo.key(modifier, Direction::Release);

    // 4. Wait briefly for the target app to process the paste, then restore the user's original clipboard
    thread::sleep(Duration::from_millis(90));
    if let Some(prev) = original_clipboard {
        let _ = clipboard.set_text(prev);
    }

    Ok(())
}
