use active_win_pos_rs::get_active_window;
use arboard::Clipboard;
#[cfg(not(target_os = "macos"))]
use enigo::{Direction, Enigo, Key, Settings as EnigoSettings};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[cfg(not(target_os = "macos"))]
use rdev::{listen, Button, Event, EventType, Key as RdevKey};

use crate::overlay::{dismiss_overlay_window, is_point_inside_overlay, show_ball_at};
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

#[cfg(target_os = "macos")]
pub mod macos_accessibility {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrusted() -> bool;
        fn AXIsProcessTrustedWithOptions(
            options: core_foundation::dictionary::CFDictionaryRef,
        ) -> bool;
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGEventTapEnable(
            tap: core_foundation::mach_port::CFMachPortRef,
            enable: bool,
        );
        pub fn CGPreflightListenEventAccess() -> bool;
        pub fn CGRequestListenEventAccess() -> bool;
    }

    pub fn is_trusted() -> bool {
        unsafe { AXIsProcessTrusted() }
    }

    pub fn prompt_accessibility_permission() -> bool {
        let key = CFString::new("AXTrustedCheckOptionPrompt");
        let val = CFBoolean::true_value();
        let dict = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), val.as_CFType())]);
        unsafe { AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef()) }
    }

    pub fn is_input_monitoring_trusted() -> bool {
        unsafe { CGPreflightListenEventAccess() }
    }

    pub fn prompt_input_monitoring_permission() -> bool {
        unsafe { CGRequestListenEventAccess() }
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

/// Smart heuristic filter to avoid intrusive "Clippy" popups on non-prose selections
pub fn is_selection_eligible(text: &str, skip_code_and_numbers: bool) -> bool {
    let trimmed = text.trim();
    let char_count = trimmed.chars().count();
    if char_count < 2 || char_count > 2000 {
        return false;
    }

    if !skip_code_and_numbers {
        return true;
    }

    // Must contain at least one alphabetic character
    if !trimmed.chars().any(|c| c.is_alphabetic()) {
        return false;
    }

    let has_whitespace = trimmed.chars().any(|c| c.is_whitespace());
    if !has_whitespace {
        // Single token
        if char_count < 3 {
            return false;
        }
        if trimmed.contains('_') {
            return false;
        }
        // CamelCase check (e.g. "myVar")
        let chars: Vec<char> = trimmed.chars().collect();
        if chars.len() > 1 && chars[0].is_lowercase() && chars.iter().skip(1).any(|c| c.is_uppercase()) {
            return false;
        }
    }

    let lower = trimmed.to_lowercase();
    let code_keywords = [
        "import ", "export ", "const ", "let ", "var ", "function ",
        "def ", "class ", "fn ", "pub fn ", "return ", "package ",
        "namespace ", "console.log", "print(", "select ", "insert into",
        "update ", "delete from", "<html>", "</div>", "/>"
    ];

    for kw in code_keywords {
        if lower.contains(kw) {
            return false;
        }
    }

    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        return false;
    }

    true
}

#[cfg(target_os = "macos")]
pub fn get_live_cursor_location() -> (f64, f64) {
    use core_graphics::event::CGEvent;
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
        if let Ok(event) = CGEvent::new(source) {
            let loc = event.location();
            return (loc.x, loc.y);
        }
    }
    (0.0, 0.0)
}

#[cfg(not(target_os = "macos"))]
pub fn get_live_cursor_location() -> (f64, f64) {
    (0.0, 0.0)
}

/// Extracts currently selected text while preserving the user's existing clipboard contents
pub fn capture_selected_text_safely(skip_code_and_numbers: bool) -> Option<String> {
    let mut clipboard = Clipboard::new().ok()?;
    let previous_clipboard = clipboard.get_text().ok();

    // Clear clipboard sentinel so we know if the simulated Copy actually copied new selected text
    let _ = clipboard.set_text(String::new());

    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        // Brief pause to allow host application selection state to settle
        thread::sleep(Duration::from_millis(50));

        if let Ok(source) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
            // Keycode 8 is kVK_ANSI_C ('c')
            if let Ok(event_down) = CGEvent::new_keyboard_event(source.clone(), 8, true) {
                // STRICTLY set flags to Command only (removes any hardware Shift/Option the user is holding!)
                event_down.set_flags(CGEventFlags::CGEventFlagCommand);
                event_down.post(CGEventTapLocation::HID);
            }
            if let Ok(event_up) = CGEvent::new_keyboard_event(source, 8, false) {
                event_up.set_flags(CGEventFlags::CGEventFlagCommand);
                event_up.post(CGEventTapLocation::HID);
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(mut enigo) = Enigo::new(&EnigoSettings::default()) {
            let _ = enigo.key(Key::Control, Direction::Press);
            let _ = enigo.key(Key::Unicode('c'), Direction::Click);
            let _ = enigo.key(Key::Control, Direction::Release);
        }
    }

    thread::sleep(Duration::from_millis(60));

    let captured = clipboard.get_text().ok().map(|s| s.trim().to_string());

    // Restore original clipboard immediately
    if let Some(prev) = previous_clipboard {
        let _ = clipboard.set_text(prev);
    }

    match captured {
        Some(text) if is_selection_eligible(&text, skip_code_and_numbers) => Some(text),
        _ => None,
    }
}

