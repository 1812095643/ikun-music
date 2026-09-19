mod audio_stream;
mod downloads;
use audio_stream::{register_audio_stream, release_audio_stream};
#[cfg(not(mobile))]
mod music_service;
use downloads::{download_music_file, read_local_lyrics, DownloadManager};
#[cfg(not(mobile))]
mod updates;
#[cfg(not(mobile))]
use music_service::music_request;
#[cfg(not(mobile))]
use updates::{check_app_update, download_app_update, install_app_update};

#[cfg(mobile)]
#[tauri::command]
async fn music_request() -> Result<serde_json::Value, String> {
    Err("移动端请配置网络音乐服务".into())
}
#[cfg(mobile)]
#[tauri::command]
async fn check_app_update() -> Result<serde_json::Value, String> {
    Err("移动端请从发布页下载更新".into())
}
#[cfg(mobile)]
#[tauri::command]
async fn download_app_update() -> Result<serde_json::Value, String> {
    Err("移动端请从发布页下载更新".into())
}
#[cfg(mobile)]
#[tauri::command]
async fn install_app_update() -> Result<serde_json::Value, String> {
    Err("移动端请从发布页下载更新".into())
}
use serde::Deserialize;
#[cfg(not(mobile))]
use serde::Serialize;
use serde_json::{json, Value};
#[cfg(not(mobile))]
use std::fs;
#[cfg(not(mobile))]
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(not(mobile))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
#[cfg(not(mobile))]
use tauri::PhysicalSize;
use tauri::{AppHandle, Manager, WebviewWindow};
#[cfg(not(mobile))]
use tauri::{
    Emitter, LogicalPosition, LogicalSize, PhysicalPosition, Position, Size, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

#[cfg(not(mobile))]
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
#[cfg(not(mobile))]
struct MiniWindowRestoreState(Mutex<Option<SavedMainWindowState>>);

#[cfg(mobile)]
struct MiniWindowRestoreState(Mutex<Option<()>>);

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

#[cfg(not(mobile))]
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct SavedLyricWindowBounds {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[cfg(not(mobile))]
const MAIN_WINDOW_LABEL: &str = "main";
#[cfg(not(mobile))]
const TRAY_PANEL_WINDOW_LABEL: &str = "tray-panel";
#[cfg(not(mobile))]
const LYRIC_WINDOW_LABEL: &str = "lyric-window";
#[cfg(not(mobile))]
const TRAY_ID: &str = "ikun-music-tray";
// 与前端 MiniPlayBar 的封面、播放控制和进度区保持一致，避免原生窗口裁掉底部操作。
#[cfg(not(mobile))]
const MINI_WINDOW_WIDTH: f64 = 420.0;
#[cfg(not(mobile))]
const MINI_WINDOW_HEIGHT: f64 = 184.0;
#[cfg(not(mobile))]
const MINI_PLAYLIST_WINDOW_WIDTH: f64 = 420.0;
#[cfg(not(mobile))]
const MINI_PLAYLIST_WINDOW_HEIGHT: f64 = 460.0;
#[cfg(not(mobile))]
const MINI_WINDOW_MARGIN: f64 = 20.0;
#[cfg(not(mobile))]
const LYRIC_WINDOW_WIDTH: f64 = 800.0;
#[cfg(not(mobile))]
const LYRIC_WINDOW_HEIGHT: f64 = 200.0;
#[cfg(not(mobile))]
const LYRIC_WINDOW_POSITION_MARGIN: i32 = 50;
#[cfg(not(mobile))]
const TRAY_PANEL_WIDTH: f64 = 336.0;
#[cfg(not(mobile))]
const TRAY_PANEL_HEIGHT: f64 = 492.0;
#[cfg(not(mobile))]
const TRAY_PANEL_MARGIN: f64 = 12.0;

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

#[cfg(not(mobile))]
fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "没有找到主窗口，请重启应用后再试".to_string())
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn take_pre_mini_window_state(
    restore_state: &MiniWindowRestoreState,
) -> Result<Option<SavedMainWindowState>, String> {
    let mut guard = restore_state
        .0
        .lock()
        .map_err(|_| "读取精简模式前窗口状态失败：状态锁已损坏".to_string())?;
    Ok(guard.take())
}

#[cfg(not(mobile))]
fn emit_mini_mode(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .emit("mini-mode", enabled)
        .map_err(|error| format!("同步窗口模式失败：{error}"))
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn resize_window_for_mode(window: &WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(Size::Logical(LogicalSize { width, height }))
        .map_err(|error| format!("调整窗口尺寸失败：{error}"))
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn hide_to_tray(window: &WebviewWindow) -> Result<(), String> {
    window
        .set_always_on_top(false)
        .map_err(|error| format!("退出置顶状态失败：{error}"))?;
    emit_mini_mode(window, false)?;
    window
        .hide()
        .map_err(|error| format!("隐藏到系统托盘失败：{error}"))
}

#[cfg(not(mobile))]
fn emit_to_window(app: &AppHandle, label: &str, event: &str, payload: Value) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("没有找到 {label} 窗口，无法发送事件 {event}"))?;
    window
        .emit(event, payload)
        .map_err(|error| error.to_string())
}

#[cfg(not(mobile))]
fn show_main_window(app: &AppHandle, restore_state: &MiniWindowRestoreState) -> Result<(), String> {
    let window = main_window(app)?;
    show_normal_window(&window, restore_state)
}

#[cfg(not(mobile))]
fn lyric_window_bounds_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("解析桌面歌词窗口状态目录失败：{error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("创建桌面歌词窗口状态目录失败：{error}"))?;
    Ok(dir.join("lyric-window-bounds.json"))
}

#[cfg(not(mobile))]
fn is_valid_lyric_window_bounds(bounds: &SavedLyricWindowBounds) -> bool {
    (600..=1600).contains(&bounds.width) && (200..=800).contains(&bounds.height)
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn ensure_lyric_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    // 创建已移到后台线程；连续点击可能同时到达，必须串行检查/创建，避免重复 label。
    // 此锁只由后台创建路径持有，主线程事件回调不等待它。
    static CREATE_LOCK: Mutex<()> = Mutex::new(());
    let _creation = CREATE_LOCK
        .lock()
        .map_err(|_| "歌词窗口创建状态需要重启后恢复")?;
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
    // Windows 无装饰窗口默认阴影会附带 1px 白边；关闭它才能保持真正无边框、全透明。
    // 玻璃工具栏由 WebView 内部局部绘制，整窗不启用会遮住桌面的实体背景或材质。
    .shadow(false)
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

#[cfg(not(mobile))]
fn ensure_tray_panel_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    static CREATE_LOCK: Mutex<()> = Mutex::new(());
    let _creation = CREATE_LOCK
        .lock()
        .map_err(|_| "托盘面板创建状态需要重启后恢复")?;
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn hide_tray_panel(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_WINDOW_LABEL) {
        let _ = window.hide();
    }
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
fn chrono_free_timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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

#[cfg(not(mobile))]
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
                        // 根因：托盘回调运行在 Windows 消息线程，同步创建 WebView2 会
                        // 等待同一线程处理初始化消息，造成整个应用死锁。后台线程完成
                        // 创建和显示，回调立即返回，让消息循环继续处理主面板和歌词窗。
                        let app = app_handle.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            if let Err(error) = show_tray_panel(&app, position) {
                                eprintln!("打开托盘控制面板未完成：{error}");
                            }
                        });
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
    serde_json::from_str(include_str!("../../src/shared/defaultSettings.json"))
        .unwrap_or_else(|_| json!({}))
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
    #[cfg(mobile)]
    {
        let _ = app;
        return Ok(String::new());
    }

    #[cfg(not(mobile))]
    {
        let path = app
            .path()
            .download_dir()
            .map_err(|error| format!("读取系统下载目录失败：{error}"))?
            .join("ikun音乐");
        fs::create_dir_all(&path).map_err(|error| format!("创建音乐下载目录失败：{error}"))?;
        Ok(path.to_string_lossy().to_string())
    }
}

