use serde::Deserialize;
use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Cursor};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use zip::ZipArchive;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position,
    Size, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

struct MusicApiChild {
    child: Child,
    port: u16,
}

struct MusicApiProcess(Mutex<Option<MusicApiChild>>);

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_PANEL_WINDOW_LABEL: &str = "tray-panel";
const TRAY_ID: &str = "ikun-music-tray";
const NORMAL_WINDOW_WIDTH: f64 = 1280.0;
const NORMAL_WINDOW_HEIGHT: f64 = 840.0;
const MINI_WINDOW_WIDTH: f64 = 360.0;
const MINI_WINDOW_HEIGHT: f64 = 120.0;
const MINI_PLAYLIST_WINDOW_WIDTH: f64 = 420.0;
const MINI_PLAYLIST_WINDOW_HEIGHT: f64 = 620.0;
const MINI_WINDOW_MARGIN: f64 = 20.0;
const TRAY_PANEL_WIDTH: f64 = 336.0;
const TRAY_PANEL_HEIGHT: f64 = 438.0;
const TRAY_PANEL_MARGIN: f64 = 12.0;
const EMBEDDED_MUSIC_API_RUNTIME: &[u8] =
    include_bytes!("../embedded-runtime/music-api-runtime.zip");

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct TrayState {
    title: Option<String>,
    artist: Option<String>,
    is_playing: bool,
    has_song: bool,
    volume: f64,
    muted: bool,
}

impl Default for TrayState {
    fn default() -> Self {
        Self {
            title: None,
            artist: None,
            is_playing: false,
            has_song: false,
            volume: 1.0,
            muted: false,
        }
    }
}

fn embedded_runtime_hash() -> u64 {
    // 根因：旧逻辑按 exe 修改时间生成临时运行时目录。某些打包/复制场景下 exe 时间不变，
    // 会继续复用旧目录里的 alger-music-api.js，导致明明重新打包了，用户机器仍跑旧后端。
    // 这里直接对内置 zip 内容做轻量 FNV-1a 哈希；只要后端运行时内容变化，释放目录就变化。
    let mut hash = 0xcbf29ce484222325u64;
    for byte in EMBEDDED_MUSIC_API_RUNTIME {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
}

fn embedded_runtime_dir() -> Result<PathBuf, String> {
    let runtime_dir = std::env::temp_dir()
        .join("ikun-music")
        .join(format!("music-api-runtime-{:016x}", embedded_runtime_hash()));
    let node_file_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };

    if runtime_dir.join(node_file_name).exists()
        && runtime_dir.join("bin").join("alger-music-api.js").exists()
        && runtime_dir.join("node_modules").exists()
    {
        return Ok(runtime_dir);
    }

    if runtime_dir.exists() {
        fs::remove_dir_all(&runtime_dir)
            .map_err(|error| format!("清理旧音乐 API 运行时失败：{error}"))?;
    }
    fs::create_dir_all(&runtime_dir)
        .map_err(|error| format!("创建音乐 API 运行时目录失败：{error}"))?;

    let cursor = Cursor::new(EMBEDDED_MUSIC_API_RUNTIME);
    let mut archive =
        ZipArchive::new(cursor).map_err(|error| format!("读取内置音乐 API 运行时失败：{error}"))?;

    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("读取内置运行时文件失败：{error}"))?;
        let enclosed_path = file
            .enclosed_name()
            .ok_or_else(|| "内置运行时包含不安全路径，已停止释放".to_string())?;
        let out_path = runtime_dir.join(enclosed_path);

        if file.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|error| format!("创建运行时目录失败：{}，{error}", out_path.display()))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建运行时父目录失败：{}，{error}", parent.display()))?;
        }

        let mut out_file = File::create(&out_path)
            .map_err(|error| format!("释放运行时文件失败：{}，{error}", out_path.display()))?;
        std::io::copy(&mut file, &mut out_file)
            .map_err(|error| format!("写入运行时文件失败：{}，{error}", out_path.display()))?;
    }

    Ok(runtime_dir)
}

