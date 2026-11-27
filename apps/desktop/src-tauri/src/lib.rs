pub mod overlay;
pub mod replacer;
pub mod selection;
pub mod tray;

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use overlay::{
    close_onboarding_window, dismiss_overlay, expand_overlay, open_onboarding_window,
    open_settings_window,
};
use replacer::replace_selected_text;
use selection::start_selection_listener;
use tray::setup_system_tray;

fn default_provider() -> String {
    "hosted".to_string()
}

fn default_slot3() -> String {
    "professional_polished".to_string()
}

fn default_true() -> bool {
    true
}

fn default_false() -> bool {
    false
}

fn default_trigger() -> String {
    "hotkey_only".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub auto_show_on_select: bool,
    pub auto_hide_seconds: u32,
    pub show_word_diff: bool,
    pub global_shortcut: String,
    pub blocked_apps: Vec<String>,
    pub api_url: String,
    pub device_id: String,
    pub auth_token: Option<String>,
    pub user_email: Option<String>,
    #[serde(default = "default_provider")]
    pub provider_type: String,
    pub custom_api_key: Option<String>,
    pub custom_base_url: Option<String>,
    pub custom_model: Option<String>,
    #[serde(default = "default_slot3")]
    pub slot3_preset: String,
    pub slot3_custom_prompt: Option<String>,
    #[serde(default = "default_true")]
    pub skip_code_and_numbers: bool,
    #[serde(default = "default_trigger")]
    pub trigger_mode: String,
    #[serde(default = "default_false")]
    pub onboarding_completed: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            auto_show_on_select: false,
            auto_hide_seconds: 4,
            show_word_diff: true,
            global_shortcut: "CommandOrControl+Shift+G".to_string(),
            blocked_apps: vec![
                "Terminal".to_string(),
                "iTerm2".to_string(),
                "Warp".to_string(),
                "WindowsTerminal".to_string(),
            ],
            api_url: "https://select-check-api.santheepkumar.workers.dev".to_string(),
            device_id: "dev_local_desktop".to_string(),
            auth_token: None,
            user_email: None,
            provider_type: "hosted".to_string(),
            custom_api_key: None,
            custom_base_url: None,
            custom_model: None,
            slot3_preset: "professional_polished".to_string(),
            slot3_custom_prompt: None,
            skip_code_and_numbers: true,
            trigger_mode: "hotkey_only".to_string(),
            onboarding_completed: false,
        }
    }
}

pub struct AppRuntimeState {
    pub paused: bool,
    pub settings: DesktopSettings,
    pub last_selected_text: String,
    pub last_source_app: String,
    pub last_cursor: (f64, f64),
    pub overlay_mode: String,
}

impl Default for AppRuntimeState {
    fn default() -> Self {
        Self {
            paused: false,
            settings: DesktopSettings::default(),
            last_selected_text: String::new(),
            last_source_app: String::new(),
            last_cursor: (0.0, 0.0),
            overlay_mode: "hidden".to_string(),
        }
    }
}

pub type SharedState = Arc<Mutex<AppRuntimeState>>;

pub fn handle_global_hotkey(app: &AppHandle, _shortcut: &Shortcut) {
    let (is_paused, skip_code_and_numbers, blocked_apps) = {
        if let Some(state) = app.try_state::<SharedState>() {
            if let Ok(st) = state.lock() {
                if st.paused {
                    return;
                }
                (
                    st.paused,
                    st.settings.skip_code_and_numbers,
                    st.settings.blocked_apps.clone(),
                )
            } else {
                return;
            }
        } else {
            return;
        }
    };

    if is_paused {
        return;
    }

    let active_window = active_win_pos_rs::get_active_window().ok();
    let active_app_name = active_window
        .as_ref()
        .map(|w| w.app_name.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    let active_title = active_window
        .as_ref()
        .map(|w| w.title.clone())
        .unwrap_or_default();

    let lower_app = active_app_name.to_lowercase();
    let lower_title = active_title.to_lowercase();

    // If focused on Settings or Onboarding of SelectCheck, ignore hotkey capture
    if (lower_app.contains("selectcheck") || lower_app.contains("select-check"))
        && (lower_title.contains("settings") || lower_title.contains("onboarding"))
    {
        return;
    }

    if selection::is_app_blocked(&active_app_name, &blocked_apps) {
        return;
    }

    let live_cursor = selection::get_live_cursor_location();
    let (cx, cy) = if live_cursor != (0.0, 0.0) {
        live_cursor
    } else {
        (400.0, 300.0)
    };

    let app_handle = app.clone();
    let active_app = active_app_name.clone();

    std::thread::spawn(move || {
        let captured = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            selection::capture_selected_text_safely(skip_code_and_numbers)
        }));

        let text_to_emit = match captured {
            Ok(Some(text)) => text,
            _ => String::new(),
        };

        if let Some(state) = app_handle.try_state::<SharedState>() {
            if let Ok(mut st) = state.lock() {
                st.last_selected_text = text_to_emit.clone();
                st.last_source_app = active_app.clone();
                st.last_cursor = (cx, cy);
                st.overlay_mode = "card".to_string();
            }
        }

        let _ = overlay::show_card_at(&app_handle, cx, cy);
        use tauri::Emitter;
        let _ = app_handle.emit(
            "hotkey-trigger-check",
            selection::SelectionPayload {
                text: text_to_emit,
                app_name: active_app,
                x: cx,
                y: cy,
            },
        );
    });
}