/// Triggers a non-destructive background capture of selected text and updates the overlay
fn trigger_selection_check(cx: f64, cy: f64, app_handle: &AppHandle, state: &SharedState) {
    let (auto_show, trigger_mode, skip_code_and_numbers, blocked_apps) = {
        if let Ok(st) = state.lock() {
            if st.paused
                || !st.settings.auto_show_on_select
                || st.settings.trigger_mode == "hotkey_only"
            {
                return;
            }
            (
                st.settings.auto_show_on_select,
                st.settings.trigger_mode.clone(),
                st.settings.skip_code_and_numbers,
                st.settings.blocked_apps.clone(),
            )
        } else {
            return;
        }
    };

    if !auto_show || trigger_mode == "hotkey_only" {
        return;
    }

    let active_app_name = get_active_window()
        .map(|w| w.app_name)
        .unwrap_or_else(|_| "Unknown".to_string());

    if is_app_blocked(&active_app_name, &blocked_apps) {
        return;
    }

    let handle = app_handle.clone();
    let state_ref = Arc::clone(state);

    thread::spawn(move || {
        let captured = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            capture_selected_text_safely(skip_code_and_numbers)
        }));

        match captured {
            Ok(Some(selected_text)) => {
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
            _ => {
                let _ = dismiss_overlay_window(&handle);
            }
        }
    });
}

