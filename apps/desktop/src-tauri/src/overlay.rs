use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size};

use crate::selection::clamp_to_screen;

const BALL_SIZE: f64 = 48.0;
const CARD_WIDTH: f64 = 392.0;
const CARD_HEIGHT: f64 = 450.0;

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
