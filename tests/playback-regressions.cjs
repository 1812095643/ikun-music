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
const load = (filename, dependencies = {}, globals = {}) => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/renderer', filename), 'utf8').replaceAll('import.meta.hot', 'undefined');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require: (id) => {
      if (dependencies[id]) return dependencies[id];
      if (id.startsWith('.')) {
        const relative = path.join(path.dirname(filename), `${id}.ts`);
        if (fs.existsSync(path.join(__dirname, '..', 'src/renderer', relative))) return load(relative, dependencies, globals);
      }
      return require(id);
    },
    console: silent, setTimeout, clearTimeout, AbortController, AbortSignal, DOMException, atob, TextDecoder, URL, URLSearchParams,
    localStorage: storage, document: { title: '', createElement: () => ({ set innerHTML(text) { this.value=text; } }) }, navigator: {},
    window: { addEventListener() {}, dispatchEvent() {} }, CustomEvent: class {}, ...globals
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

test('native Kuwo transport preserves the full URL and actual audio format', async () => {
  const requested = [];
  const url = 'http://cdn.test/song.aac?bitrate$100&token=a=b';
  const { getKuwoMusicUrl } = load('api/kuwo.ts', {
    '@/utils': { isDesktopRuntime: true },
    '@/utils/downloadQuality': load('utils/downloadQuality.ts'),
    './externalMusicRequest': {
      requestExternalMusic: async (endpoint, options) => {
        requested.push({ endpoint, options });
        assert.equal(options.headers['User-Agent'], 'okhttp/3.10.0');
        return { statusCode: 200, body: `format=aac\r\nbitrate=100\r\nurl=${url}\r\nrid=95769\r\ntype=0` };
      },
      assertExternalOk: (response) => response.body
    },
    '@/services/musicService': { requestMusicService: async (route, data) => {
      assert.equal(route, '/desktop/kuwo-playback-request');
      assert.equal(data.id, '95769');
      assert.equal(data.quality, '320kmp3');
      return { status: 200, body: { url: 'https://nmobi.kuwo.cn/mobi.s?f=kuwo&q=test' } };
    } }
  }, { window: { desktop: { lxMusicHttpRequest: async (request) => {
    requested.push(request);
    return { statusCode: 200, body: `format=aac\r\nbitrate=100\r\nurl=${url}\r\nrid=95769\r\ntype=0` };
  }, lxMusicHttpCancel() {} } } });
  const result = await getKuwoMusicUrl(95769, 'high', new AbortController().signal);
  assert.equal(result.data.data.url, url);
  assert.equal(result.data.data.type, 'aac');
  assert.equal(requested.length, 1);
});

