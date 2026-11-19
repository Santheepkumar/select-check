use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size};

use crate::selection::clamp_to_screen;

#[cfg(target_os = "macos")]
#[allow(unexpected_cfgs)]
pub fn apply_macos_transparency(win: &tauri::WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::base::{id, NO};
    use objc::runtime::{Class, Object};
    use objc::{msg_send, sel, sel_impl};

    if let Ok(ns_win_ptr) = win.ns_window() {
        let ns_window = ns_win_ptr as id;
        unsafe {
            ns_window.setOpaque_(NO);
            let clear_color: id = msg_send![Class::get("NSColor").unwrap(), clearColor];
            ns_window.setBackgroundColor_(clear_color);
            ns_window.setHasShadow_(NO);
            let _: () = msg_send![ns_window, invalidateShadow];
        }
    }

    let _ = win.with_webview(|webview| {
        unsafe {
            let webview_ptr = webview.inner() as *mut Object;
            let no: *mut Object = msg_send![Class::get("NSNumber").unwrap(), numberWithBool: false];
            let key: *mut Object = msg_send![
                Class::get("NSString").unwrap(),
                stringWithUTF8String: b"drawsBackground\0".as_ptr()
            ];
            let _: () = msg_send![webview_ptr, setValue: no forKey: key];

            let clear_color: *mut Object = msg_send![Class::get("NSColor").unwrap(), clearColor];
            let _: () = msg_send![webview_ptr, setUnderPageBackgroundColor: clear_color];
        }
    });
}

#[cfg(not(target_os = "macos"))]
pub fn apply_macos_transparency(_win: &tauri::WebviewWindow) {}

const BALL_SIZE: f64 = 48.0;
const CARD_WIDTH: f64 = 392.0;
const CARD_HEIGHT: f64 = 520.0;

pub fn show_ball_at(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        let monitor = win.current_monitor().ok().flatten();
        let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
        let (screen_w, screen_h) = monitor
            .map(|m| {
                (
                    m.size().width as f64 / scale,
                    m.size().height as f64 / scale,
                )
            })
            .unwrap_or((1920.0, 1080.0));

        let (clamped_x, clamped_y) =
            clamp_to_screen(x, y, BALL_SIZE, BALL_SIZE, screen_w, screen_h);

        let _ = win.set_shadow(false);
        let _ = win.set_size(Size::Logical(LogicalSize::new(BALL_SIZE, BALL_SIZE)));
        let _ = win.set_position(Position::Logical(LogicalPosition::new(
            clamped_x, clamped_y,
        )));
        let _ = win.show();
        let _ = win.set_shadow(false);
        apply_macos_transparency(&win);

        if let Some(state) = app.try_state::<crate::SharedState>() {
            if let Ok(mut st) = state.lock() {
                st.overlay_mode = "ball".to_string();
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn expand_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        if let Some(state) = app.try_state::<crate::SharedState>() {
            if let Ok(mut st) = state.lock() {
                st.overlay_mode = "card".to_string();
            }
        }
        let monitor = win.current_monitor().ok().flatten();
        let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
        let (screen_w, screen_h) = monitor
            .map(|m| {
                (
                    m.size().width as f64 / scale,
                    m.size().height as f64 / scale,
                )
            })
            .unwrap_or((1920.0, 1080.0));

        // outer_position() returns physical pixels. Normalize by monitor scale_factor to get logical units.
        let physical_pos = win.outer_position().unwrap_or_default();
        let logical_x = physical_pos.x as f64 / scale;
        let mut logical_y = physical_pos.y as f64 / scale;

        // Smart flip: If near bottom of screen, flip card upwards so it stays completely in view
        if logical_y + CARD_HEIGHT > screen_h - 20.0 {
            logical_y = (logical_y - CARD_HEIGHT + BALL_SIZE).max(24.0);
        }

        let (clamped_x, clamped_y) =
            clamp_to_screen(logical_x, logical_y, CARD_WIDTH, CARD_HEIGHT, screen_w, screen_h);

        let _ = win.set_shadow(false);
        let _ = win.set_size(Size::Logical(LogicalSize::new(CARD_WIDTH, CARD_HEIGHT)));
        let _ = win.set_position(Position::Logical(LogicalPosition::new(
            clamped_x, clamped_y,
        )));
        let _ = win.set_shadow(false);
        apply_macos_transparency(&win);
        let _ = win.set_focus();
    }
    Ok(())
}

pub fn is_point_inside_overlay(app: &AppHandle, x: f64, y: f64) -> bool {
    if let Some(win) = app.get_webview_window("overlay") {
        if win.is_visible().unwrap_or(false) {
            let scale = win
                .current_monitor()
                .ok()
                .flatten()
                .map(|m| m.scale_factor())
                .unwrap_or(1.0);
            if let Ok(pos) = win.outer_position() {
                if let Ok(size) = win.outer_size() {
                    let wx = pos.x as f64 / scale;
                    let wy = pos.y as f64 / scale;
                    let ww = size.width as f64 / scale;
                    let wh = size.height as f64 / scale;
                    return x >= wx && x <= (wx + ww) && y >= wy && y <= (wy + wh);
                }
            }
        }
    }
    false
}

pub fn dismiss_overlay_window(app: &AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<crate::SharedState>() {
        if let Ok(mut st) = state.lock() {
            st.overlay_mode = "hidden".to_string();
        }
    }
    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.hide();
        let _ = win.set_shadow(false);
        let _ = win.set_size(Size::Logical(LogicalSize::new(BALL_SIZE, BALL_SIZE)));
        apply_macos_transparency(&win);
        use tauri::Emitter;
        let _ = app.emit("overlay-dismissed", ());
    }
    Ok(())
}

#[tauri::command]
pub fn dismiss_overlay(app: AppHandle) -> Result<(), String> {
    dismiss_overlay_window(&app)
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}
