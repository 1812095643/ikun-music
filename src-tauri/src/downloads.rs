use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    path::PathBuf,
    time::{Duration, Instant, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tokio::{io::AsyncWriteExt, sync::Semaphore};

pub struct DownloadManager(Semaphore);

impl Default for DownloadManager {
    fn default() -> Self {
        Self(Semaphore::new(3))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    url: String,
    path: String,
    filename: String,
    download_key: String,
    quality: Option<String>,
    song_info: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLyricFile {
    file_path: String,
    lyric_path: String,
    lyrics: Option<String>,
    modified_time: u128,
}

#[tauri::command]
pub async fn download_music_file(
    app: AppHandle,
    manager: tauri::State<'_, DownloadManager>,
    request: DownloadRequest,
) -> Result<u64, String> {
    let _permit = manager
        .0
        .acquire()
        .await
        .map_err(|error| error.to_string())?;
    let url = tauri_plugin_http::reqwest::Url::parse(&request.url)
        .map_err(|_| "下载地址格式不正确，请重新获取歌曲地址".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("下载地址需要使用 HTTP 或 HTTPS".into());
    }
    let path = PathBuf::from(&request.path);
    if !path.is_absolute() {
        return Err("请先选择完整的下载目录".into());
    }
    let parent = path.parent().ok_or("下载目录暂时无法读取")?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("创建下载目录失败：{error}"))?;
    let temporary = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("下载目录暂时无法写入：{error}"))?;
    let mut file =
        tokio::fs::File::from_std(temporary.reopen().map_err(|error| error.to_string())?);
    let client = tauri_plugin_http::reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|error| error.to_string())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("下载连接未完成，请稍后重试：{error}"))?
        .error_for_status()
        .map_err(|error| format!("音乐地址暂时不可用：{error}"))?;
    let total = response.content_length().unwrap_or(0);
    let mut loaded = 0u64;
    let mut last_progress = Instant::now() - Duration::from_secs(1);

    // 音频在原生层分块写入，避免整首无损音乐转成 JS 数组后再经 IPC 复制，阻塞播放界面。
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("下载中断：{error}"))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("写入音乐文件失败：{error}"))?;
        loaded += chunk.len() as u64;
        if last_progress.elapsed() >= Duration::from_millis(200) {
            let progress = if total > 0 {
                (loaded as f64 / total as f64 * 100.0).min(99.0)
            } else {
                0.0
            };
            let _ = app.emit_to(
                "main",
                "music-download-progress",
                json!({
                    "filename": request.filename, "downloadKey": request.download_key,
                    "quality": request.quality, "songInfo": request.song_info,
                    "path": request.path, "loaded": loaded, "total": total,
                    "progress": progress, "status": "downloading"
                }),
            );
            last_progress = Instant::now();
        }
    }
    if loaded == 0 || (total > 0 && loaded != total) {
        return Err("音乐文件尚未下载完整，请重试".into());
    }
    file.flush().await.map_err(|error| error.to_string())?;
    drop(file);
    temporary
        .persist_noclobber(&path)
        .map_err(|error| format!("保存音乐文件失败：{error}"))?;
    Ok(loaded)
}

fn read_lyric_file(file_path: String, include_content: bool) -> LocalLyricFile {
    let lyric_path = PathBuf::from(&file_path).with_extension("lrc");
    let metadata = std::fs::metadata(&lyric_path).ok();
    let modified_time = metadata
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|time| time.as_millis())
        .unwrap_or(0);
    let lyrics = if include_content
        && metadata
            .as_ref()
            .is_some_and(|metadata| metadata.len() <= 2 * 1024 * 1024)
    {
        std::fs::read_to_string(&lyric_path)
            .ok()
            .map(|text| text.trim_start_matches('\u{feff}').to_string())
    } else {
        None
    };
    LocalLyricFile {
        file_path,
        lyric_path: lyric_path.to_string_lossy().to_string(),
        lyrics,
        modified_time,
    }
}

#[tauri::command]
pub async fn read_local_lyrics(
    file_paths: Vec<String>,
    include_content: bool,
) -> Result<Vec<LocalLyricFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        file_paths
            .into_iter()
            .map(|path| read_lyric_file(path, include_content))
            .collect()
    })
    .await
    .map_err(|error| format!("读取本地歌词未完成：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_matching_sidecar_and_strips_bom() {
        let folder = tempfile::tempdir().unwrap();
        let audio = folder.path().join("track.flac");
        std::fs::write(audio.with_extension("lrc"), "\u{feff}[00:01.00]歌词").unwrap();
        let result = read_lyric_file(audio.to_string_lossy().to_string(), true);
        assert_eq!(result.lyrics.as_deref(), Some("[00:01.00]歌词"));
        assert!(result.modified_time > 0);
    }

    #[test]
    fn missing_sidecar_keeps_audio_available() {
        let result = read_lyric_file("missing.flac".into(), true);
        assert!(result.lyrics.is_none());
        assert_eq!(result.modified_time, 0);
    }
}
