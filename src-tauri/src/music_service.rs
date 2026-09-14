//! 应用私有音乐服务：Tauri 请求通过标准输入输出传递，不暴露本机 HTTP 端口。
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    process::Stdio,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::{oneshot, Mutex, Semaphore},
    time::timeout,
};

#[derive(Debug, Deserialize)]
pub struct MusicRequest {
    path: String,
    #[serde(default = "get_method")]
    method: String,
    #[serde(default)]
    params: Value,
    #[serde(default)]
    data: Value,
}
fn get_method() -> String {
    "GET".into()
}
type ResponseSender = oneshot::Sender<Result<Value, String>>;
struct Session {
    child: Mutex<Child>,
    input: Mutex<ChildStdin>,
    pending: Mutex<HashMap<u64, ResponseSender>>,
}
pub struct MusicService {
    session: Mutex<Option<Arc<Session>>>,
    next_id: AtomicU64,
    permits: Semaphore,
}
impl Default for MusicService {
    fn default() -> Self {
        Self {
            session: Mutex::new(None),
            next_id: AtomicU64::new(1),
            permits: Semaphore::new(24),
        }
    }
}

impl MusicService {
    async fn connect(&self, app: &AppHandle) -> Result<Arc<Session>, String> {
        let mut state = self.session.lock().await;
        if let Some(session) = state.as_ref() {
            if session
                .child
                .lock()
                .await
                .try_wait()
                .map_err(|e| e.to_string())?
                .is_none()
            {
                return Ok(session.clone());
            }
        }
        // 根因：Tauri 在 Windows 返回带 \\?\ 前缀的资源路径，Node 的入口 realpath
        // 会将它误解析为盘符目录并报 EISDIR，进程在握手前退出，首页所有接口均无法返回。
        // 使用已有 dunce 统一为 Node 可读取的绝对路径，安装版和便携版走同一处理。
        let runtime = dunce::canonicalize(runtime_directory(app)?)
            .map_err(|e| format!("音乐服务目录暂时无法读取，请重新解压完整程序包：{e}"))?;
        let node = runtime.join(if cfg!(windows) { "node.exe" } else { "node" });
        let data_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("music-service");
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        let data_dir = dunce::canonicalize(data_dir).map_err(|e| e.to_string())?;
        let mut command = Command::new(&node);
        command
            .arg(runtime.join("music-service.cjs"))
            .current_dir(&data_dir)
            .env("TMP", &data_dir)
            .env("TEMP", &data_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command
            .spawn()
            .map_err(|e| format!("音乐服务未能启动，请重新安装完整程序包：{e}"))?;
        let input = child.stdin.take().ok_or("音乐服务输入通道未就绪")?;
        let mut lines =
            BufReader::new(child.stdout.take().ok_or("音乐服务输出通道未就绪")?).lines();
        let ready = timeout(Duration::from_secs(20), lines.next_line())
            .await
            .map_err(|_| "音乐服务启动超时，请重试")?
            .map_err(|e| e.to_string())?
            .ok_or("音乐服务提前退出，请重新安装完整程序包")?;
        let ready: Value = serde_json::from_str(&ready).map_err(|_| "音乐服务握手格式不正确")?;
        if ready["type"] != "ready" || ready["protocol"] != 1 {
            return Err("音乐服务版本不匹配，请重新安装".into());
        }
        let session = Arc::new(Session {
            child: Mutex::new(child),
            input: Mutex::new(input),
            pending: Mutex::new(HashMap::new()),
        });
        let reader_session = Arc::downgrade(&session);
        tauri::async_runtime::spawn(async move {
            while let Ok(Some(line)) = lines.next_line().await {
                let Some(session) = reader_session.upgrade() else {
                    break;
                };
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if let Some(id) = value["id"].as_u64() {
                        if let Some(sender) = session.pending.lock().await.remove(&id) {
                            let _ = sender.send(Ok(value));
                        }
                    }
                }
            }
            if let Some(session) = reader_session.upgrade() {
                for (_, sender) in session.pending.lock().await.drain() {
                    let _ = sender.send(Err("音乐服务已断开，请重试".into()));
                }
            }
        });
        *state = Some(session.clone());
        Ok(session)
    }

    pub async fn request(&self, app: &AppHandle, request: MusicRequest) -> Result<Value, String> {
        if !request.path.starts_with('/')
            || request.path.contains('?')
            || !["GET", "POST"].contains(&request.method.as_str())
        {
            return Err("音乐请求路径或方法不正确".into());
        }
        let _permit = timeout(Duration::from_secs(15), self.permits.acquire())
            .await
            .map_err(|_| "音乐请求过多，请稍后重试")?
            .map_err(|e| e.to_string())?;
        let session = self.connect(app).await?;
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let payload = json!({ "id": id, "path": request.path, "method": request.method, "params": request.params, "data": request.data });
        // 新版 Node readline 也会按 Unicode 段落符分行，歌曲名/歌词的这些字符必须
        // 以 JSON 转义发送，避免完整请求在 Node 输入端被拆开；解码后内容保持原样。
        let mut bytes = serde_json::to_string(&payload)
            .map_err(|e| e.to_string())?
            .replace('\u{2028}', "\\u2028")
            .replace('\u{2029}', "\\u2029")
            .into_bytes();
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("音乐请求过大，请分批处理".into());
        }
        bytes.push(b'\n');
        let (sender, receiver) = oneshot::channel();
        session.pending.lock().await.insert(id, sender);
        let written = session.input.lock().await.write_all(&bytes).await;
        if written.is_err() {
            session.pending.lock().await.remove(&id);
            return Err("音乐服务写入中断，请重试".into());
        }
        let result = timeout(Duration::from_secs(60), receiver).await;
        session.pending.lock().await.remove(&id);
        result
            .map_err(|_| "音乐服务响应超时，请稍后重试")?
            .map_err(|_| "音乐服务已断开，请重试")?
    }
    pub async fn stop(&self) {
        if let Some(session) = self.session.lock().await.take() {
            let _ = session.child.lock().await.kill().await;
        }
    }
}

fn runtime_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates = vec![app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("runtime")];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("runtime"));
        }
    }
    #[cfg(debug_assertions)]
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("runtime-stage"));
    candidates
        .into_iter()
        .find(|dir| dir.join("music-service.cjs").is_file() && dir.join("node_modules").is_dir())
        .ok_or("音乐服务资源不完整，请从完整安装包安装或重新解压便携包".into())
}

#[tauri::command]
pub async fn music_request(
    app: AppHandle,
    state: tauri::State<'_, MusicService>,
    request: MusicRequest,
) -> Result<Value, String> {
    state.request(&app, request).await
}