#[tauri::command]
fn write_local_file(request: WriteLocalFileRequest) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = request;
        return Err("Android 第一阶段暂不支持写入本地文件".to_string());
    }

    #[cfg(not(mobile))]
    {
        let path = PathBuf::from(&request.path);
        if path.as_os_str().is_empty() {
            return Err("写入文件路径为空".to_string());
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建下载目录失败：{error}"))?;
        }
        fs::write(&path, request.bytes).map_err(|error| format!("写入下载文件失败：{error}"))
    }
}

#[tauri::command]
fn write_local_text_file(request: WriteTextFileRequest) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = request;
        return Err("Android 第一阶段暂不支持写入本地文本文件".to_string());
    }

    #[cfg(not(mobile))]
    {
        let path = PathBuf::from(&request.path);
        if path.as_os_str().is_empty() {
            return Err("写入文本文件路径为空".to_string());
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建文本文件目录失败：{error}"))?;
        }
        fs::write(&path, request.content).map_err(|error| format!("写入文本文件失败：{error}"))
    }
}

#[tauri::command]
fn delete_local_file(path: String) -> Result<bool, String> {
    #[cfg(mobile)]
    {
        let _ = path;
        return Ok(false);
    }

    #[cfg(not(mobile))]
    {
        let path = PathBuf::from(path);
        if !path.exists() {
            return Ok(false);
        }
        fs::remove_file(&path).map_err(|error| format!("删除本地文件失败：{error}"))?;
        Ok(true)
    }
}

