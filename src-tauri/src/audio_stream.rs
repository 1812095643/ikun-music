use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{
    http::{Request, Response},
    Manager,
};
use tauri_plugin_http::reqwest::{Client, Url};

const CHUNK_BYTES: u64 = 512 * 1024;

pub struct AudioStreams {
    client: Client,
    sources: Mutex<HashMap<String, Url>>,
}

impl Default for AudioStreams {
    fn default() -> Self {
        Self {
            client: Client::builder()
                .connect_timeout(Duration::from_secs(8))
                .timeout(Duration::from_secs(20))
                .user_agent("okhttp/3.10.0")
                .build()
                .expect("创建音频连接池失败"),
            sources: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn register_audio_stream(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, Arc<AudioStreams>>,
    url: String,
) -> Result<String, String> {
    if window.label() != "main" {
        return Err("请从主播放器打开音频".into());
    }
    let url = Url::parse(&url).map_err(|_| "音频地址格式不正确")?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("音频地址需要使用 HTTP 或 HTTPS".into());
    }
    let mut sources = state.sources.lock().map_err(|_| "音频通道忙")?;
    if sources.len() >= 64 {
        return Err("音频通道过多，请重试".into());
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let id = format!(
        "{:x}",
        Sha256::digest(format!("{url}:{nonce}:{}", sources.len()))
    );
    sources.insert(id.clone(), url);
    Ok(id)
}

#[tauri::command]
pub fn release_audio_stream(state: tauri::State<'_, Arc<AudioStreams>>, id: String) {
    if let Ok(mut sources) = state.sources.lock() {
        sources.remove(&id);
    }
}

fn response(status: u16, body: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Range")
        .header(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length",
        )
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap()
}

fn bounded_range(value: Option<&str>) -> Result<String, String> {
    let value = value.unwrap_or("bytes=0-");
    if value.contains(',') {
        return Err("暂不支持多个音频区间".into());
    }
    if let Some(suffix) = value.strip_prefix("bytes=-") {
        let length: u64 = suffix.parse().map_err(|_| "音频区间不正确")?;
        if length == 0 {
            return Err("音频区间为空".into());
        }
        return Ok(format!("bytes=-{}", length.min(CHUNK_BYTES)));
    }
    let range = http_range::HttpRange::parse(value, u64::MAX).map_err(|_| "音频区间不正确")?;
    let range = range.first().ok_or("音频区间为空")?;
    Ok(format!(
        "bytes={}-{}",
        range.start,
        range
            .start
            .saturating_add(range.length.min(CHUNK_BYTES) - 1)
    ))
}

impl AudioStreams {
    async fn read(&self, request: Request<Vec<u8>>) -> Result<Response<Vec<u8>>, String> {
        if request.method() == "OPTIONS" {
            return Ok(response(204, vec![]));
        }
        if !matches!(request.method().as_str(), "GET" | "HEAD") {
            return Ok(response(405, vec![]));
        }
        let id = request.uri().path().trim_start_matches('/');
        let url = self
            .sources
            .lock()
            .map_err(|_| "音频通道忙")?
            .get(id)
            .cloned();
        let Some(url) = url else {
            return Ok(response(404, vec![]));
        };
        let range = bounded_range(request.headers().get("Range").and_then(|h| h.to_str().ok()))?;
        let head = request.method() == "HEAD";
        let builder = if head {
            self.client.head(url)
        } else {
            self.client.get(url).header("Range", range)
        };
        let mut upstream = builder
            .header("Accept-Encoding", "identity")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = upstream.status().as_u16();
        if !(200..300).contains(&status) {
            return Ok(response(status, vec![]));
        }
        let headers = upstream.headers().clone();
        let mut body = Vec::new();
        // 按浏览器 Range 分段传输，不下载完整歌曲，也不把大音频经 JSON IPC 复制到 JS。
        while !head {
            let Some(chunk) = upstream.chunk().await.map_err(|e| e.to_string())? else {
                break;
            };
            if body.len() + chunk.len() > CHUNK_BYTES as usize {
                return Err("音源不支持分段读取".into());
            }
            body.extend_from_slice(&chunk);
        }
        let mut result = response(status, body);
        for name in [
            "content-type",
            "content-length",
            "content-range",
            "accept-ranges",
        ] {
            if let Some(value) = headers.get(name) {
                result.headers_mut().insert(name, value.clone());
            }
        }
        Ok(result)
    }
}

pub fn install(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(Arc::new(AudioStreams::default()))
        .register_asynchronous_uri_scheme_protocol("musicstream", |context, request, responder| {
            let state = context
                .app_handle()
                .state::<Arc<AudioStreams>>()
                .inner()
                .clone();
            tauri::async_runtime::spawn(async move {
                let result = state
                    .read(request)
                    .await
                    .unwrap_or_else(|_| response(502, vec![]));
                responder.respond(result);
            });
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn limits_streaming_without_changing_seek_start() {
        assert_eq!(bounded_range(None).unwrap(), "bytes=0-524287");
        assert_eq!(
            bounded_range(Some("bytes=8000000-")).unwrap(),
            "bytes=8000000-8524287"
        );
        assert_eq!(bounded_range(Some("bytes=10-20")).unwrap(), "bytes=10-20");
        assert_eq!(bounded_range(Some("bytes=-100")).unwrap(), "bytes=-100");
        assert!(bounded_range(Some("bytes=20-10")).is_err());
        assert!(bounded_range(Some("bytes=0-1,3-4")).is_err());
    }
}
