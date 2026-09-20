import { type ChildProcess,spawn } from 'node:child_process';
import { copyFile,mkdir, readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

export function transferPreview(): Plugin {
  let child: ChildProcess | undefined;
  let info: ({ port: number; ownerToken: string } & Record<string, unknown>) | undefined;
  let pending: Promise<typeof info> | undefined;
  async function start() {
    if (info && child && child.exitCode === null) return info;
    if (pending) return pending;
    pending = (async () => {
      const classpath = await readFile(resolve('native-kit/build/preview-classpath.txt'), 'utf8');
      const runtime = resolve('.native-preview', `runtime-${Date.now()}`);
      await mkdir(runtime, { recursive: true });
      await copyFile(resolve('src/static/brand.png'), resolve('src/static/transfer/brand.png'));
      const process = spawn(
        'java',
        [
          '-cp',
          classpath,
          'cn.ikun.music.transfer.PreviewHost',
          runtime,
          resolve('src/static/transfer')
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      child = process;
      let failure = '';
      process.stderr?.on('data', () => {
        failure = 'Native transfer process could not start';
      });
      process.on('error', (error) => {
        failure = error.message;
      });
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (process.exitCode !== null || failure)
          throw new Error(failure || 'Native transfer process exited');
        try {
          info = JSON.parse(await readFile(resolve(runtime, 'runtime.json'), 'utf8'));
          return info;
        } catch {
          // 原生服务启动时先创建文件再写入内容，下一轮重读完整状态。
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      process.kill();
      throw new Error('Native transfer start timed out');
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }
  return {
    name: 'ikun-transfer-preview',
    configureServer(server) {
      server.httpServer?.on('close', () => {
        child?.kill();
      });
      server.middlewares.use('/__transfer', async (request, response, next) => {
        const path = request.url || '/';
        if (path.startsWith('/proxy/') && info) {
          const upstream = httpRequest(
            {
              hostname: '127.0.0.1',
              port: info.port,
              path: path.slice(6),
              method: request.method,
              headers: { ...request.headers, host: `127.0.0.1:${info.port}` }
            },
            (result) => {
              response.writeHead(result.statusCode || 502, result.headers);
              result.pipe(response);
            }
          );
          upstream.on('error', () => {
            if (!response.headersSent) response.statusCode = 502;
            response.end();
          });
          response.on('close', () => upstream.destroy());
          request.pipe(upstream);
          return;
        }
        if (!['/start', '/stop'].includes(path)) return next();
        if (
          request.method !== 'POST' ||
          request.headers.origin !== `http://${request.headers.host}`
        ) {
          response.statusCode = 403;
          response.end();
          return;
        }
        response.setHeader('content-type', 'application/json; charset=utf-8');
        try {
          if (path === '/stop') {
            child?.kill();
            child = undefined;
            info = undefined;
            response.end('{}');
          } else response.end(JSON.stringify(await start()));
        } catch {
          response.statusCode = 503;
          response.end(
            JSON.stringify({ message: '当前预览环境尚未准备好互传服务，请先完成本地扩展构建。' })
          );
        }
      });
    }
  };
}
