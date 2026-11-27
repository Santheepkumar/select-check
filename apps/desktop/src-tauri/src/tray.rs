use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

use crate::SharedState;

pub fn setup_system_tray(app: &AppHandle, state: SharedState) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = MenuItem::with_id(app, "toggle_pause", "Pause SelectCheck", true, None::<&str>)?;
    let onboarding_item = MenuItem::with_id(app, "open_onboarding", "Setup & Hotkeys...", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "open_settings", "Settings & AI Engine...", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit SelectCheck", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle_item, &onboarding_item, &settings_item, &quit_item])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("valid tray icon"));

    let _tray = TrayIconBuilder::with_id("select-check-tray")
        .icon(icon)
        .icon_as_template(true)
        .show_menu_on_left_click(true)
        .tooltip("SelectCheck — Floating Rewrite Assistant")
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
            "open_onboarding" => {
                if let Some(win) = app.get_webview_window("onboarding") {
                    let _ = win.show();
                    let _ = win.set_focus();
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
