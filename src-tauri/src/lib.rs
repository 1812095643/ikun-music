use serde::{Deserialize, Serialize};
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
use tauri::PhysicalSize;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Size,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

struct MusicApiChild {
    child: Child,
    port: u16,
}

struct MusicApiProcess(Mutex<Option<MusicApiChild>>);

#[derive(Clone, Copy)]
struct SavedMainWindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    is_maximized: bool,
}

// Tauri 主线以前进入精简模式后只会恢复到固定尺寸，用户原本手动调整过的窗口大小和位置都会丢。
// 这里单独保存“进入精简模式前”的主窗口几何信息，保证缩放播放列表时不覆盖，恢复时再一次性还原。
struct MiniWindowRestoreState(Mutex<Option<SavedMainWindowState>>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteLocalFileRequest {
    path: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteTextFileRequest {
    path: String,
    content: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct SavedLyricWindowBounds {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_PANEL_WINDOW_LABEL: &str = "tray-panel";
const LYRIC_WINDOW_LABEL: &str = "lyric-window";
const TRAY_ID: &str = "ikun-music-tray";
const NORMAL_WINDOW_WIDTH: f64 = 1280.0;
const NORMAL_WINDOW_HEIGHT: f64 = 840.0;
// 与前端 MiniPlayBar 的 64px 顶栏和 330px 播放列表高度保持一致，
// 避免 Tauri 精简模式相比 Electron 多出空白区域，恢复时观感不一致。
const MINI_WINDOW_WIDTH: f64 = 340.0;
const MINI_WINDOW_HEIGHT: f64 = 64.0;
const MINI_PLAYLIST_WINDOW_WIDTH: f64 = 340.0;
const MINI_PLAYLIST_WINDOW_HEIGHT: f64 = 400.0;
const MINI_WINDOW_MARGIN: f64 = 20.0;
const LYRIC_WINDOW_WIDTH: f64 = 800.0;
const LYRIC_WINDOW_HEIGHT: f64 = 200.0;
const LYRIC_WINDOW_POSITION_MARGIN: i32 = 50;
const TRAY_PANEL_WIDTH: f64 = 336.0;
const TRAY_PANEL_HEIGHT: f64 = 492.0;
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
    let runtime_dir = std::env::temp_dir().join("ikun-music").join(format!(
        "music-api-runtime-{:016x}",
        embedded_runtime_hash()
    ));
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

fn remember_pre_mini_window_state(
    window: &WebviewWindow,
    restore_state: &MiniWindowRestoreState,
) -> Result<(), String> {
    let mut guard = restore_state
        .0
        .lock()
        .map_err(|_| "保存精简模式前窗口状态失败：状态锁已损坏".to_string())?;
    // 只在第一次进入精简模式时记录主窗口快照，避免迷你播放列表展开/收起时把原始窗口布局覆盖掉。
    if guard.is_some() {
        return Ok(());
    }

    let is_maximized = window
        .is_maximized()
        .map_err(|error| format!("读取主窗口最大化状态失败：{error}"))?;

    // 如果当前处于最大化，先拿到退出最大化后的正常尺寸。
    // 否则从精简模式恢复后再次退出最大化，窗口会退回默认尺寸而不是用户原来的窗口大小。
    if is_maximized {
        window
            .unmaximize()
            .map_err(|error| format!("读取最大化前窗口尺寸失败：{error}"))?;
    }

    let size = window
        .inner_size()
        .map_err(|error| format!("读取主窗口尺寸失败：{error}"))?;
    let position = window
        .outer_position()
        .map_err(|error| format!("读取主窗口位置失败：{error}"))?;

    *guard = Some(SavedMainWindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
        is_maximized,
    });

    Ok(())
}

fn take_pre_mini_window_state(
    restore_state: &MiniWindowRestoreState,
) -> Result<Option<SavedMainWindowState>, String> {
    let mut guard = restore_state
        .0
        .lock()
        .map_err(|_| "读取精简模式前窗口状态失败：状态锁已损坏".to_string())?;
    Ok(guard.take())
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

fn show_normal_window(
    window: &WebviewWindow,
    restore_state: &MiniWindowRestoreState,
) -> Result<(), String> {
    let saved_state = take_pre_mini_window_state(restore_state)?;
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
    if saved_state.is_some() && window.is_maximized().unwrap_or(false) {
        window
            .unmaximize()
            .map_err(|error| format!("退出最大化状态失败：{error}"))?;
    }

    if let Some(saved_state) = saved_state {
        if saved_state.is_maximized {
            // 先恢复最大化前的正常尺寸和位置，再重新最大化，后续用户退出最大化时才能回到原来的布局。
            window
                .set_size(Size::Physical(PhysicalSize::new(
                    saved_state.width,
                    saved_state.height,
                )))
                .map_err(|error| format!("恢复最大化前窗口尺寸失败：{error}"))?;
            window
                .set_position(Position::Physical(PhysicalPosition::new(
                    saved_state.x,
                    saved_state.y,
                )))
                .map_err(|error| format!("恢复最大化前窗口位置失败：{error}"))?;
            window
                .maximize()
                .map_err(|error| format!("恢复主窗口最大化状态失败：{error}"))?;
        } else {
            window
                .set_size(Size::Physical(PhysicalSize::new(
                    saved_state.width,
                    saved_state.height,
                )))
                .map_err(|error| format!("恢复主窗口尺寸失败：{error}"))?;
            window
                .set_position(Position::Physical(PhysicalPosition::new(
                    saved_state.x,
                    saved_state.y,
                )))
                .map_err(|error| format!("恢复主窗口位置失败：{error}"))?;
        }
    }
    // 没有精简模式前快照时，说明这里只是普通主窗口的显示/隐藏切换。
    // Tauri 隐藏窗口后会保留当前几何信息和最大化状态，恢复时不应额外改写这些窗口状态。

    window
        .set_focus()
        .map_err(|error| format!("聚焦主窗口失败：{error}"))?;
    emit_mini_mode(window, false)
}

fn enter_mini_window(
    window: &WebviewWindow,
    restore_state: &MiniWindowRestoreState,
    show_playlist: bool,
) -> Result<(), String> {
    remember_pre_mini_window_state(window, restore_state)?;
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

fn emit_to_window(app: &AppHandle, label: &str, event: &str, payload: Value) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("没有找到 {label} 窗口，无法发送事件 {event}"))?;
    window
        .emit(event, payload)
        .map_err(|error| error.to_string())
}

fn show_main_window(app: &AppHandle, restore_state: &MiniWindowRestoreState) -> Result<(), String> {
    let window = main_window(app)?;
    show_normal_window(&window, restore_state)
}

fn lyric_window_bounds_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("解析桌面歌词窗口状态目录失败：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("创建桌面歌词窗口状态目录失败：{error}"))?;
    Ok(dir.join("lyric-window-bounds.json"))
}

fn is_valid_lyric_window_bounds(bounds: &SavedLyricWindowBounds) -> bool {
    (600..=1600).contains(&bounds.width) && (200..=800).contains(&bounds.height)
}

fn load_saved_lyric_window_bounds(app: &AppHandle) -> Option<SavedLyricWindowBounds> {
    let path = lyric_window_bounds_path(app).ok()?;
    let content = fs::read_to_string(path).ok()?;
    let bounds = serde_json::from_str::<SavedLyricWindowBounds>(&content).ok()?;
    if is_valid_lyric_window_bounds(&bounds) {
        Some(bounds)
    } else {
        None
    }
}

fn has_visible_monitor_for_lyric_bounds(
    window: &WebviewWindow,
    bounds: &SavedLyricWindowBounds,
) -> Result<bool, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| format!("读取桌面歌词窗口显示器列表失败：{error}"))?;

    if monitors.is_empty() {
        return Ok(true);
    }

    Ok(monitors.iter().any(|monitor| {
        let work_area = monitor.work_area();
        let min_x = work_area.position.x - LYRIC_WINDOW_POSITION_MARGIN;
        let max_x =
            work_area.position.x + work_area.size.width as i32 + LYRIC_WINDOW_POSITION_MARGIN;
        let min_y = work_area.position.y - LYRIC_WINDOW_POSITION_MARGIN;
        let max_y =
            work_area.position.y + work_area.size.height as i32 + LYRIC_WINDOW_POSITION_MARGIN;

        bounds.x >= min_x && bounds.x < max_x && bounds.y >= min_y && bounds.y < max_y
    }))
}

fn persist_lyric_window_bounds(window: &WebviewWindow) -> Result<(), String> {
    let size = window
        .inner_size()
        .map_err(|error| format!("读取桌面歌词窗口尺寸失败：{error}"))?;
    let position = window
        .outer_position()
        .map_err(|error| format!("读取桌面歌词窗口位置失败：{error}"))?;
    let bounds = SavedLyricWindowBounds {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
    };
    if !is_valid_lyric_window_bounds(&bounds) {
        return Ok(());
    }
    let path = lyric_window_bounds_path(&window.app_handle())?;
    let content = serde_json::to_string(&bounds)
        .map_err(|error| format!("序列化桌面歌词窗口状态失败：{error}"))?;
    fs::write(path, content).map_err(|error| format!("写入桌面歌词窗口状态失败：{error}"))
}

fn ensure_lyric_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app,
        LYRIC_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("ikun音乐桌面歌词")
    .inner_size(LYRIC_WINDOW_WIDTH, LYRIC_WINDOW_HEIGHT)
    .min_inner_size(600.0, 200.0)
    .decorations(false)
    .transparent(true)
    .resizable(true)
    .skip_taskbar(true)
    .always_on_top(true)
    .focused(false)
    .visible(false)
    .initialization_script("window.__IKUN_INITIAL_ROUTE__ = '/lyric';")
    .build()
    .map_err(|error| format!("创建桌面歌词窗口失败：{error}"))?;

    if let Some(bounds) = load_saved_lyric_window_bounds(app) {
        window
            .set_size(Size::Physical(PhysicalSize::new(
                bounds.width,
                bounds.height,
            )))
            .map_err(|error| format!("恢复桌面歌词窗口尺寸失败：{error}"))?;
        // 用户上次可能把歌词窗拖到副屏，后续副屏断开后旧坐标会落到屏幕外。
        // 位置失效时只重置位置，不丢弃用户上次调整过的窗口尺寸。
        if has_visible_monitor_for_lyric_bounds(&window, &bounds)? {
            window
                .set_position(Position::Physical(PhysicalPosition::new(
                    bounds.x, bounds.y,
                )))
                .map_err(|error| format!("恢复桌面歌词窗口位置失败：{error}"))?;
        } else {
            window
                .center()
                .map_err(|error| format!("校正桌面歌词窗口越界位置失败：{error}"))?;
        }
    } else {
        window
            .center()
            .map_err(|error| format!("初始化桌面歌词窗口位置失败：{error}"))?;
    }

    Ok(window)
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
    // 根因：托盘控制面板是独立 WebView，不能读取主窗口 Pinia/Howler 状态。
    // 之前用 app.emit 广播事件，窗口创建、监听绑定和广播时序不稳定，导致面板经常拿不到
    // 当前歌曲、进度和播放状态；按钮命令也可能没有被主窗口消费。这里改成定向通知主窗口：
    // 面板打开后由主窗口立刻回推状态到托盘窗口，形成稳定的主窗口单一真源。
    emit_to_window(
        app,
        MAIN_WINDOW_LABEL,
        "tray-panel-opened",
        json!({ "openedAt": chrono_free_timestamp() }),
    )
    .map_err(|error| format!("同步托盘控制面板状态失败：{error}"))
}

