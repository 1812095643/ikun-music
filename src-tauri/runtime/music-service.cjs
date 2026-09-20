#!/usr/bin/env node
const fs = require('fs');
// 第三方库在 import 阶段会打印默认 Cookie；关闭通用日志，避免凭据进入管道或磁盘。
console.log = console.info = console.debug = console.warn = console.error = () => {};
const readline = require('node:readline');
const os = require('os');
const path = require('path');

if (!fs.existsSync(path.resolve(os.tmpdir(), 'anonymous_token'))) {
  fs.writeFileSync(path.resolve(os.tmpdir(), 'anonymous_token'), '', 'utf-8');
}

// 依赖的调试输出可能包含 Cookie，协议只输出明确的请求结果，正常日志不写入 stdout。

const ALL_PLATFORMS = ['kuwo', 'migu', 'kugou', 'pyncmd'];
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
const METADATA_PARSE_CONCURRENCY = Math.min(8, Math.max(2, os.cpus().length));
const MAX_COVER_BYTES = 1024 * 1024;
const MIN_PLAYABLE_AUDIO_BYTES = 1024 * 1024;

function ensureDataStructure(data) {
  if (!data) return { name: '', artists: [], album: { name: '' } };
  if (data.name === undefined || data.name === null) data.name = '';
  if (!data.artists || !Array.isArray(data.artists)) {
    data.artists = data.ar && Array.isArray(data.ar) ? data.ar : [];
  }
  if (data.artists.length > 0) {
    data.artists = data.artists.map((artist) =>
      artist ? { name: artist.name || '' } : { name: '' }
    );
  }
  if (!data.album || typeof data.album !== 'object') {
    data.album = data.al && typeof data.al === 'object' ? data.al : { name: '' };
  }
  if (!data.album.name) data.album.name = '';
  return data;
}

function getResponseAudioSize(response) {
  const contentRange = String(response.headers?.['content-range'] || '');
  const rangeSize = Number(contentRange.split('/').pop());
  if (Number.isFinite(rangeSize) && rangeSize > 0) return rangeSize;

  const contentLength = Number(response.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;

  return 0;
}

async function assertPlayableAudioUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return;

  const response = await require('@unblockneteasemusic/server/src/request')('GET', url, {
    range: 'bytes=0-8191',
    'accept-encoding': 'identity'
  });
  const statusCode = Number(response.statusCode || 0);
  if (statusCode < 200 || statusCode > 299) {
    throw new Error(`播放地址探测失败：HTTP ${statusCode}`);
  }

  const audioSize = getResponseAudioSize(response);
  await response.body(true).catch(() => Buffer.alloc(0));

  if (audioSize > 0 && audioSize < MIN_PLAYABLE_AUDIO_BYTES) {
    throw new Error(`播放地址疑似试听或错误文件，大小仅 ${audioSize} 字节`);
  }
}

