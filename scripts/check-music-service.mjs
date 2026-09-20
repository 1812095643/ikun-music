import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

const runtime = resolve(process.argv[2] || 'src-tauri/runtime-stage');
const cwd = await mkdtemp(join(tmpdir(), 'ikun-service-check-'));
const executable = process.argv.includes('--host-node')
  ? process.execPath
  : join(runtime, process.platform === 'win32' ? 'node.exe' : 'node');
const pending = new Map();
const child = spawn(executable, [join(runtime, 'music-service.cjs')], {
  cwd,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, TEMP: cwd, TMP: cwd }
});
let readyResolve;
let readyReject;
let requestId = 0;
const started = Date.now();
const ready = new Promise((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});
function fail(error) {
  readyReject(error);
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}
child.once('error', fail);
child.once('exit', (code) => fail(new Error(`Music service exited: ${code}`)));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));
const input = createInterface({ input: child.stdout });
input.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    if (response.type === 'ready') readyResolve(response);
    else {
      pending.get(response.id)?.resolve(response);
      pending.delete(response.id);
    }
  } catch (error) {
    fail(error);
  }
});
const deadline = setTimeout(() => {
  fail(new Error('Music service verification timed out'));
  child.kill();
}, 30000);
function request(path, data = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    child.stdin.write(
      JSON.stringify({ id, path, method: 'GET', data })
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029') + '\n'
    );
  });
}
try {
  assert.equal((await ready).protocol, 1);
  const responses = await Promise.all(Array.from({ length: 12 }, () => request('/desktop/health')));
  assert(
    responses.every(
      (item) =>
        item.status === 200 && item.body.pid === child.pid && item.body.transport === 'stdio'
    )
  );
  assert.equal((await request('/not-a-music-route')).status, 404);
  assert.equal(
    (await request('/not-a-music-route', { text: 'first\u2028second\u2029third' })).status,
    404
  );
  const scan = await request('/desktop/scan-local-music', { folderPath: cwd });
  assert.equal(scan.status, 200);
  assert.equal(scan.body.count, 0);
  if (process.argv.includes('--live')) {
    for (const [path, data] of [
      ['/banner', {}],
      ['/top/album', { limit: 6 }],
      ['/search', { keywords: 'test', limit: 3 }]
    ]) {
      const result = await request(path, data);
      assert.equal(result.status, 200);
      assert.equal(result.body.code, 200);
    }
  }
  console.log(`Music service handshake and concurrency verified in ${Date.now() - started} ms.`);
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin.end();
  await exited;
  assert.equal(child.exitCode, 0);
  console.log('Music service exited after the parent channel closed.');
  if (process.argv.includes('--host-node'))
    console.log(
      'Cross build: service checked with host Node; target binary execution remains unverified.'
    );
} finally {
  clearTimeout(deadline);
  input.close();
  if (child.exitCode === null) child.kill();
  await rm(cwd, { recursive: true, force: true });
}