fn hide_tray_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

fn close_lyric_window_internal(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        let _ = persist_lyric_window_bounds(&window);
        let _ = emit_to_window(app, MAIN_WINDOW_LABEL, "lyric-control-back", json!("close"));
        window
            .close()
            .map_err(|error| format!("关闭桌面歌词窗口失败：{error}"))?;
    }

    Ok(())
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
    let status = if state.is_playing {
        "正在播放"
    } else {
        "已暂停"
    };

    format!(
        "ikun音乐 - {status}：{}",
        truncate_menu_text(&song_text, 64)
    )
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
                        let restore_state = app_handle.state::<MiniWindowRestoreState>();
                        let _ = show_main_window(&app_handle, &restore_state);
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
fn get_downloads_path(app: AppHandle) -> Result<String, String> {
    app.path()
        .download_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("读取系统下载目录失败：{error}"))
}

#[tauri::command]
fn write_local_file(request: WriteLocalFileRequest) -> Result<(), String> {
    let path = PathBuf::from(&request.path);
    if path.as_os_str().is_empty() {
        return Err("写入文件路径为空".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建下载目录失败：{error}"))?;
    }
    fs::write(&path, request.bytes).map_err(|error| format!("写入下载文件失败：{error}"))
}

#[tauri::command]
fn write_local_text_file(request: WriteTextFileRequest) -> Result<(), String> {
    let path = PathBuf::from(&request.path);
    if path.as_os_str().is_empty() {
        return Err("写入文本文件路径为空".to_string());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建文本文件目录失败：{error}"))?;
    }
    fs::write(&path, request.content).map_err(|error| format!("写入文本文件失败：{error}"))
}

#[tauri::command]
fn delete_local_file(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_file(&path).map_err(|error| format!("删除本地文件失败：{error}"))?;
    Ok(true)
}

#[tauri::command]
fn local_file_exists(path: String) -> bool {
    PathBuf::from(path).exists()
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
fn mini_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
) -> Result<(), String> {
    enter_mini_window(&window, &restore_state, false)
}

#[tauri::command]
fn resize_mini_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
    show_playlist: bool,
) -> Result<(), String> {
    enter_mini_window(&window, &restore_state, show_playlist)
}