async function unblockMusic(id, songData, retryCount = 1, enabledPlatforms) {
  const filteredPlatforms = enabledPlatforms
    ? enabledPlatforms.filter((platform) => ALL_PLATFORMS.includes(platform))
    : ALL_PLATFORMS;
  const processedSongData = ensureDataStructure(songData);
  const parsedId = parseInt(String(id), 10);

  const retry = async (attempt) => {
    try {
      let lastError = null;
      // 根因：@unblockneteasemusic 默认并发抢最快音源，并且 NCM API 外层会缓存相同路由。
      // 这样酷我坏链或上一首歌的 POST 结果可能被复用，用户看到按钮进入暂停态却没有声音。
      // 这里在我们的胶水层逐个音源串行解析，并对每个候选 URL 做体积探测；小于 1MB 的
      // 试听/错误文件直接丢弃，继续尝试下一个音源。
      for (const platform of filteredPlatforms) {
        try {
          const data = await require('@unblockneteasemusic/server')(
            parsedId,
            [platform],
            processedSongData
          );
          await assertPlayableAudioUrl(data.url);
          return { data: { data, params: { id: parsedId, type: 'song' } } };
        } catch (error) {
          lastError = error;
          console.warn(
            `音源 ${platform} 解析或可播校验失败，继续尝试下一个音源。`,
            error instanceof Error ? error.message : error
          );
        }
      }

      throw lastError || new Error('没有可用音源');
    } catch (error) {
      if (attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        return retry(attempt + 1);
      }
      throw new Error(
        `音乐解析失败 (ID: ${id}): ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  };

  return retry(1);
}

function isSupportedFormat(ext) {
  return SUPPORTED_AUDIO_FORMATS.includes(ext.toLowerCase());
}

function extractTitleFromFilename(filePath) {
  const basename = path.basename(filePath);
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex > 0 ? basename.slice(0, dotIndex) : basename;
}

function extractCoverAsDataUrl(picture) {
  if (!picture) return null;
  try {
    if (picture.data.length > MAX_COVER_BYTES) return null;
    const mime = picture.format || 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(picture.data).toString('base64')}`;
  } catch {
    return null;
  }
}

function extractLyrics(lyrics) {
  if (!lyrics || lyrics.length === 0) return null;
  return lyrics[0]?.text || null;
}

async function scanMusicFiles(folderPath) {
  const results = [];
  if (!fs.existsSync(folderPath)) throw new Error(`文件夹不存在: ${folderPath}`);
  const stat = await fs.promises.stat(folderPath);
  if (!stat.isDirectory()) throw new Error(`路径不是文件夹: ${folderPath}`);
  async function walkDirectory(dirPath) {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) await walkDirectory(fullPath);
        else if (entry.isFile() && isSupportedFormat(path.extname(entry.name)))
          results.push(fullPath);
      }
    } catch (error) {
      console.error(`扫描目录失败: ${dirPath}`, error);
    }
  }
  await walkDirectory(folderPath);
  return results;
}

async function scanMusicFilesWithStats(folderPath) {
  const files = await scanMusicFiles(folderPath);
  const result = [];
  for (const filePath of files) {
    const stat = await fs.promises.stat(filePath);
    result.push({ path: filePath, modifiedTime: stat.mtimeMs });
  }
  return result;
}

async function parseMetadata(filePath) {
  const stat = await fs.promises.stat(filePath);
  const fallback = {
    filePath,
    title: extractTitleFromFilename(filePath),
    artist: '未知艺术家',
    album: '未知专辑',
    duration: 0,
    cover: null,
    lyrics: null,
    fileSize: stat.size,
    modifiedTime: stat.mtimeMs
  };
  try {
    const metadata = await require('music-metadata').parseFile(filePath);
    const { common, format } = metadata;
    return {
      filePath,
      title: common.title || fallback.title,
      artist: common.artist || fallback.artist,
      album: common.album || fallback.album,
      duration: format.duration ? Math.round(format.duration * 1000) : 0,
      cover: extractCoverAsDataUrl(common.picture?.[0]),
      lyrics: extractLyrics(common.lyrics),
      fileSize: fallback.fileSize,
      modifiedTime: fallback.modifiedTime
    };
  } catch (error) {
    console.error(`元数据解析失败，使用 fallback: ${filePath}`, error);
    return fallback;
  }
}

async function batchParseMetadata(filePaths) {
  if (!filePaths.length) return [];
  const results = new Array(filePaths.length);
  const workerCount = Math.min(METADATA_PARSE_CONCURRENCY, filePaths.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (index < filePaths.length) {
        const current = index;
        index += 1;
        results[current] = await parseMetadata(filePaths[current]);
      }
    })
  );
  return results;
}

