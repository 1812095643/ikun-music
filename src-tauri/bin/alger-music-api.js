#!/usr/bin/env node
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const mm = require('music-metadata');
const request = require('@unblockneteasemusic/server/src/request');

if (!fs.existsSync(path.resolve(os.tmpdir(), 'anonymous_token'))) {
  fs.writeFileSync(path.resolve(os.tmpdir(), 'anonymous_token'), '', 'utf-8');
}

const { serveNcmApi, getModulesDefinitions } = require('netease-cloud-music-api-alger/server');
const match = require('@unblockneteasemusic/server');

const ALL_PLATFORMS = ['kuwo', 'migu', 'kugou', 'pyncmd'];
const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
const METADATA_PARSE_CONCURRENCY = Math.min(8, Math.max(2, os.cpus().length));
const MAX_COVER_BYTES = 1024 * 1024;
const MIN_PLAYABLE_AUDIO_BYTES = 1024 * 1024;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { port: 30488, host: '127.0.0.1' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--port') options.port = Number(args[index + 1] || options.port);
    if (arg === '--host') options.host = args[index + 1] || options.host;
  }
  return options;
}

function checkPortAvailable(port, host) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, host);
  });
}

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

  const response = await request('GET', url, {
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
          const data = await match(parsedId, [platform], processedSongData);
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
    const metadata = await mm.parseFile(filePath);
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

async function getDefaultModuleDefinitions() {
  const apiRoot = path.dirname(require.resolve('netease-cloud-music-api-alger/package.json'));
  return getModulesDefinitions(path.join(apiRoot, 'module'), {
    'daily_signin.js': '/daily_signin',
    'fm_trash.js': '/fm_trash',
    'personal_fm.js': '/personal_fm'
  });
}

async function main() {
  const options = parseArgs();
  let port = options.port;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await checkPortAvailable(port, options.host)) break;
    port += 1;
  }

  const customModuleDefs = [
    {
      route: '/alger-tauri/scan-local-music',
      module: async (query) => {
        const files = await scanMusicFiles(query.folderPath);
        return { status: 200, body: { files, count: files.length } };
      }
    },
    {
      route: '/alger-tauri/scan-local-music-with-stats',
      module: async (query) => {
        const files = await scanMusicFilesWithStats(query.folderPath);
        return { status: 200, body: { files, count: files.length } };
      }
    },
    {
      route: '/alger-tauri/parse-local-music-metadata',
      module: async (query) => {
        const metadata = await batchParseMetadata(query.filePaths || []);
        return { status: 200, body: metadata };
      }
    },
    {
      route: '/alger-tauri/unblock-music',
      module: async (query) => {
        const result = await unblockMusic(query.id, query.songData, 1, query.enabledSources);
        return { status: 200, body: { ...result, noCache: Date.now() } };
      }
    },
    ...(await getDefaultModuleDefinitions())
  ];

  const app = await serveNcmApi({
    port,
    host: options.host,
    checkVersion: false,
    moduleDefs: customModuleDefs
  });

  console.log(JSON.stringify({ type: 'ready', port }));

  const shutdown = () => {
    app.server?.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
