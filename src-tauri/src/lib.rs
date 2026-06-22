use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Size, WebviewWindow,
};

struct MusicApiProcess(Mutex<Option<Child>>);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAIN_WINDOW_LABEL: &str = "main";
const NORMAL_WINDOW_WIDTH: f64 = 1280.0;
const NORMAL_WINDOW_HEIGHT: f64 = 840.0;
const MINI_WINDOW_WIDTH: f64 = 360.0;
const MINI_WINDOW_HEIGHT: f64 = 120.0;
const MINI_PLAYLIST_WINDOW_WIDTH: f64 = 420.0;
const MINI_PLAYLIST_WINDOW_HEIGHT: f64 = 620.0;
const MINI_WINDOW_MARGIN: f64 = 20.0;

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "没有找到主窗口，请重启应用后再试".to_string())
}

fn emit_mini_mode(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .emit("mini-mode", enabled)
        .map_err(|error| format!("同步窗口模式失败：{error}"))
}

fn apply_mini_position(window: &WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|error| format!("读取显示器信息失败：{error}"))?;

    if let Some(monitor) = monitor {
        let work_area = monitor.work_area();
        let scale_factor = monitor.scale_factor();
        let logical_width = work_area.size.width as f64 / scale_factor;
        let logical_height = work_area.size.height as f64 / scale_factor;
        let logical_x = work_area.position.x as f64 / scale_factor;
        let logical_y = work_area.position.y as f64 / scale_factor;
        let x = logical_x + logical_width - width - MINI_WINDOW_MARGIN;
        let y = logical_y + logical_height - height - MINI_WINDOW_MARGIN;
        window
            .set_position(Position::Logical(LogicalPosition { x, y }))
            .map_err(|error| format!("移动精简窗口失败：{error}"))?;
    }

    Ok(())
}

fn resize_window_for_mode(window: &WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(Size::Logical(LogicalSize { width, height }))
        .map_err(|error| format!("调整窗口尺寸失败：{error}"))
}

fn show_normal_window(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(false)
        .map_err(|error| format!("恢复窗口置顶状态失败：{error}"))?;
    window
        .set_resizable(true)
        .map_err(|error| format!("恢复窗口缩放状态失败：{error}"))?;
    window
        .show()
        .map_err(|error| format!("显示主窗口失败：{error}"))?;
    if window.is_minimized().unwrap_or(false) {
        window
            .unminimize()
            .map_err(|error| format!("恢复最小化窗口失败：{error}"))?;
    }
    if window.is_maximized().unwrap_or(false) {
        window
            .unmaximize()
            .map_err(|error| format!("退出最大化状态失败：{error}"))?;
    }
    resize_window_for_mode(window, NORMAL_WINDOW_WIDTH, NORMAL_WINDOW_HEIGHT)?;
    window
        .center()
        .map_err(|error| format!("居中主窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦主窗口失败：{error}"))?;
    emit_mini_mode(window, false)
}

fn enter_mini_window(window: &WebviewWindow, show_playlist: bool) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window
            .unmaximize()
            .map_err(|error| format!("退出最大化状态失败：{error}"))?;
    }
    if window.is_minimized().unwrap_or(false) {
        window
            .unminimize()
            .map_err(|error| format!("恢复最小化窗口失败：{error}"))?;
    }
    window
        .show()
        .map_err(|error| format!("显示精简窗口失败：{error}"))?;
    window
        .set_resizable(false)
        .map_err(|error| format!("锁定精简窗口尺寸失败：{error}"))?;
    window
        .set_always_on_top(true)
        .map_err(|error| format!("设置精简窗口置顶失败：{error}"))?;

    let (width, height) = if show_playlist {
        (MINI_PLAYLIST_WINDOW_WIDTH, MINI_PLAYLIST_WINDOW_HEIGHT)
    } else {
        (MINI_WINDOW_WIDTH, MINI_WINDOW_HEIGHT)
    };
    resize_window_for_mode(window, width, height)?;
    apply_mini_position(window, width, height)?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦精简窗口失败：{error}"))?;
    emit_mini_mode(window, true)
}

fn hide_to_tray(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(false)
        .map_err(|error| format!("退出置顶状态失败：{error}"))?;
    emit_mini_mode(window, false)?;
    window
        .hide()
        .map_err(|error| format!("隐藏到系统托盘失败：{error}"))
}

fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    show_normal_window(&window)
}

fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let mini_item = MenuItem::with_id(app, "mini", "精简模式", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 ikun音乐", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show_item, &mini_item, &separator, &quit_item])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("没有找到应用图标，无法创建系统托盘")?;
    let app_handle = app.handle().clone();

    TrayIconBuilder::with_id("ikun-music-tray")
        .icon(icon)
        .tooltip("ikun音乐")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window(&app_handle);
            }
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
fn get_default_settings() -> Value {
    serde_json::from_str(include_str!("../../src/main/set.json")).unwrap_or_else(|_| json!({}))
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[tauri::command]
fn get_arch() -> String {
    std::env::consts::ARCH.to_string()
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn maximize_window(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn start_drag(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_size(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    resize_window_for_mode(&window, width, height)
}

#[tauri::command]
fn mini_window(window: WebviewWindow) -> Result<(), String> {
    enter_mini_window(&window, false)
}

#[tauri::command]
fn resize_mini_window(window: WebviewWindow, show_playlist: bool) -> Result<(), String> {
    enter_mini_window(&window, show_playlist)
}

#[tauri::command]
fn mini_tray(window: WebviewWindow) -> Result<(), String> {
    hide_to_tray(&window)
}

#[tauri::command]
fn restore_window(window: WebviewWindow) -> Result<(), String> {
    show_normal_window(&window)
}

#[tauri::command]
fn emit_to_main(app: AppHandle, event: String, payload: Value) -> Result<(), String> {
    app.emit(&event, payload).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_music_api(
    app: AppHandle,
    state: tauri::State<MusicApiProcess>,
    port: u16,
) -> Result<Value, String> {
    let mut process_guard = state.0.lock().map_err(|error| error.to_string())?;
    if let Some(child) = process_guard.as_mut() {
        if child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Ok(json!({ "port": port, "running": true }));
        }
    }

    let script_path = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?
        .join("bin")
        .join("alger-music-api.js");

    let fallback_script_path = std::env::current_dir()
        .map_err(|error| error.to_string())?
        .join("src-tauri")
        .join("bin")
        .join("alger-music-api.js");

    let resolved_script_path = if script_path.exists() {
        script_path
    } else {
        fallback_script_path
    };

    let mut command = Command::new("node");
    command
        .arg(resolved_script_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    // 根因：Windows GUI 程序启动 Node 后端时，默认可能给子进程分配控制台窗口，
    // 用户双击 exe 就会看到黑色 cmd 框。这里仅在 Windows 下使用 CREATE_NO_WINDOW，
    // 保持 stdout 管道读取 ready 消息不变，同时彻底隐藏后端子进程控制台。
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command
        .spawn()
        .map_err(|error| format!("启动音乐 API 子进程失败：{error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取音乐 API 子进程输出".to_string())?;
    let (ready_sender, ready_receiver) = mpsc::channel::<u16>();

    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                if value.get("type").and_then(Value::as_str) == Some("ready") {
                    if let Some(actual_port) = value.get("port").and_then(Value::as_u64) {
                        let _ = ready_sender.send(actual_port as u16);
                    }
                }
            }
        }
    });

    let actual_port = ready_receiver
        .recv_timeout(Duration::from_secs(30))
        .map_err(|_| "音乐 API 子进程启动超时".to_string())?;

    *process_guard = Some(child);
    Ok(json!({ "port": actual_port, "running": true }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MusicApiProcess(Mutex::new(None)))
        .setup(|app| {
            create_tray(app)?;
            let app_handle = app.handle().clone();
            let state = app.state::<MusicApiProcess>();
            let _ = start_music_api(app_handle, state, 30488);
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main_window(app);
            }
            "mini" => {
                if let Ok(window) = main_window(app) {
                    let _ = enter_mini_window(&window, false);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_default_settings,
            get_platform,
            get_arch,
            minimize_window,
            maximize_window,
            close_window,
            quit_app,
            start_drag,
            set_window_size,
            mini_window,
            resize_mini_window,
            mini_tray,
            restore_window,
            emit_to_main,
            start_music_api
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                {
                    let state = window.state::<MusicApiProcess>();
                    if let Ok(mut process_guard) = state.0.lock() {
                        if let Some(mut child) = process_guard.take() {
                            let _ = child.kill();
                        }
                    };
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