// 路由来自原库真实模块目录，调用原库公开函数，保留 Cookie、加密及返回值语义。
const apiRoot = path.dirname(require.resolve('netease-cloud-music-api-alger/package.json'));
const routes = new Map(
  fs
    .readdirSync(path.join(apiRoot, 'module'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const name = file.slice(0, -3);
      return [
        ['daily_signin', 'fm_trash', 'personal_fm'].includes(name)
          ? '/' + name
          : '/' + name.replaceAll('_', '/'),
        name
      ];
    })
);

/** 根据已注册接口分发请求；仅返回原协议数据，不启动 HTTP 监听。 */
async function dispatch(message) {
  const query = { ...message.params, ...message.data };
  switch (message.path) {
    case '/desktop/health':
      return { status: 200, body: { running: true, transport: 'stdio', pid: process.pid } };
    case '/desktop/kuwo-playback-request': {
      const { createKuwoPlaybackRequest } = require('./kuwo-playback.cjs');
      const { encryptQuery } = require('@unblockneteasemusic/server/src/kwDES');
      return { status: 200, body: createKuwoPlaybackRequest(query.id, query.quality, encryptQuery) };
    }
    case '/desktop/scan-local-music': {
      const files = await scanMusicFiles(query.folderPath);
      return { status: 200, body: { files, count: files.length } };
    }
    case '/desktop/scan-local-music-with-stats': {
      const files = await scanMusicFilesWithStats(query.folderPath);
      return { status: 200, body: { files, count: files.length } };
    }
    case '/desktop/parse-local-music-metadata':
      if (!Array.isArray(query.filePaths)) throw new Error('请选择需要读取的音乐文件');
      return { status: 200, body: await batchParseMetadata(query.filePaths) };
    case '/desktop/unblock-music':
      return {
        status: 200,
        body: await unblockMusic(query.id, query.songData, 1, query.enabledSources)
      };
    default: {
      const name = routes.get(message.path);
      if (!name) return { status: 404, body: { code: 404, message: '该音乐接口不存在' } };
      const handler = require(path.join(apiRoot, 'module', name + '.js'));
      const { cookieToJson } = require(path.join(apiRoot, 'util'));
      const request = require(path.join(apiRoot, 'util/request'));
      return handler(
        {
          ...query,
          cookie: typeof query.cookie === 'string' ? cookieToJson(query.cookie) : query.cookie || {}
        },
        request
      );
    }
  }
}

// Node 新版 readline 把 Unicode 段落分隔符也视为换行；专辑简介、歌词中会真实出现。
// JSON 允许这些字符原样存在，但行协议必须转义，避免一条完整响应被拆成多个无效 JSON。
const output = (message) =>
  process.stdout.write(
    JSON.stringify(message).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + '\n'
  );
let pendingCount = 0;
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', async (line) => {
  let message;
  try {
    if (Buffer.byteLength(line) > 8 * 1024 * 1024) throw new Error('请求数据过大，请分批处理');
    message = JSON.parse(line);
    if (
      !Number.isSafeInteger(message.id) ||
      typeof message.path !== 'string' ||
      !['GET', 'POST'].includes(message.method) ||
      !message.path.startsWith('/')
    ) {
      throw new Error('音乐请求格式不完整');
    }
    if (pendingCount >= 32) throw new Error('音乐服务忙，请稍后重试');
    pendingCount++;
    try {
      const result = await dispatch(message);
      output({
        id: message.id,
        status: result.status || 200,
        body: result.body,
        cookies: result.cookie || []
      });
    } finally {
      pendingCount--;
    }
  } catch (error) {
    output({
      id: Number.isSafeInteger(message?.id) ? message.id : null,
      status: error.status || 500,
      body: error.body || { message: error.message || '音乐服务未完成请求，请重试' },
      cookies: error.cookie || []
    });
  }
});
// 父进程退出会关闭 stdin；即使被任务管理器结束也不遗留后台 Node。
input.on('close', () => process.exit(0));
process.stdin.on('error', () => process.exit(1));
output({ type: 'ready', protocol: 1 });
