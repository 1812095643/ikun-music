use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

struct MusicApiProcess(Mutex<Option<Child>>);

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
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|error| error.to_string())
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
        if child.try_wait().map_err(|error| error.to_string())?.is_none() {
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

    let mut child = Command::new("node")
        .arg(resolved_script_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
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
            let app_handle = app.handle().clone();
            let state = app.state::<MusicApiProcess>();
            let _ = start_music_api(app_handle, state, 30488);
            Ok(())
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