#[tauri::command]
fn local_file_exists(app: AppHandle, path: String) -> bool {
    #[cfg(mobile)]
    {
        let _ = (app, path);
        return false;
    }

    #[cfg(not(mobile))]
    {
        let path = PathBuf::from(path);
        let exists = path.is_file();
        if exists
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    matches!(
                        extension.to_ascii_lowercase().as_str(),
                        "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac"
                    )
                })
        {
            let _ = app.asset_protocol_scope().allow_file(&path);
        }
        exists
    }
}

#[tauri::command]
fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = window;
        return Ok(());
    }

    #[cfg(not(mobile))]
    {
        window.minimize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn maximize_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = window;
        return Ok(());
    }

    #[cfg(not(mobile))]
    {
        if window.is_maximized().map_err(|error| error.to_string())? {
            window.unmaximize().map_err(|error| error.to_string())
        } else {
            window.maximize().map_err(|error| error.to_string())
        }
    }
}

#[tauri::command]
fn close_window(window: WebviewWindow) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = window;
        return Ok(());
    }

    #[cfg(not(mobile))]
    {
        window.close().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    #[cfg(mobile)]
    {
        let _ = app;
        return;
    }

    #[cfg(not(mobile))]
    {
        app.exit(0);
    }
}

#[tauri::command]
fn hide_tray_panel_window(app: AppHandle) {
    #[cfg(mobile)]
    {
        let _ = app;
    }
    #[cfg(not(mobile))]
    hide_tray_panel(&app);
}

#[tauri::command]
fn start_drag(window: WebviewWindow) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = window;
        return Ok(());
    }
    #[cfg(not(mobile))]
    window.start_dragging().map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_size(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (window, width, height);
        return Ok(());
    }
    #[cfg(not(mobile))]
    resize_window_for_mode(&window, width, height)
}

#[tauri::command]
fn mini_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (window, restore_state);
        return Ok(());
    }
    #[cfg(not(mobile))]
    enter_mini_window(&window, &restore_state, false)
}

#[tauri::command]
fn resize_mini_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
    show_playlist: bool,
) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (window, restore_state, show_playlist);
        return Ok(());
    }
    #[cfg(not(mobile))]
    enter_mini_window(&window, &restore_state, show_playlist)
}

#[tauri::command]
fn mini_tray(window: WebviewWindow) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = window;
        return Ok(());
    }
    #[cfg(not(mobile))]
    hide_to_tray(&window)
}