fn resolve_node_command(current_dir: &Path, exe_dir: &Path) -> PathBuf {
    let node_filename = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    let candidates = [
        exe_dir.join(node_filename),
        exe_dir.join("bin").join(node_filename),
        current_dir.join(node_filename),
        current_dir.join("bin").join(node_filename),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists())
        .unwrap_or_else(|| PathBuf::from(node_filename))
}

fn resolve_music_api_script(app: &AppHandle) -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let exe_dir = current_exe_dir().unwrap_or_else(|| current_dir.clone());
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;

    // 根因：完整便携版会把 JS 后端和 node_modules 放在 exe 同级目录，
    // 而 Tauri 的 resource_dir 在安装版和便携版下可能不一致。之前优先使用
    // resource_dir/bin，遇到资源目录存在脚本但没有 node_modules 时，Node 能启动但
    // require 依赖失败，前端表现就是首页无内容。这里先找“脚本同级上层带
    // node_modules”的位置，再退回到普通脚本路径。
    let candidates = [
        exe_dir.join("bin").join("alger-music-api.js"),
        current_dir
            .join("src-tauri")
            .join("bin")
            .join("alger-music-api.js"),
        resource_dir.join("bin").join("alger-music-api.js"),
    ];

    candidates
        .iter()
        .find(|script_path| {
            script_path.exists()
                && script_path
                    .parent()
                    .and_then(|parent| parent.parent())
                    .map(|root| root.join("node_modules").exists())
                    .unwrap_or(false)
        })
        .cloned()
        .or_else(|| {
            candidates
                .into_iter()
                .find(|script_path| script_path.exists())
        })
        .ok_or_else(|| {
            "找不到音乐 API 脚本，请确认 bin/alger-music-api.js 已随 exe 一起打包".to_string()
        })
}

fn resolve_music_api_runtime(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let runtime_dir = embedded_runtime_dir()?;
    let current_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let exe_dir = current_exe_dir().unwrap_or_else(|| current_dir.clone());
    let node_command = resolve_node_command(&runtime_dir, &runtime_dir);
    let script_path = runtime_dir.join("bin").join("alger-music-api.js");

    if node_command.exists() && script_path.exists() {
        return Ok((runtime_dir, node_command, script_path));
    }

    // 开发兜底：如果本地尚未生成内置运行时，仍允许 `tauri dev` 使用工程内脚本。
    let fallback_script = resolve_music_api_script(app)?;
    let fallback_node = resolve_node_command(&current_dir, &exe_dir);
    let fallback_root = fallback_script
        .parent()
        .and_then(|parent| parent.parent())
        .map(Path::to_path_buf)
        .unwrap_or(current_dir);

    Ok((fallback_root, fallback_node, fallback_script))
}

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

fn ensure_tray_panel_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_WINDOW_LABEL) {
        return Ok(window);
    }

    // 根因：Windows 原生托盘菜单只能显示系统样式的文字项，无法承载 QQ 音乐那种
    // 封面、播放进度、滑杆和图标按钮。这里创建一个独立的无边框置顶 WebView 小窗，
    // 右键托盘时按托盘坐标展示，前端仍复用真实播放器状态和控制命令。
    WebviewWindowBuilder::new(
        app,
        TRAY_PANEL_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("ikun音乐托盘控制")
    .inner_size(TRAY_PANEL_WIDTH, TRAY_PANEL_HEIGHT)
    .min_inner_size(TRAY_PANEL_WIDTH, TRAY_PANEL_HEIGHT)
    .max_inner_size(TRAY_PANEL_WIDTH, TRAY_PANEL_HEIGHT)
    .decorations(false)
    .resizable(false)
    .skip_taskbar(true)
    .always_on_top(true)
    .focused(false)
    .visible(false)
    .initialization_script("window.__IKUN_INITIAL_ROUTE__ = '/tray-panel';")
    .build()
    .map_err(|error| format!("创建托盘控制面板失败：{error}"))
}

