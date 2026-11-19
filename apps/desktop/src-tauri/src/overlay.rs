use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size};

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

            // Allow the overlay to move and float across all spaces and external displays seamlessly
            // NSWindowCollectionBehaviorCanJoinAllSpaces (1 << 0) | NSWindowCollectionBehaviorFullScreenAuxiliary (1 << 8)
            let behavior: usize = (1 << 0) | (1 << 8);
            let _: () = msg_send![ns_window, setCollectionBehavior: behavior];
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

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorBounds {
    pub origin_x: f64,
    pub origin_y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

pub fn get_monitor_for_point(app: &AppHandle, px: f64, py: f64) -> MonitorBounds {
    if let Ok(monitors) = app.available_monitors() {
        for monitor in &monitors {
            let scale = monitor.scale_factor();
            let mon_x = monitor.position().x as f64 / scale;
            let mon_y = monitor.position().y as f64 / scale;
            let mon_w = monitor.size().width as f64 / scale;
            let mon_h = monitor.size().height as f64 / scale;

            if px >= mon_x && px <= (mon_x + mon_w) && py >= mon_y && py <= (mon_y + mon_h) {
                return MonitorBounds {
                    origin_x: mon_x,
                    origin_y: mon_y,
                    width: mon_w,
                    height: mon_h,
                    scale_factor: scale,
                };
            }
        }

        // Fallback: Find closest monitor by distance to center
        let mut closest: Option<(f64, MonitorBounds)> = None;
        for monitor in monitors {
            let scale = monitor.scale_factor();
            let mon_x = monitor.position().x as f64 / scale;
            let mon_y = monitor.position().y as f64 / scale;
            let mon_w = monitor.size().width as f64 / scale;
            let mon_h = monitor.size().height as f64 / scale;

            let center_x = mon_x + mon_w / 2.0;
            let center_y = mon_y + mon_h / 2.0;
            let dist_sq = (px - center_x).powi(2) + (py - center_y).powi(2);

            if closest.as_ref().map(|(d, _)| dist_sq < *d).unwrap_or(true) {
                closest = Some((
                    dist_sq,
                    MonitorBounds {
                        origin_x: mon_x,
                        origin_y: mon_y,
                        width: mon_w,
                        height: mon_h,
                        scale_factor: scale,
                    },
                ));
            }
        }

        if let Some((_, bounds)) = closest {
            return bounds;
        }
    }

    if let Ok(Some(primary)) = app.primary_monitor() {
        let scale = primary.scale_factor();
        return MonitorBounds {
            origin_x: primary.position().x as f64 / scale,
            origin_y: primary.position().y as f64 / scale,
            width: primary.size().width as f64 / scale,
            height: primary.size().height as f64 / scale,
            scale_factor: scale,
        };
    }

    MonitorBounds {
        origin_x: 0.0,
        origin_y: 0.0,
        width: 1920.0,
        height: 1080.0,
        scale_factor: 1.0,
    }
}

pub fn clamp_to_monitor(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    bounds: &MonitorBounds,
) -> (f64, f64) {
    let min_x = bounds.origin_x + 12.0;
    let max_x = (bounds.origin_x + bounds.width - width - 12.0).max(min_x);
    let min_y = bounds.origin_y + 24.0;
    let max_y = (bounds.origin_y + bounds.height - height - 24.0).max(min_y);

    let clamped_x = x.clamp(min_x, max_x);
    let clamped_y = y.clamp(min_y, max_y);
    (clamped_x, clamped_y)
}

const BALL_SIZE: f64 = 48.0;
const CARD_WIDTH: f64 = 392.0;
const CARD_HEIGHT: f64 = 520.0;

pub fn show_ball_at(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        let bounds = get_monitor_for_point(app, x, y);
        let (clamped_x, clamped_y) =
            clamp_to_monitor(x, y, BALL_SIZE, BALL_SIZE, &bounds);

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

        let physical_pos = win.outer_position().unwrap_or_default();
        // Determine which monitor currently contains this window
        let bounds = {
            let mut found: Option<MonitorBounds> = None;
            if let Ok(monitors) = app.available_monitors() {
                for monitor in &monitors {
                    let m_pos = monitor.position();
                    let m_size = monitor.size();
                    if physical_pos.x >= m_pos.x
                        && physical_pos.x < (m_pos.x + m_size.width as i32)
                        && physical_pos.y >= m_pos.y
                        && physical_pos.y < (m_pos.y + m_size.height as i32)
                    {
                        let scale = monitor.scale_factor();
                        found = Some(MonitorBounds {
                            origin_x: m_pos.x as f64 / scale,
                            origin_y: m_pos.y as f64 / scale,
                            width: m_size.width as f64 / scale,
                            height: m_size.height as f64 / scale,
                            scale_factor: scale,
                        });
                        break;
                    }
                }
            }
            found.unwrap_or_else(|| {
                get_monitor_for_point(&app, physical_pos.x as f64, physical_pos.y as f64)
            })
        };

        let logical_x = physical_pos.x as f64 / bounds.scale_factor;
        let mut logical_y = physical_pos.y as f64 / bounds.scale_factor;

        // Smart flip: If near bottom of the monitor, flip card upwards so it stays completely in view
        if logical_y + CARD_HEIGHT > bounds.origin_y + bounds.height - 20.0 {
            logical_y = (logical_y - CARD_HEIGHT + BALL_SIZE).max(bounds.origin_y + 24.0);
        }

        let (clamped_x, clamped_y) =
            clamp_to_monitor(logical_x, logical_y, CARD_WIDTH, CARD_HEIGHT, &bounds);

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
            if let Ok(pos) = win.outer_position() {
                if let Ok(size) = win.outer_size() {
                    let scale = {
                        let mut found_scale = 1.0;
                        if let Ok(monitors) = app.available_monitors() {
                            for m in monitors {
                                let mp = m.position();
                                let ms = m.size();
                                if pos.x >= mp.x
                                    && pos.x < (mp.x + ms.width as i32)
                                    && pos.y >= mp.y
                                    && pos.y < (mp.y + ms.height as i32)
                                {
                                    found_scale = m.scale_factor();
                                    break;
                                }
                            }
                        }
                        found_scale
                    };

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
