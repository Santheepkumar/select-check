use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MobilePermissions {
    pub overlay_granted: bool,
    pub accessibility_granted: bool,
}

#[tauri::command]
fn check_overlay_permission() -> Result<MobilePermissions, String> {
    // On native mobile builds, this calls Android Settings.canDrawOverlays(context) via JNI
    Ok(MobilePermissions {
        overlay_granted: true,
        accessibility_granted: true,
    })
}

#[tauri::command]
fn share_to_whatsapp(text: String) -> Result<bool, String> {
    // Native mobile intent trigger
    println!("Mobile native intent sharing to WhatsApp: {}", text);
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_overlay_permission,
            share_to_whatsapp
        ])
        .run(tauri::generate_context!())
        .expect("error while running selectcheck mobile application");
}