/// macOS implementation: Uses CoreGraphics CGEventTap to listen to mouse gestures and keyboard selection.
/// Avoids HIToolbox TSMGetInputSourceProperty assertion crashes by reading pure C event fields.
#[cfg(target_os = "macos")]
pub fn start_selection_listener(app_handle: AppHandle, state: SharedState) {
    use core_foundation::base::TCFType;
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use core_graphics::event::{
        CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
        CGEventType,
    };
    use std::sync::atomic::{AtomicUsize, Ordering};

    thread::spawn(move || {
        // Step 1: Ensure both Accessibility and Input Monitoring permissions are requested on macOS
        if !macos_accessibility::is_trusted() {
            eprintln!("[SelectCheck] Accessibility permission not yet granted. Prompting user...");
            macos_accessibility::prompt_accessibility_permission();
        }

        if !macos_accessibility::is_input_monitoring_trusted() {
            eprintln!("[SelectCheck] Input Monitoring permission not yet granted. Prompting user...");
            macos_accessibility::prompt_input_monitoring_permission();
        }

        let tracker = Arc::new(Mutex::new(MouseTracker::default()));
        let mach_port_holder = Arc::new(AtomicUsize::new(0));

        // Step 2: Loop until accessibility is trusted and event tap is created
        let tap = loop {
            if !macos_accessibility::is_trusted() {
                eprintln!("[SelectCheck] Waiting for Accessibility permission in System Settings...");
                thread::sleep(Duration::from_millis(1500));
                continue;
            }

            let tracker_clone = Arc::clone(&tracker);
            let app_handle_clone = app_handle.clone();
            let state_clone = Arc::clone(&state);
            let mach_port_clone = Arc::clone(&mach_port_holder);

            let tap_res = CGEventTap::new(
                CGEventTapLocation::HID,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                vec![
                    CGEventType::LeftMouseDown,
                    CGEventType::LeftMouseUp,
                    CGEventType::LeftMouseDragged,
                    CGEventType::KeyUp,
                    CGEventType::TapDisabledByTimeout,
                    CGEventType::TapDisabledByUserInput,
                ],
                move |_proxy, event_type, cg_event| {
                    if matches!(
                        event_type,
                        CGEventType::TapDisabledByTimeout | CGEventType::TapDisabledByUserInput
                    ) {
                        let port = mach_port_clone.load(Ordering::SeqCst);
                        if port != 0 {
                            unsafe {
                                macos_accessibility::CGEventTapEnable(
                                    port as core_foundation::mach_port::CFMachPortRef,
                                    true,
                                );
                            }
                        }
                        return None;
                    }

                    let loc = cg_event.location();
                    let current_pos = (loc.x, loc.y);

                    // ONE-CLICK INSTANT TRIGGER:
                    // If user clicks on the floating ball, trigger it immediately on the very first click!
                    if matches!(event_type, CGEventType::LeftMouseDown) {
                        let is_on_ball = {
                            if let Ok(st) = state_clone.lock() {
                                st.overlay_mode == "ball"
                            } else {
                                false
                            }
                        } && is_point_inside_overlay(&app_handle_clone, current_pos.0, current_pos.1);

                        if is_on_ball {
                            if let Ok(mut st) = state_clone.lock() {
                                st.overlay_mode = "card".to_string();
                            }
                            let _ = app_handle_clone.emit("trigger-ball", ());
                            return None;
                        }
                    }

                    let mut tr = match tracker_clone.lock() {
                        Ok(g) => g,
                        Err(_) => return None,
                    };

                    match event_type {
                        CGEventType::LeftMouseDown => {
                            tr.down_pos = Some(current_pos);
                            tr.down_time = Some(Instant::now());
                            tr.last_pos = current_pos;
                        }
                        CGEventType::LeftMouseDragged => {
                            tr.last_pos = current_pos;
                        }
                        CGEventType::LeftMouseUp => {
                            let release_pos = current_pos;
                            let now = Instant::now();

                            let is_drag = if let (Some((dx, dy)), Some(dt)) = (tr.down_pos, tr.down_time) {
                                let dist = ((release_pos.0 - dx).powi(2) + (release_pos.1 - dy).powi(2)).sqrt();
                                dist > 10.0 && now.duration_since(dt) < Duration::from_secs(10)
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
                                // Single click: if clicked outside overlay, user unselected text -> dismiss overlay!
                                if !is_point_inside_overlay(&app_handle_clone, release_pos.0, release_pos.1) {
                                    let _ = dismiss_overlay_window(&app_handle_clone);
                                }
                                return None;
                            }

                            trigger_selection_check(release_pos.0, release_pos.1, &app_handle_clone, &state_clone);
                        }
                        CGEventType::KeyUp => {
                            let keycode = cg_event.get_integer_value_field(9); // KEYBOARD_EVENT_KEYCODE
                            let flags = cg_event.get_flags();

                            let is_arrow = (123..=126).contains(&keycode);
                            let has_shift = flags.contains(CGEventFlags::CGEventFlagShift);
                            let has_cmd = flags.contains(CGEventFlags::CGEventFlagCommand);

                            if is_arrow && has_shift {
                                // Shift + Arrow keys (or Cmd+Shift+Arrow / Option+Shift+Arrow): extending text selection
                                let live_loc = get_live_cursor_location();
                                let pos = if live_loc != (0.0, 0.0) {
                                    live_loc
                                } else if tr.last_pos != (0.0, 0.0) {
                                    tr.last_pos
                                } else {
                                    current_pos
                                };
                                tr.last_pos = pos;
                                trigger_selection_check(pos.0, pos.1, &app_handle_clone, &state_clone);
                            } else if keycode == 0 && has_cmd {
                                // Cmd + A: Select All text
                                let live_loc = get_live_cursor_location();
                                let pos = if live_loc != (0.0, 0.0) {
                                    live_loc
                                } else if tr.last_pos != (0.0, 0.0) {
                                    tr.last_pos
                                } else {
                                    current_pos
                                };
                                tr.last_pos = pos;
                                trigger_selection_check(pos.0, pos.1, &app_handle_clone, &state_clone);
                            } else if (is_arrow && !has_shift) || keycode == 53 {
                                // Plain arrow key or Escape without Shift clears selection -> dismiss overlay!
                                let _ = dismiss_overlay_window(&app_handle_clone);
                            }
                        }
                        _ => {}
                    }

                    None
                }
            );

            match tap_res {
                Ok(t) => {
                    let raw_ref = t.mach_port.as_concrete_TypeRef() as usize;
                    mach_port_holder.store(raw_ref, Ordering::SeqCst);
                    break t;
                }
                Err(e) => {
                    eprintln!("[SelectCheck] CGEventTap::new failed ({:?}), retrying...", e);
                    thread::sleep(Duration::from_millis(1500));
                }
            }
        };

        let current_rl = CFRunLoop::get_current();
        if let Ok(source) = tap.mach_port.create_runloop_source(0) {
            current_rl.add_source(&source, unsafe { kCFRunLoopCommonModes });
            tap.enable();
            eprintln!("[SelectCheck] CGEventTap active and listening.");
            CFRunLoop::run_current();
        }
    });
}