#[tauri::command]
fn get_settings(state: State<'_, SharedState>) -> Result<DesktopSettings, String> {
    let st = state.lock().map_err(|_| "State lock poisoned")?;
    Ok(st.settings.clone())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, SharedState>,
    settings: DesktopSettings,
) -> Result<DesktopSettings, String> {
    let mut st = state.lock().map_err(|_| "State lock poisoned")?;
    let old_shortcut = st.settings.global_shortcut.clone();
    let new_shortcut = settings.global_shortcut.clone();
    st.settings = settings.clone();

    if old_shortcut != new_shortcut && !new_shortcut.is_empty() {
        if !old_shortcut.is_empty() {
            let _ = app.global_shortcut().unregister(old_shortcut.as_str());
        }
        let _ = app.global_shortcut().register(new_shortcut.as_str());
    }

    Ok(settings)
}

#[tauri::command]
fn get_last_selection(state: State<'_, SharedState>) -> Result<(String, String), String> {
    let st = state.lock().map_err(|_| "State lock poisoned")?;
    Ok((st.last_selected_text.clone(), st.last_source_app.clone()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacPermissionsStatus {
    pub accessibility: bool,
    pub input_monitoring: bool,
}

#[tauri::command]
fn check_system_permissions() -> MacPermissionsStatus {
    #[cfg(target_os = "macos")]
    {
        MacPermissionsStatus {
            accessibility: selection::macos_accessibility::is_trusted(),
            input_monitoring: selection::macos_accessibility::is_input_monitoring_trusted(),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        MacPermissionsStatus {
            accessibility: true,
            input_monitoring: true,
        }
    }
}

#[tauri::command]
fn open_permission_settings(permission_type: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = if permission_type == "input_monitoring" {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
        } else {
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
        };
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    Ok(())
}

pub fn run() {
    let shared_state: SharedState = Arc::new(Mutex::new(AppRuntimeState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        handle_global_hotkey(app, shortcut);
                    }
                })
                .build(),
        )
        .manage(Arc::clone(&shared_state))
        .invoke_handler(tauri::generate_handler![
            expand_overlay,
            dismiss_overlay,
            open_settings_window,
            open_onboarding_window,
            close_onboarding_window,
            replace_selected_text,
            get_settings,
            save_settings,
            get_last_selection,
            check_system_permissions,
            open_permission_settings
        ])
        .setup(move |app: &mut tauri::App| {
            let handle: AppHandle = app.handle().clone();
            if let Some(overlay_win) = app.get_webview_window("overlay") {
                let _ = overlay_win.set_shadow(false);
                overlay::apply_macos_transparency(&overlay_win);
            }
            let _ = setup_system_tray(&handle, Arc::clone(&shared_state));
            start_selection_listener(handle.clone(), Arc::clone(&shared_state));

            // Register initial global shortcut
            let (initial_shortcut, needs_onboarding) = {
                if let Ok(st) = shared_state.lock() {
                    (
                        st.settings.global_shortcut.clone(),
                        !st.settings.onboarding_completed,
                    )
                } else {
                    ("CommandOrControl+Shift+G".to_string(), true)
                }
            };

            let _ = handle.global_shortcut().register(initial_shortcut.as_str());

            if needs_onboarding {
                if let Some(onboarding_win) = app.get_webview_window("onboarding") {
                    let _ = onboarding_win.show();
                    let _ = onboarding_win.set_focus();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SelectCheck desktop application");
}
