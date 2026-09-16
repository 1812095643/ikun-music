const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { createPinia, setActivePinia } = require('pinia');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const silent = { log() {}, warn() {}, error() {}, info() {} };
const storage = { getItem: (key) => key === 'playProgress' ? JSON.stringify({ songId: 2, progress: 60 }) : null, setItem() {}, removeItem() {} };
const load = (filename, dependencies = {}) => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/renderer', filename), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require: (id) => dependencies[id] || require(id),
    console: silent, setTimeout, clearTimeout, AbortController, DOMException, atob, TextDecoder,
    localStorage: storage, document: { title: '', createElement: () => ({ set innerHTML(text) { this.value=text; } }) }, navigator: {},
    window: { addEventListener() {}, dispatchEvent() {} }, CustomEvent: class {}
  }, { filename });
  return module.exports;
};
const song = (id) => ({ id, name: `Track ${id}`, ar: [], al: {}, source: 'kuwo', count: 0, picUrl: '' });
const commonDependencies = {
  'naive-ui': { createDiscreteApi: () => ({ message: silent }) },
  '@/../i18n/renderer': { default: { global: { t: (text) => text } } },
  '@/utils': { isDesktopRuntime: false, isAndroidRuntime: true, getImgUrl: (url) => url }
};

test('rapid navigation preserves every click but only starts the final target', async () => {
  setActivePinia(createPinia());
  const starts = [];
  const core = { playMusic: song(0), userPlayIntent: true, handlePlayMusic: async (track) => { starts.push(track.id); return true; } };
  const manager = load('services/playbackRequestManager.ts').playbackRequestManager;
  const { usePlaylistStore } = load('store/modules/playlist.ts', {
    ...commonDependencies,
    '@/hooks/usePlayerHooks': { useSongDetail: () => ({}) },
    '@/services/preloadService': { preloadService: {} },
    '@/services/playbackRequestManager': { playbackRequestManager: manager },
    '@/utils/playerUtils': {},
    './intelligenceMode': {},
    './playerCore': { usePlayerCoreStore: () => core },
    './sleepTimer': { useSleepTimerStore: () => ({ handleSongChange() {} }) }
  });
  const playlist = usePlaylistStore();
  playlist.playList = Array.from({ length: 8 }, (_, i) => song(i));
  const tasks = [playlist.nextPlay(), playlist.nextPlay(), playlist.prevPlay(), playlist.nextPlay()];
  assert.equal(playlist.playListIndex, 2);
  await Promise.all(tasks);
  assert.deepEqual(starts, [2]);
  playlist.$dispose();
});

test('superseded URL resolution cannot clear or replace the newer playing song', async () => {
  setActivePinia(createPinia());
  const manager = load('services/playbackRequestManager.ts').playbackRequestManager;
  const first = deferred();
  const played = [];
  const sound = { state: () => 'loaded', duration: () => 60, stop() {}, unload() {} };
  const audio = {
    current: null,
    getCurrentSound() { return this.current; },
    stopAndUnloadCurrent: async () => { audio.current = null; },
    play: async (url, track, shouldPlay, position) => { assert.equal(position, 0); played.push({ url, id: track.id }); audio.current = sound; return sound; },
    on() {}, off() {}, pause() {}
  };
  const lyricStore = { requestVersion: 0, clearCandidates() { this.requestVersion++; }, setLoading() {}, setErrorMessage() {}, setCandidateResult() {} };
  const dependencies = {
    ...commonDependencies,
    '@/api/music': {},
    '@/hooks/usePlayerHooks': { useSongDetail: () => ({ getSongDetail: (track) => track.id === 1 ? first.promise : Promise.resolve({ ...track, playMusicUrl: `https://audio.test/${track.id}.mp3` }) }) },
    '@/services/audioService': { audioService: audio },
    '@/services/lyricCandidateService': { loadLyricCandidates: async () => ({ candidates: [], activeCandidate: null }) },
    '@/services/playbackRequestManager': { playbackRequestManager: manager },
    '@/services/preloadService': { preloadService: { cancel() {}, consume: () => sound, load: async () => sound } },
    '@/services/SongSourceConfigManager': { SongSourceConfigManager: { clearTriedSources() {} } },
    '@/utils/linearColor': { getImageLinearBackground: async () => ({}) },
    '@/utils/playbackCancellation': load('utils/playbackCancellation.ts'),
    './lyric': { useLyricStore: () => lyricStore },
    './playHistory': { usePlayHistoryStore: () => ({ addMusic() {} }) },
    './playlist': { usePlaylistStore: () => ({ playList: [] }) }
  };
  const core = load('store/modules/playerCore.ts', dependencies).usePlayerCoreStore();
  const old = core.handlePlayMusic(song(1));
  await wait(0);
  assert.equal(await core.handlePlayMusic(song(2)), true);
  first.reject(new Error('late failure'));
  assert.equal(await old, false);
  assert.equal(core.playMusic.id, 2);
  assert.equal(core.playMusicUrl, 'https://audio.test/2.mp3');
  assert.equal(core.isPlay, true);
  assert.deepEqual(played, [{ url: 'https://audio.test/2.mp3', id: 2 }]);
  await core.handlePause();
  core.$dispose();
});

