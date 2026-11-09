use active_win_pos_rs::get_active_window;
use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings as EnigoSettings};
use rdev::{listen, Button, Event, EventType};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use crate::overlay::show_ball_at;
use crate::SharedState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionPayload {
    pub text: String,
    pub app_name: String,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone)]
struct MouseTracker {
    down_pos: Option<(f64, f64)>,
    down_time: Option<Instant>,
    last_pos: (f64, f64),
    last_click_time: Option<Instant>,
    last_click_pos: (f64, f64),
}

impl Default for MouseTracker {
    fn default() -> Self {
        Self {
            down_pos: None,
            down_time: None,
            last_pos: (0.0, 0.0),
            last_click_time: None,
            last_click_pos: (0.0, 0.0),
        }
    }
}

/// Checks if the given application name matches any entry in the user's blocklist (case-insensitive)
pub fn is_app_blocked(app_name: &str, blocked_apps: &[String]) -> bool {
    let lower = app_name.to_lowercase();
    if lower.contains("selectcheck") || lower.contains("select-check") {
        return true;
    }
    blocked_apps
        .iter()
        .any(|blocked| !blocked.is_empty() && lower.contains(&blocked.to_lowercase()))
}

/// Clamps overlay coordinates to ensure the window stays inside the screen bounds
pub fn clamp_to_screen(x: f64, y: f64, width: f64, height: f64, screen_w: f64, screen_h: f64) -> (f64, f64) {
    let clamped_x = x.max(12.0).min((screen_w - width - 12.0).max(12.0));
    let clamped_y = y.max(24.0).min((screen_h - height - 24.0).max(24.0));
    (clamped_x, clamped_y)
}

/// Extracts currently selected text while preserving the user's existing clipboard contents
pub fn capture_selected_text_safely() -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    let previous_clipboard = clipboard.get_text().ok();

    // Clear clipboard sentinel so we know if the simulated Copy actually copied new selected text
    let _ = clipboard.set_text(String::new());

    if let Ok(mut enigo) = Enigo::new(&EnigoSettings::default()) {
        #[cfg(target_os = "macos")]
        let modifier = Key::Meta;
        #[cfg(not(target_os = "macos"))]
        let modifier = Key::Control;

        let _ = enigo.key(modifier, Direction::Press);
        let _ = enigo.key(Key::Unicode('c'), Direction::Click);
        let _ = enigo.key(modifier, Direction::Release);
    }

    thread::sleep(Duration::from_millis(55));

    let captured = clipboard.get_text().ok().map(|s| s.trim().to_string());

    // Restore original clipboard immediately
    if let Some(prev) = previous_clipboard {
        let _ = clipboard.set_text(prev);
    }

    match captured {
        Some(text) if text.chars().count() >= 2 && text.chars().count() <= 2000 => Some(text),
        _ => None,
    }
}

/// Starts the background global mouse listener thread to detect text selection gestures
pub fn start_selection_listener(app_handle: AppHandle, state: SharedState) {
    let tracker = Arc::new(Mutex::new(MouseTracker::default()));

    thread::spawn(move || {
        let tracker_clone = Arc::clone(&tracker);
        let _ = listen(move |event: Event| {
            let mut tr = match tracker_clone.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            match event.event_type {
                EventType::MouseMove { x, y } => {
                    tr.last_pos = (x, y);
                }
                EventType::ButtonPress(Button::Left) => {
                    tr.down_pos = Some(tr.last_pos);
                    tr.down_time = Some(Instant::now());
                }
                EventType::ButtonRelease(Button::Left) => {
                    let release_pos = tr.last_pos;
                    let now = Instant::now();

                    let is_drag = if let (Some((dx, dy)), Some(dt)) = (tr.down_pos, tr.down_time) {
                        let dist = ((release_pos.0 - dx).powi(2) + (release_pos.1 - dy).powi(2)).sqrt();
                        dist > 12.0 && now.duration_since(dt) < Duration::from_secs(10)
                    } else {
                        false
                    };

                    let is_double_click = if let Some(prev_click) = tr.last_click_time {
                        let dist = ((release_pos.0 - tr.last_click_pos.0).powi(2)
                            + (release_pos.1 - tr.last_click_pos.1).powi(2))
                        .sqrt();
                        now.duration_since(prev_click) < Duration::from_millis(360) && dist < 8.0
                    } else {
                        false
                    };

                    tr.last_click_time = Some(now);
                    tr.last_click_pos = release_pos;
                    tr.down_pos = None;
                    tr.down_time = None;

                    if !is_drag && !is_double_click {
                        return;
                    }

                    // Check settings (paused / blocklist)
                    let (auto_show, blocked_apps) = {
                        if let Ok(st) = state.lock() {
                            if st.paused || !st.settings.auto_show_on_select {
                                return;
                            }
                            (st.settings.auto_show_on_select, st.settings.blocked_apps.clone())
                        } else {
                            return;
                        }
                    };

                    if !auto_show {
                        return;
                    }

                    let active_app_name = get_active_window()
                        .map(|w| w.app_name)
                        .unwrap_or_else(|_| "Unknown".to_string());

                    if is_app_blocked(&active_app_name, &blocked_apps) {
                        return;
                    }

                    let handle = app_handle.clone();
                    let state_ref = Arc::clone(&state);
                    let (cx, cy) = release_pos;

                    thread::spawn(move || {
                        if let Some(selected_text) = capture_selected_text_safely() {
                            if let Ok(mut st) = state_ref.lock() {
                                st.last_selected_text = selected_text.clone();
                                st.last_source_app = active_app_name.clone();
                                st.last_cursor = (cx, cy);
                            }

                            let _ = show_ball_at(&handle, cx + 12.0, cy + 12.0);
                            let _ = handle.emit(
                                "selection-detected",
                                SelectionPayload {
                                    text: selected_text,
                                    app_name: active_app_name,
                                    x: cx,
                                    y: cy,
                                },
                            );
                        }
                    });
                }
                _ => {}
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_blocklist_matching() {
        let blocked = vec!["Terminal".to_string(), "iTerm2".to_string()];
        assert!(is_app_blocked("iTerm2", &blocked));
        assert!(is_app_blocked("Apple Terminal", &blocked));
        assert!(is_app_blocked("SelectCheck", &blocked));
        assert!(!is_app_blocked("Slack", &blocked));
        assert!(!is_app_blocked("Google Chrome", &blocked));
    }

    #[test]
    fn test_screen_clamping() {
        let (x, y) = clamp_to_screen(1900.0, 1050.0, 380.0, 320.0, 1920.0, 1080.0);
        assert_eq!(x, 1920.0 - 380.0 - 12.0);
        assert_eq!(y, 1080.0 - 320.0 - 24.0);
    }
}
