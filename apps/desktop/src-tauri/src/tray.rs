use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

use crate::SharedState;

pub fn setup_system_tray(app: &AppHandle, state: SharedState) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = MenuItem::with_id(app, "toggle_pause", "Pause SelectCheck", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Settings & Quota...", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit SelectCheck", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle_item, &settings_item, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("select-check-tray")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle_pause" => {
                if let Ok(mut st) = state.lock() {
                    st.paused = !st.paused;
                    let label = if st.paused {
                        "Resume SelectCheck"
                    } else {
                        "Pause SelectCheck"
                    };
                    let _ = toggle_item.set_text(label);
                }
            }
            "open_settings" => {
                if let Some(win) = app.get_webview_window("settings") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