fn tray_panel_position(
    app: &AppHandle,
    click_position: PhysicalPosition<f64>,
) -> Result<PhysicalPosition<i32>, String> {
    let monitor = app
        .monitor_from_point(click_position.x, click_position.y)
        .map_err(|error| format!("读取托盘所在屏幕失败：{error}"))?;

    let Some(monitor) = monitor else {
        return Ok(PhysicalPosition::new(
            (click_position.x - TRAY_PANEL_WIDTH / 2.0).round() as i32,
            (click_position.y - TRAY_PANEL_HEIGHT - TRAY_PANEL_MARGIN).round() as i32,
        ));
    };

    let work_area = monitor.work_area();
    let scale_factor = monitor.scale_factor();
    let panel_width = TRAY_PANEL_WIDTH * scale_factor;
    let panel_height = TRAY_PANEL_HEIGHT * scale_factor;
    let margin = TRAY_PANEL_MARGIN * scale_factor;
    let work_x = work_area.position.x as f64;
    let work_y = work_area.position.y as f64;
    let work_width = work_area.size.width as f64;
    let work_height = work_area.size.height as f64;
    let min_x = work_x + margin;
    let max_x = work_x + work_width - panel_width - margin;
    let min_y = work_y + margin;
    let max_y = work_y + work_height - panel_height - margin;
    let x = (click_position.x - panel_width / 2.0).clamp(min_x, max_x.max(min_x));
    let above_tray_y = click_position.y - panel_height - margin;
    let below_tray_y = click_position.y + margin;
    let y = if above_tray_y >= min_y {
        above_tray_y
    } else {
        below_tray_y.clamp(min_y, max_y.max(min_y))
    };

    Ok(PhysicalPosition::new(x.round() as i32, y.round() as i32))
}

fn show_tray_panel(app: &AppHandle, click_position: PhysicalPosition<f64>) -> Result<(), String> {
    let window = ensure_tray_panel_window(app)?;
    let target_position = tray_panel_position(app, click_position)?;

    window
        .set_position(Position::Physical(target_position))
        .map_err(|error| format!("移动托盘控制面板失败：{error}"))?;
    window
        .show()
        .map_err(|error| format!("显示托盘控制面板失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦托盘控制面板失败：{error}"))?;
    app
        .emit("tray-panel-opened", json!({ "openedAt": chrono_free_timestamp() }))
        .map_err(|error| format!("同步托盘控制面板状态失败：{error}"))
}

fn hide_tray_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn chrono_free_timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn truncate_menu_text(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let keep_chars = max_chars.saturating_sub(3);
    let mut text = trimmed.chars().take(keep_chars).collect::<String>();
    text.push_str("...");
    text
}

fn tray_tooltip_text(state: &TrayState) -> String {
    if !state.has_song {
        return "ikun音乐".to_string();
    }

    let title = state
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("未知歌曲");
    let artist = state
        .artist
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let song_text = artist
        .map(|artist| format!("{title} - {artist}"))
        .unwrap_or_else(|| title.to_string());
    let status = if state.is_playing { "正在播放" } else { "已暂停" };

    format!("ikun音乐 - {status}：{}", truncate_menu_text(&song_text, 64))
}

fn create_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("没有找到应用图标，无法创建系统托盘")?;
    let app_handle = app.handle().clone();

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("ikun音乐")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                position,
                button,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                match button {
                    MouseButton::Left => {
                        let _ = show_main_window(&app_handle);
                    }
                    MouseButton::Right => {
                        let _ = show_tray_panel(&app_handle, position);
                    }
                    _ => {}
                }
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
fn hide_tray_panel_window(app: AppHandle) {
    hide_tray_panel(&app);
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
fn update_tray_state(app: AppHandle, state: TrayState) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "系统托盘尚未创建，请稍后再试".to_string())?;

    tray.set_tooltip(Some(tray_tooltip_text(&state)))
        .map_err(|error| format!("更新托盘提示失败：{error}"))?;

    Ok(())
}

