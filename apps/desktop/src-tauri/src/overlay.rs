use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size};

use crate::selection::clamp_to_screen;

const BALL_SIZE: f64 = 44.0;
const CARD_WIDTH: f64 = 392.0;
const CARD_HEIGHT: f64 = 360.0;

pub fn show_ball_at(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        let (screen_w, screen_h) = win
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| {
                let scale = m.scale_factor();
                (m.size().width as f64 / scale, m.size().height as f64 / scale)
            })
            .unwrap_or((1920.0, 1080.0));

        let (clamped_x, clamped_y) =
            clamp_to_screen(x, y, BALL_SIZE, BALL_SIZE, screen_w, screen_h);

        let _ = win.set_size(Size::Logical(LogicalSize::new(BALL_SIZE, BALL_SIZE)));
        let _ = win.set_position(Position::Logical(LogicalPosition::new(
            clamped_x, clamped_y,
        )));
        let _ = win.show();
    }
    Ok(())
}

#[tauri::command]
pub fn expand_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        let (screen_w, screen_h) = win
            .current_monitor()
            .ok()
            .flatten()
            .map(|m| {
                let scale = m.scale_factor();
                (m.size().width as f64 / scale, m.size().height as f64 / scale)
            })
            .unwrap_or((1920.0, 1080.0));

        let pos = win
            .outer_position()
            .ok()
            .map(|p| (p.x as f64, p.y as f64))
            .unwrap_or((400.0, 300.0));

        let (clamped_x, clamped_y) =
            clamp_to_screen(pos.0, pos.1, CARD_WIDTH, CARD_HEIGHT, screen_w, screen_h);

        let _ = win.set_size(Size::Logical(LogicalSize::new(CARD_WIDTH, CARD_HEIGHT)));
        let _ = win.set_position(Position::Logical(LogicalPosition::new(
            clamped_x, clamped_y,
        )));
        let _ = win.set_focus();
    }
    Ok(())
}

pub fn dismiss_overlay_window(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.hide();
        let _ = win.set_size(Size::Logical(LogicalSize::new(BALL_SIZE, BALL_SIZE)));
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