#[tauri::command]
fn restore_window(
    window: WebviewWindow,
    restore_state: tauri::State<MiniWindowRestoreState>,
) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (window, restore_state);
        return Ok(());
    }
    #[cfg(not(mobile))]
    show_normal_window(&window, &restore_state)
}

#[tauri::command]
async fn open_lyric_window(app: AppHandle) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = app;
        return Ok(());
    }
    #[cfg(not(mobile))]
    {
        // 根因：同步 Tauri 命令在主线程处理 IPC，WebView2 创建又等待主线程消息，
        // 从而形成互相等待，表现为歌词打不开、所有面板卡死。必须保留 async 命令，
        // 并在阻塞线程创建窗口；不能改成 run_on_main_thread 或同步 block_on。
        tauri::async_runtime::spawn_blocking(move || {
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
        })
        .await
        .map_err(|error| format!("桌面歌词打开任务未完成：{error}"))?
    }
}

#[tauri::command]
fn close_lyric_window(app: AppHandle) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = app;
        return Ok(());
    }
    #[cfg(not(mobile))]
    close_lyric_window_internal(&app)
}

#[tauri::command]
fn set_lyric_ignore_mouse(app: AppHandle, ignore: bool) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (app, ignore);
        return Ok(());
    }
    #[cfg(not(mobile))]
    {
        if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
            window
                .set_ignore_cursor_events(ignore)
                .map_err(|error| format!("更新桌面歌词鼠标穿透状态失败：{error}"))?;
        }

        Ok(())
    }
}

#[tauri::command]
fn start_lyric_drag() {}

#[tauri::command]
fn end_lyric_drag(app: AppHandle) {
    #[cfg(mobile)]
    {
        let _ = app;
    }
    #[cfg(not(mobile))]
    if let Some(window) = app.get_webview_window(LYRIC_WINDOW_LABEL) {
        let _ = persist_lyric_window_bounds(&window);
    }
}

#[tauri::command]
fn move_lyric_window(app: AppHandle, delta_x: f64, delta_y: f64) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (app, delta_x, delta_y);
        return Ok(());
    }
    #[cfg(not(mobile))]
    {
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
}

#[tauri::command]
fn emit_to_main(app: AppHandle, event: String, payload: Value) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (app, event, payload);
        return Ok(());
    }
    #[cfg(not(mobile))]
    {
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
}

#[tauri::command]
fn update_tray_state(app: AppHandle, state: TrayState) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (app, state);
        return Ok(());
    }
    #[cfg(not(mobile))]
    {
        let tray = app
            .tray_by_id(TRAY_ID)
            .ok_or_else(|| "系统托盘尚未创建，请稍后再试".to_string())?;

        tray.set_tooltip(Some(tray_tooltip_text(&state)))
            .map_err(|error| format!("更新托盘提示失败：{error}"))?;

        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = audio_stream::install(tauri::Builder::default())
        .manage(MiniWindowRestoreState(Mutex::new(None)))
        .manage(DownloadManager::default())
        .setup(|app| {
            #[cfg(not(mobile))]
            {
                create_tray(app)?;
                app.manage(music_service::MusicService::default());
                app.manage(updates::UpdateManager::default());
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init());

    #[cfg(not(mobile))]
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    let builder = builder.plugin(tauri_plugin_http::init());

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_default_settings,
            register_audio_stream,
            release_audio_stream,
            get_platform,
            get_arch,
            get_downloads_path,
            download_music_file,
            read_local_lyrics,
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
            check_app_update,
            download_app_update,
            install_app_update,
            music_request
        ])
        .on_window_event(|window, event| {
            #[cfg(mobile)]
            {
                let _ = (window, event);
                return;
            }

            #[cfg(not(mobile))]
            {
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

                if window.label() == MAIN_WINDOW_LABEL
                    && matches!(event, tauri::WindowEvent::Destroyed)
                {
                    let app = window.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        app.state::<music_service::MusicService>().stop().await;
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用时发生错误");
}