#[tauri::command]
fn start_music_api(
    app: AppHandle,
    state: tauri::State<MusicApiProcess>,
    port: u16,
) -> Result<Value, String> {
    let mut process_guard = state.0.lock().map_err(|error| error.to_string())?;
    if let Some(api_child) = process_guard.as_mut() {
        if api_child
            .child
            .try_wait()
            .map_err(|error| error.to_string())?
            .is_none()
        {
            return Ok(json!({ "port": api_child.port, "running": true }));
        }
    }

    let (runtime_dir, node_command, resolved_script_path) = resolve_music_api_runtime(&app)?;

    let mut command = Command::new(&node_command);
    command
        .arg(&resolved_script_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--host")
        .arg("127.0.0.1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&runtime_dir);

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
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法读取音乐 API 子进程错误输出".to_string())?;
    let (ready_sender, ready_receiver) = mpsc::channel::<u16>();
    let (error_sender, error_receiver) = mpsc::channel::<String>();

    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut ready_sent = false;
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                if value.get("type").and_then(Value::as_str) == Some("ready") {
                    if let Some(actual_port) = value.get("port").and_then(Value::as_u64) {
                        if !ready_sent {
                            let _ = ready_sender.send(actual_port as u16);
                            ready_sent = true;
                        }
                    }
                }
            }

            // 根因：内置的 netease-cloud-music-api-alger 会先输出普通文本
            // `server running @ http://127.0.0.1:30488`，随后包装脚本才输出 JSON ready。
            // Windows GUI 打包后 stdout 管道偶发只读到前一条文本，Rust 端如果只等 JSON
            // 会误判“音乐 API 子进程启动超时”，导致首页、搜索、播放全部请求 30488 失败。
            // 这里兼容普通文本启动日志，只要服务端已经监听端口，就立即通知前端可用。
            if let Some(port_text) = line.rsplit(':').next() {
                if line.contains("server running @") {
                    if let Ok(actual_port) = port_text.trim().parse::<u16>() {
                        if !ready_sent {
                            let _ = ready_sender.send(actual_port);
                            ready_sent = true;
                        }
                    }
                }
            }
        }
    });

    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            let _ = error_sender.send(line);
        }
    });

    let wait_started_at = Instant::now();
    let mut stderr_lines = Vec::new();
    let actual_port = loop {
        if let Ok(actual_port) = ready_receiver.try_recv() {
            break actual_port;
        }

        while let Ok(line) = error_receiver.try_recv() {
            stderr_lines.push(line);
            if stderr_lines.len() >= 5 {
                break;
            }
        }

        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            let detail = if stderr_lines.is_empty() {
                String::new()
            } else {
                format!("，错误输出：{}", stderr_lines.join(" | "))
            };
            return Err(format!(
                "音乐 API 子进程提前退出，退出状态：{}，Node 路径：{}，脚本路径：{}{}",
                status,
                node_command.display(),
                resolved_script_path.display(),
                detail
            ));
        }

        if wait_started_at.elapsed() >= Duration::from_secs(30) {
            let detail = if stderr_lines.is_empty() {
                String::new()
            } else {
                format!("，错误输出：{}", stderr_lines.join(" | "))
            };
            return Err(format!(
                "音乐 API 子进程启动超时，Node 路径：{}，脚本路径：{}{}",
                node_command.display(),
                resolved_script_path.display(),
                detail
            ));
        }

        thread::sleep(Duration::from_millis(100));
    };

    *process_guard = Some(MusicApiChild {
        child,
        port: actual_port,
    });
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
            hide_tray_panel_window,
            start_drag,
            set_window_size,
            mini_window,
            resize_mini_window,
            mini_tray,
            restore_window,
            emit_to_main,
            update_tray_state,
            start_music_api
        ])
        .on_window_event(|window, event| {
            if window.label() == TRAY_PANEL_WINDOW_LABEL {
                match event {
                    WindowEvent::Focused(false) => {
                        let _ = window.hide();
                    }
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                }
            }

            if matches!(event, tauri::WindowEvent::Destroyed) {
                {
                    let state = window.state::<MusicApiProcess>();
                    if let Ok(mut process_guard) = state.0.lock() {
                        if let Some(mut api_child) = process_guard.take() {
                            let _ = api_child.child.kill();
                        }
                    };
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
