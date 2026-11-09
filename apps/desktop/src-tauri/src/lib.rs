pub mod overlay;
pub mod replacer;
pub mod selection;
pub mod tray;

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

use overlay::{dismiss_overlay, expand_overlay, open_settings_window};
use replacer::replace_selected_text;
use selection::start_selection_listener;
use tray::setup_system_tray;

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
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            auto_show_on_select: true,
            auto_hide_seconds: 4,
            show_word_diff: true,
            global_shortcut: "CommandOrControl+Shift+G".to_string(),
            blocked_apps: vec![
                "Terminal".to_string(),
                "iTerm2".to_string(),
                "Warp".to_string(),
                "WindowsTerminal".to_string(),
            ],
            api_url: "http://localhost:8787".to_string(),
            device_id: "dev_local_desktop".to_string(),
            auth_token: None,
            user_email: None,
        }
    }
}

pub struct AppRuntimeState {
    pub paused: bool,
    pub settings: DesktopSettings,
    pub last_selected_text: String,
    pub last_source_app: String,
    pub last_cursor: (f64, f64),
}

impl Default for AppRuntimeState {
    fn default() -> Self {
        Self {
            paused: false,
            settings: DesktopSettings::default(),
            last_selected_text: String::new(),
            last_source_app: String::new(),
            last_cursor: (0.0, 0.0),
        }
    }
}

pub type SharedState = Arc<Mutex<AppRuntimeState>>;

#[tauri::command]
fn get_settings(state: State<'_, SharedState>) -> Result<DesktopSettings, String> {
    let st = state.lock().map_err(|_| "State lock poisoned")?;
    Ok(st.settings.clone())
}

#[tauri::command]
fn save_settings(state: State<'_, SharedState>, settings: DesktopSettings) -> Result<DesktopSettings, String> {
    let mut st = state.lock().map_err(|_| "State lock poisoned")?;
    st.settings = settings.clone();
    Ok(settings)
}

#[tauri::command]
fn get_last_selection(state: State<'_, SharedState>) -> Result<(String, String), String> {
    let st = state.lock().map_err(|_| "State lock poisoned")?;
    Ok((st.last_selected_text.clone(), st.last_source_app.clone()))
}

pub fn run() {
    let shared_state: SharedState = Arc::new(Mutex::new(AppRuntimeState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Arc::clone(&shared_state))
        .invoke_handler(tauri::generate_handler![
            expand_overlay,
            dismiss_overlay,
            open_settings_window,
            replace_selected_text,
            get_settings,
            save_settings,
            get_last_selection
        ])
        .setup(move |app: &mut tauri::App| {
            let handle: AppHandle = app.handle().clone();
            let _ = setup_system_tray(&handle, Arc::clone(&shared_state));
            start_selection_listener(handle, Arc::clone(&shared_state));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SelectCheck desktop application");
}