test('new request cancels background work after earlier playback completed', () => {
  const manager = load('services/playbackRequestManager.ts').playbackRequestManager;
  const old = manager.createRequest(song(1));
  manager.completeRequest(old);
  const signal = manager.getAbortSignal(old);
  const current = manager.createRequest(song(2));
  assert.equal(signal.aborted, true);
  assert.equal(manager.isRequestValid(old), false);
  assert.equal(manager.isRequestValid(current), true);
});

test('local lyrics preserve timing and text when saved and parsed again', () => {
  const parser = load('utils/yrcParser.ts');
  const localUtils = load('utils/localMusicUtils.ts', {
    '@/types/localMusic': load('types/localMusic.ts'),
    '@/utils/yrcParser': parser,
    '@/utils/audioUrl': { createLocalAudioUrl: (value) => value }
  });
  const { lyricToLrc } = load('services/localLyricService.ts', {
    '@/utils': { isDesktopRuntime: false },
    '@/utils/audioUrl': {}
  });
  const text = lyricToLrc({ lrcTimeArray: [1.25, 59.9997], lrcArray: [
    { text: '\u7b2c\u4e00\u53e5' }, { text: 'Second line' }
  ] });
  assert.ok(text.includes('[01:00.000]Second line'));
  const parsed = localUtils.parseLrcToILyric(text);
  assert.deepEqual(Array.from(parsed.lrcTimeArray), [1.25, 60]);
  assert.equal(parsed.lrcArray[0].text, '\u7b2c\u4e00\u53e5');
});

test('Kuwo relative cover fields resolve to the album CDN', () => {
  const { mapKuwoSong } = load('api/kuwo.ts', {
    '@/utils': { isDesktopRuntime: false },
    '@/utils/downloadQuality': load('utils/downloadQuality.ts'),
    './externalMusicRequest': {}
  });
  const track = mapKuwoSong({ MUSICRID: 'MUSIC_10', NAME: 'Track', SONGNAME: 'Track (Live)', web_albumpic_short: '120/70/7/1924693394.jpg' });
  assert.equal(track.name, 'Track (Live)');
  assert.equal(track.picUrl, 'http://img1.kwcdn.kuwo.cn/star/albumcover/120/70/7/1924693394.jpg');
  assert.equal(track.al.picUrl, track.picUrl);
});

test('encoded lyric responses decode before LRC parsing', () => {
  const { decodeMaybeBase64 } = load('services/lyricCandidateService.ts', {
    '@/api/music': {}, '@/hooks/usePlayerHooks': {}, '@/utils': {}, '@/utils/audioUrl': {},
    '@/utils/localMusicUtils': {}, '@/utils/playbackCancellation': {}, '@/utils/request': {}
  });
  const text='[00:01.500]\u6d4b\u8bd5\u6b4c\u8bcd\n[00:02.000]Second line';
  assert.equal(decodeMaybeBase64(Buffer.from(text).toString('base64')), text);
  assert.equal(decodeMaybeBase64(text), text);
});