/// Windows / Linux fallback listener using rdev
#[cfg(not(target_os = "macos"))]
pub fn start_selection_listener(app_handle: AppHandle, state: SharedState) {
    let tracker = Arc::new(Mutex::new(MouseTracker::default()));

    thread::spawn(move || {
        let tracker_clone = Arc::clone(&tracker);
        let app_handle_clone = app_handle.clone();
        let state_clone = Arc::clone(&state);

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
                        dist > 10.0 && now.duration_since(dt) < Duration::from_secs(10)
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
                        if !is_point_inside_overlay(&app_handle_clone, release_pos.0, release_pos.1) {
                            let _ = dismiss_overlay_window(&app_handle_clone);
                        }
                        return;
                    }

                    trigger_selection_check(release_pos.0, release_pos.1, &app_handle_clone, &state_clone);
                }
                EventType::KeyRelease(key) => {
                    match key {
                        RdevKey::Escape => {
                            let _ = dismiss_overlay_window(&app_handle_clone);
                        }
                        RdevKey::LeftArrow | RdevKey::RightArrow | RdevKey::UpArrow | RdevKey::DownArrow => {
                            let (x, y) = tr.last_pos;
                            trigger_selection_check(x, y, &app_handle_clone, &state_clone);
                        }
                        _ => {}
                    }
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

    #[test]
    fn test_clamp_to_monitor_multi_display() {
        use crate::overlay::{clamp_to_monitor, MonitorBounds};

        // Primary display (0, 0, 1440, 900)
        let primary = MonitorBounds {
            origin_x: 0.0,
            origin_y: 0.0,
            width: 1440.0,
            height: 900.0,
            scale_factor: 2.0,
        };
        let (px, py) = clamp_to_monitor(200.0, 300.0, 48.0, 48.0, &primary);
        assert_eq!((px, py), (200.0, 300.0));

        // External display to the right (1440, 0, 1920, 1080)
        let ext_right = MonitorBounds {
            origin_x: 1440.0,
            origin_y: 0.0,
            width: 1920.0,
            height: 1080.0,
            scale_factor: 1.0,
        };
        let (rx, ry) = clamp_to_monitor(2500.0, 500.0, 48.0, 48.0, &ext_right);
        assert_eq!((rx, ry), (2500.0, 500.0));

        // External display to the left (-1920, 0, 1920, 1080)
        let ext_left = MonitorBounds {
            origin_x: -1920.0,
            origin_y: 0.0,
            width: 1920.0,
            height: 1080.0,
            scale_factor: 1.0,
        };
        let (lx, ly) = clamp_to_monitor(-500.0, 400.0, 48.0, 48.0, &ext_left);
        assert_eq!((lx, ly), (-500.0, 400.0));

        // External display above (0, -1080, 1920, 1080)
        let ext_above = MonitorBounds {
            origin_x: 0.0,
            origin_y: -1080.0,
            width: 1920.0,
            height: 1080.0,
            scale_factor: 1.0,
        };
        let (ax, ay) = clamp_to_monitor(500.0, -300.0, 48.0, 48.0, &ext_above);
        assert_eq!((ax, ay), (500.0, -300.0));
    }

    #[test]
    fn test_selection_eligibility() {
        assert!(is_selection_eligible("Hello team, this is an update.", true));
        assert!(is_selection_eligible("grammer", true));
        assert!(!is_selection_eligible("12345", true));
        assert!(!is_selection_eligible("$49.99", true));
        assert!(!is_selection_eligible("const myVar = 10;", true));
        assert!(!is_selection_eligible("import React from 'react'", true));
        assert!(!is_selection_eligible("my_var_name", true));
        assert!(!is_selection_eligible("camelCaseVar", true));
        assert!(is_selection_eligible("const myVar = 10;", false));
    }
}