test('GD fallback uses an existing Netease identity without unrelated searches', async () => {
  const calls = [];
  const { parseFromGDMusic } = load('api/gdmusic.ts', {
    './externalMusicRequest': {
      requestExternalMusic: async (url) => { calls.push(new URL(url)); return { statusCode: 200, body: { url: 'https://audio.test/full.mp3', size: 5000000, br: 320 } }; },
      assertExternalOk: (response) => response.body
    }
  });
  assert.ok(await parseFromGDMusic(123, { ...song(123), source: 'netease' }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get('types'), 'url');
  assert.equal(calls[0].searchParams.get('id'), '123');
});

test('GD fallback refuses a different artist or live version', async () => {
  const calls = [];
  const { parseFromGDMusic } = load('api/gdmusic.ts', {
    './externalMusicRequest': {
      requestExternalMusic: async (url) => {
        calls.push(new URL(url));
        return { statusCode: 200, body: [
          { id: '1', name: 'Track', artist: ['Another artist'] },
          { id: '2', name: 'Track (Live)', artist: ['Singer'] }
        ] };
      },
      assertExternalOk: (response) => response.body
    }
  });
  assert.equal(await parseFromGDMusic(123, { ...song(123), name: 'Track', ar: [{ name: 'Singer' }] }), null);
  assert.ok(calls.every((url) => url.searchParams.get('types') === 'search'));
});

for (const cancel of [false, true]) {
  test(cancel ? 'pausing during fallback prevents late audio from starting' : 'a rejected audio stream falls back without changing track identity', async () => {
    setActivePinia(createPinia());
    const manager = load('services/playbackRequestManager.ts').playbackRequestManager;
    const fallback = deferred();
    const fallbackStarted = deferred();
    const played = [];
    let loads = 0;
    const sound = { state: () => 'loaded', duration: () => 320, stop() {}, unload() {} };
    const lyricStore = { requestVersion: 0, clearCandidates() { this.requestVersion++; }, setLoading() {}, setErrorMessage() {}, setCandidateResult() {} };
    const core = load('store/modules/playerCore.ts', {
      ...commonDependencies,
      '@/api/music': {},
      '@/hooks/usePlayerHooks': {
        useSongDetail: () => ({ getSongDetail: async (track) => ({ ...track, playMusicUrl: 'https://audio.test/short.mp3' }) }),
        getSongUrl: async (id, track, download, requestId, options) => {
          assert.equal(options.skipPrimarySource, true);
          assert.equal(track.source, 'kuwo');
          fallbackStarted.resolve();
          return fallback.promise;
        }
      },
      '@/services/audioService': { audioService: {
        getCurrentSound: () => null, on() {}, off() {}, pause() {},
        play: async (url, track) => { played.push({ url, id: track.id, source: track.source }); return sound; }
      } },
      '@/services/lyricCandidateService': { loadLyricCandidates: async () => ({ candidates: [], activeCandidate: null }) },
      '@/services/playbackRequestManager': { playbackRequestManager: manager },
      '@/services/preloadService': { preloadService: { cancel() {}, consume() {}, load: async () => {
        if (++loads === 1) throw new Error('duration mismatch');
        return sound;
      } } },
      '@/services/SongSourceConfigManager': { SongSourceConfigManager: { clearTriedSources() {} } },
      '@/utils/linearColor': { getImageLinearBackground: async () => ({}) },
      '@/utils/playbackCancellation': load('utils/playbackCancellation.ts'),
      './lyric': { useLyricStore: () => lyricStore },
      './playHistory': { usePlayHistoryStore: () => ({ addMusic() {} }) },
      './playlist': { usePlaylistStore: () => ({ playList: [] }) }
    }).usePlayerCoreStore();
    const task = core.handlePlayMusic(song(95769));
    await fallbackStarted.promise;
    if (cancel) await core.handlePause();
    fallback.resolve('https://audio.test/full.mp3');
    assert.equal(await task, !cancel);
    if (cancel) { assert.equal(played.length, 0); assert.equal(loads, 1); }
    else {
      assert.deepEqual(played, [{ url: 'https://audio.test/full.mp3', id: 95769, source: 'kuwo' }]);
      assert.equal(core.playMusicUrl, 'https://audio.test/full.mp3');
      assert.equal(core.isPlay, true);
    }
    await core.handlePause();
    core.$dispose();
  });
}

test('media transport failure falls back to direct audio and releases its lease', async () => {
  const attempts = [];
  const released = [];
  class TestHowl {
    constructor(options) { this.options = options; this._state = 'loading'; }
    load() {
      setTimeout(() => {
        if (this.options.src[0].includes('musicstream')) this.options.onloaderror(0, 4);
        else { this._state = 'loaded'; this.options.onload(); }
      }, 0);
      return this;
    }
    state() { return this._state; }
    duration() { return 320; }
    unload() { this._state = 'unloaded'; return this; }
  }
  const { preloadService } = load('services/preloadService.ts', {
    howler: { Howl: TestHowl, Howler: { _html5AudioPool: [] } },
    './audioTransport': { prepareAudioTransport: async (url, direct) => {
      attempts.push(direct);
      return { url: direct ? url : 'http://musicstream.localhost/test', release: () => released.push(direct) };
    } }
  });
  const sound = await preloadService.load({ ...song(1), dt: 320000, playMusicUrl: 'https://audio.test/full.mp3' });
  assert.deepEqual(attempts, [false, true]);
  assert.deepEqual(released, [false]);
  assert.equal(sound.state(), 'loaded');
  preloadService.consume({ ...song(1), dt: 320000, playMusicUrl: 'https://audio.test/full.mp3' });
  sound.unload();
  assert.deepEqual(released, [false, true]);
});

test('cancelling an audio load releases native media without trying direct playback', async () => {
  const began = deferred();
  let released = 0, prepared = 0;
  class TestHowl {
    constructor(options) { this.options = options; }
    load() { began.resolve(); return this; }
    unload() { return this; }
  }
  const { preloadService } = load('services/preloadService.ts', {
    howler: { Howl: TestHowl, Howler: { _html5AudioPool: [] } },
    './audioTransport': { prepareAudioTransport: async () => {
      prepared++;
      return { url: 'http://musicstream.localhost/test', release: () => released++ };
    } }
  });
  const task = preloadService.load({ ...song(1), playMusicUrl: 'https://audio.test/full.mp3' });
  await began.promise;
  preloadService.cancel(1);
  await assert.rejects(task, { name: 'AbortError' });
  assert.equal(prepared, 1);
  assert.equal(released, 1);
});

const playbackModes = load('../shared/playbackMode.ts');
const modeCases = [
  { mode: 'single', desktop: 4, middle: null, last: null, only: null },
  { mode: 'repeat', desktop: 1, middle: 1, last: 2, only: 0 },
  { mode: 'sequence', desktop: 0, middle: 2, last: null, only: null },
  { mode: 'loop', desktop: 5, middle: 2, last: 0, only: 0 },
  { mode: 'shuffle', desktop: 2, middle: 2, last: 0, only: 0 }
];

function desktopQueue() {
  setActivePinia(createPinia());
  const starts = [];
  const core = {
    playMusic: song(0), userPlayIntent: true, isPlay: true,
    handlePlayMusic: async (track) => {
      core.playMusic = track;
      core.isPlay = true;
      starts.push(track.id);
      return true;
    },
    handlePause: async () => { core.isPlay = false; core.userPlayIntent = false; }
  };
  const playlist = load('store/modules/playlist.ts', {
    ...commonDependencies,
    '@/hooks/usePlayerHooks': { useSongDetail: () => ({}) },
    '@/services/preloadService': { preloadService: {} },
    '@/services/playbackRequestManager': load('services/playbackRequestManager.ts'),
    '@/utils/playerUtils': load('utils/playerUtils.ts'),
    './intelligenceMode': { useIntelligenceModeStore: () => ({ isIntelligenceMode: false }) },
    './playerCore': { usePlayerCoreStore: () => core },
    './sleepTimer': { useSleepTimerStore: () => ({ sleepTimer: { type: 'none' }, handleSongChange() {} }) }
  }).usePlaylistStore();
  return { playlist, core, starts };
}

function mobileQueue(saved = {}, resolve = async (id) => ({ url: `https://audio.test/${id}.mp3`, type: 'mp3' })) {
  const listeners = {};
  const starts = [];
  const audio = {
    src: '', currentTime: 0, duration: 180, paused: true, startTime: 0,
    play() {
      if (audio.paused) {
        starts.push({ id: audio.trackId, src: audio.src });
        audio.paused = false;
        listeners.play?.();
      }
    },
    pause() { audio.paused = true; listeners.pause?.(); },
    stop() { audio.paused = true; listeners.stop?.(); },
    seek(value) { audio.currentTime = value; },
    setNavigation(previous, next) { audio.navigation = { previous, next }; }
  };
  for (const name of ['Play', 'Pause', 'Stop', 'Ended', 'Error', 'Waiting', 'Canplay', 'TimeUpdate', 'Next', 'Prev', 'PlaybackIntent']) {
    audio[`on${name}`] = (handler) => { listeners[name.toLowerCase()] = handler; };
  }
  const vue = require('vue');
  const state = load('../../mobile/src/stores/player.ts', {
    '@/services/audioEngine': { createMusicAudio: () => audio },
    '@/services/musicApi': {
      createCancellation: () => new AbortController(),
      isCanceled: (error) => error.name === 'AbortError',
      loadLyrics: async () => [], previewMediaUrl: (url) => url, resolveTrack: resolve
    },
    './library': {
      downloadRecords: vue.shallowRef([]), readStorage: (key, fallback) => saved[key] ?? fallback,
      writeStorage(key, value) { saved[key] = value; }, recordPlayed() {}, toast() {}
    }
  });
  const ready = async () => { await wait(120); listeners.canplay?.(); };
  const end = () => { audio.paused = true; audio.currentTime = 180; listeners.ended?.(); };
  return { state, starts, audio, listeners, ready, end, saved };
}
const mobileSong = (id) => ({ id: String(id), title: `Track ${id}`, artist: 'Singer', album: '', cover: '', duration: 180 });

for (const item of modeCases) {
  for (const [size, index, expected] of [[3, 1, item.middle], [3, 2, item.last], [1, 0, item.only]]) {
    test(`desktop ${item.mode}: natural end at ${index}/${size}`, async () => {
      const { playlist, core, starts } = desktopQueue();
      playlist.playMode = item.desktop;
      playlist.playList = Array.from({ length: size }, (_, id) => song(id));
      playlist.playListIndex = index;
      core.playMusic = song(index);
      await playlist.handleTrackEnded();
      assert.deepEqual(starts, expected === null ? [] : [expected]);
      assert.equal(playlist.playListIndex, expected ?? index);
      assert.equal(core.isPlay, expected !== null);
      playlist.$dispose();
    });
    test(`mobile ${item.mode}: natural end at ${index}/${size}`, async () => {
      const { state, starts, ready, end, listeners, audio } = mobileQueue();
      state.queue.value = Array.from({ length: size }, (_, id) => mobileSong(id));
      state.mode.value = item.mode;
      state.requestTrack(index);
      await ready();
      starts.length = 0;
      end();
      listeners.ended();
      await ready();
      assert.deepEqual(starts.map((entry) => entry.id), expected === null ? [] : [String(expected)]);
      assert.equal(state.queueIndex.value, expected ?? index);
      assert.equal(state.playing.value, expected !== null);
      if (expected === null) {
        listeners.canplay();
        assert.equal(audio.paused, true);
        state.togglePlay();
        assert.equal(state.position.value, 0);
        assert.equal(audio.currentTime, 0);
        assert.equal(state.playing.value, true);
      }
    });
  }
  test(`${item.mode}: manual next and previous do not follow the end-of-track rule`, async () => {
    const { playlist, starts } = desktopQueue();
    playlist.playMode = item.desktop;
    playlist.playList = [song(0), song(1), song(2)];
    await playlist.nextPlay();
    await playlist.prevPlay();
    assert.deepEqual(starts, [1, 0]);
    playlist.$dispose();
    const { state, ready, listeners } = mobileQueue();
    state.queue.value = [mobileSong(0), mobileSong(1), mobileSong(2)];
    state.mode.value = item.mode;
    state.requestTrack(0);
    await ready();
    listeners.next();
    await ready();
    assert.equal(state.current.value.id, '1');
    listeners.prev();
    await ready();
    assert.equal(state.current.value.id, '0');
  });
}

test('mode cycle exposes exactly five choices and keeps legacy desktop values', () => {
  assert.equal(playbackModes.desktopPlaybackMode(0), 'sequence');
  assert.equal(playbackModes.desktopPlaybackMode(1), 'repeat');
  assert.equal(playbackModes.desktopPlaybackMode(2), 'shuffle');
  assert.equal(playbackModes.normalizePlaybackMode('unknown'), 'sequence');
  let mode = 'single';
  const visited = [];
  for (let i = 0; i < 5; i++) { visited.push(mode); mode = playbackModes.nextPlaybackMode(mode); }
  assert.deepEqual(visited, ['single', 'repeat', 'sequence', 'loop', 'shuffle']);
  assert.equal(mode, 'single');
  for (const value of visited) assert.equal(playbackModes.getQueueTarget(value, 0, 0, 'ended'), null);
});

test('desktop ignores an old end event while a user navigation is pending', async () => {
  const { playlist, core, starts } = desktopQueue();
  playlist.playList = [song(0), song(1), song(2)];
  const next = playlist.nextPlay();
  await playlist.handleTrackEnded();
  await next;
  assert.deepEqual(starts, [1]);
  core.userPlayIntent = false;
  await playlist.handleTrackEnded();
  assert.deepEqual(starts, [1]);
  playlist.$dispose();
});

test('desktop mode switches keep the playing identity and restore queue order', async () => {
  const { playlist, core, starts } = desktopQueue();
  playlist.playList = [song(0), song(1), song(2), { ...song(1), source: 'netease' }];
  playlist.playListIndex = 3;
  core.playMusic = playlist.playList[3];
  playlist.playMode = 5;
  await playlist.togglePlayMode();
  assert.equal(playlist.playMode, 2);
  assert.equal(playlist.playList[0].source, 'netease');
  assert.equal(new Set(playlist.playList.map((track) => `${track.source}:${track.id}`)).size, 4);
  await playlist.togglePlayMode();
  assert.equal(playlist.playMode, 4);
  assert.equal(playlist.playListIndex, 3);
  assert.deepEqual(starts, []);
  playlist.$dispose();
});

test('mobile shuffle visits every queued song before repeating and previous follows history', async () => {
  const { state, ready } = mobileQueue();
  const tracks = Array.from({ length: 5 }, (_, id) => mobileSong(id));
  state.playTracks(tracks, 2);
  await ready();
  state.setMode('shuffle');
  const visited = [state.current.value.id];
  for (let i = 1; i < 5; i++) {
    state.nextTrack(); await ready(); visited.push(state.current.value.id);
  }
  assert.equal(new Set(visited).size, 5);
  state.previousTrack(); await ready();
  assert.equal(state.current.value.id, visited[3]);
  state.setMode('sequence');
  assert.deepEqual(Array.from(state.queue.value, (track) => track.id), ['0', '1', '2', '3', '4']);
  assert.equal(state.queue.value[state.queueIndex.value].id, visited[3]);
});

test('mobile rapid navigation and late end notifications only start the final target', async () => {
  const { state, starts, ready, listeners } = mobileQueue();
  state.playTracks(Array.from({ length: 8 }, (_, id) => mobileSong(id)));
  await ready(); starts.length = 0;
  state.nextTrack(); state.nextTrack(); state.previousTrack(); state.nextTrack();
  listeners.ended();
  await ready();
  assert.equal(state.current.value.id, '2');
  assert.equal(state.queueIndex.value, 2);
  assert.deepEqual(starts, [{ id: '2', src: 'https://audio.test/2.mp3' }]);
});

test('mobile changing modes during URL resolution preserves the pending song identity', async () => {
  const first = deferred();
  let calls = 0;
  const { state, ready, starts } = mobileQueue({}, (id) => ++calls === 1 ? first.promise : Promise.resolve({ url: `https://audio.test/${id}.mp3`, type: 'mp3' }));
  state.playTracks([mobileSong(0), mobileSong(1), mobileSong(2)], 1);
  await wait(120);
  state.setMode('shuffle');
  first.resolve({ url: 'https://audio.test/obsolete.mp3', type: 'mp3' });
  await ready();
  assert.equal(state.current.value.id, '1');
  assert.equal(state.queue.value[state.queueIndex.value].id, '1');
  assert.deepEqual(starts, [{ id: '1', src: 'https://audio.test/1.mp3' }]);
});