#[tauri::command]
fn mini_tray(window: WebviewWindow) -> Result<(), String> {
    hide_to_tray(&window)
}

#[tauri::command]
fn restore_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
) -> Result<(), String> {
    show_normal_window(&window, &restore_state)
}

#[tauri::command]
fn open_lyric_window(app: AppHandle) -> Result<(), String> {
    let window = ensure_lyric_window(&app)?;

    if window.is_minimized().unwrap_or(false) {
        window
            .unminimize()
            .map_err(|error| format!("恢复桌面歌词窗口失败：{error}"))?;
    }

    window
        .set_always_on_top(true)
        .map_err(|error| format!("设置桌面歌词窗口置顶失败：{error}"))?;
    window
        .show()
        .map_err(|error| format!("显示桌面歌词窗口失败：{error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("聚焦桌面歌词窗口失败：{error}"))?;

    Ok(())
}

#[tauri::command]
fn close_lyric_window(app: AppHandle) -> Result<(), String> {
    close_lyric_window_internal(&app)
}

#[tauri::command]
fn set_lyric_ignore_mouse(app: AppHandle, ignore: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        window
            .set_ignore_cursor_events(ignore)
            .map_err(|error| format!("更新桌面歌词鼠标穿透状态失败：{error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn start_lyric_drag() {}

#[tauri::command]
fn end_lyric_drag(app: AppHandle) {
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        let _ = persist_lyric_window_bounds(&window);
    }
}

#[tauri::command]
fn move_lyric_window(app: AppHandle, delta_x: f64, delta_y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        let current_position = window
            .outer_position()
            .map_err(|error| format!("读取桌面歌词窗口位置失败：{error}"))?;
        let next_x = current_position.x + delta_x.round() as i32;
        let next_y = current_position.y + delta_y.round() as i32;

        window
            .set_position(Position::Physical(PhysicalPosition::new(next_x, next_y)))
            .map_err(|error| format!("移动桌面歌词窗口失败：{error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn emit_to_main(app: AppHandle, event: String, payload: Value) -> Result<(), String> {
    let target_label = match event.as_str() {
        "tray-panel-state" => TRAY_PANEL_WINDOW_LABEL,
        "receive-lyric" => LYRIC_WINDOW_LABEL,
        "tray-panel-command"
        | "tray-panel-opened"
        | "lyric-window-ready"
        | "lyric-window-closed"
        | "lyric-control-back" => MAIN_WINDOW_LABEL,
        _ => MAIN_WINDOW_LABEL,
    };
    emit_to_window(&app, target_label, &event, payload)
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
        .manage(MiniWindowRestoreState(Mutex::new(None)))
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
            get_downloads_path,
            write_local_file,
            write_local_text_file,
            delete_local_file,
            local_file_exists,
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
            open_lyric_window,
            close_lyric_window,
            set_lyric_ignore_mouse,
            start_lyric_drag,
            move_lyric_window,
            end_lyric_drag,
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

            if window.label() == LYRIC_WINDOW_LABEL {
                if matches!(event, WindowEvent::CloseRequested { .. }) {
                    // 根本原因：Tauri v2 的全局 on_window_event 回调给到的是通用 Window，
                    // 但桌面歌词窗口状态保存需要 WebviewWindow 才能复用现有的尺寸、位置和
                    // app 数据目录读取逻辑。这里不能直接把 Window 传进去，否则 release 打包
                    // 会在 Rust 编译阶段报类型不匹配；按窗口 label 重新拿 WebviewWindow 后再保存，
                    // 既保留关闭前持久化窗口几何状态的行为，也避免为通用 Window 复制一套保存逻辑。
                    if let Some(lyric_window) =
                        window.app_handle().get_webview_window(LYRIC_WINDOW_LABEL)
                    {
                        let _ = persist_lyric_window_bounds(&lyric_window);
                    }
                }

                if matches!(event, tauri::WindowEvent::Destroyed) {
                    let _ = emit_to_window(
                        &window.app_handle(),
                        MAIN_WINDOW_LABEL,
                        "lyric-window-closed",
                        json!({ "closedAt": chrono_free_timestamp() }),
                    );
                }
            }

            if window.label() == MAIN_WINDOW_LABEL && matches!(event, tauri::WindowEvent::Destroyed)
            {
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
