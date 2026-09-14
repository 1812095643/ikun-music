import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';

// 在仓库外工作目录运行真实随包服务，防止从开发 node_modules 偷用漏打包的依赖。
const runtime = resolve(process.argv[2] || 'src-tauri/runtime-stage');
const cwd = await mkdtemp(join(tmpdir(), 'ikun-service-check-'));
const pending = new Map();
const child = spawn(join(runtime, 'node.exe'), [join(runtime, 'music-service.cjs')], {
  cwd,
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, TEMP: cwd, TMP: cwd }
});
const started = Date.now();
let requestId = 0;
const input = createInterface({ input: child.stdout });
let readyResolve;
const ready = new Promise((resolve) => {
  readyResolve = resolve;
});
input.on('line', (line) => {
  const response = JSON.parse(line);
  if (response.type === 'ready') readyResolve(response);
  else pending.get(response.id)?.(response);
});
const deadline = setTimeout(() => {
  console.error('音乐私有服务验证超时');
  child.kill();
  process.exitCode = 1;
}, 30000);
const request = (path, data = {}) =>
  new Promise((resolve) => {
    const id = ++requestId;
    pending.set(id, (value) => {
      pending.delete(id);
      resolve(value);
    });
    child.stdin.write(
      JSON.stringify({ id, path, method: 'GET', data })
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029') + '\n'
    );
  });
try {
  assert.equal((await ready).protocol, 1);
  const results = await Promise.all(Array.from({ length: 12 }, () => request('/desktop/health')));
  assert(
    results.every(
      (item) =>
        item.status === 200 && item.body.pid === child.pid && item.body.transport === 'stdio'
    )
  );
  assert.equal((await request('/not-a-music-route')).status, 404);
  assert.equal(
    (await request('/not-a-music-route', { text: '歌词第一段\u2028第二段\u2029第三段' })).status,
    404
  );
  const scan = await request('/desktop/scan-local-music', { folderPath: cwd });
  assert.equal(scan.status, 200);
  assert.equal(scan.body.count, 0);
  console.log(`私有服务：握手与并发隔离通过，就绪耗时 ${Date.now() - started} ms`);
  if (process.argv.includes('--live')) {
    for (const [path, data] of [
      ['/banner', {}],
      ['/top/album', { limit: 6 }],
      ['/search', { keywords: 'test', limit: 3 }]
    ]) {
      const response = await request(path, data);
      assert.equal(response.status, 200, `${path} 未返回 200`);
      assert.equal(response.body.code, 200);
      console.log(`${path} 真实音乐服务返回 200`);
    }
  }
  child.stdin.end();
  await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(child.exitCode, 0);
  console.log('关闭父进程通道后服务自动退出，通过');
} finally {
  clearTimeout(deadline);
  input.close();
  if (child.exitCode === null) child.kill();
  await rm(cwd, { recursive: true, force: true });
}
