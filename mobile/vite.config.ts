import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { fileURLToPath } from 'node:url';

import uni from '@dcloudio/vite-plugin-uni';
import { defineConfig, type Plugin } from 'vite';

import { transferPreview } from './backend/transferPreview';

// 仅供浏览器开发验收；安装版直接使用 uni.request，不依赖电脑或额外服务。
function musicPreviewTransport(): Plugin {
  return {
    name: 'music-preview-transport',
    configureServer(server) {
      server.middlewares.use('/__music', (request, response) => {
        let upstreamUrl: URL;
        try {
          const incoming = new URL(request.url || '/', 'http://localhost');
          upstreamUrl = new URL(incoming.searchParams.get('url') || '');
          if (
            !['http:', 'https:'].includes(upstreamUrl.protocol) ||
            !/(^|\.)(kuwo\.cn|lyrics\.kugou\.com)$/i.test(upstreamUrl.hostname)
          )
            throw new Error();
        } catch {
          response.statusCode = 400;
          response.end('Unsupported music host');
          return;
        }
        const headers: Record<string, string> = {
          'user-agent': (request.headers['x-music-agent'] as string) || 'okhttp/3.10.0',
          referer: 'http://www.kuwo.cn/'
        };
        if (request.headers.range) headers.range = request.headers.range;
        const upstream = (upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest)(
          upstreamUrl,
          { method: request.method, headers },
          (result) => {
            response.writeHead(result.statusCode || 502, {
              ...result.headers,
              'access-control-allow-origin': '*'
            });
            result.pipe(response);
          }
        );
        upstream.setTimeout(15_000, () => upstream.destroy(new Error('Music request timed out')));
        upstream.on('error', () => {
          if (!response.headersSent) response.statusCode = 502;
          response.end();
        });
        response.on('close', () => upstream.destroy());
        upstream.end();
      });
    }
  };
}

export default defineConfig({
  plugins: [uni(), musicPreviewTransport(), transferPreview()],
  resolve: {
    alias: {
      // 原生服务层没有 window/self；锁定兼容实现，避免依赖的 browser 入口在启动时抛错。
      'abort-controller': fileURLToPath(
        new URL('./node_modules/abort-controller/dist/abort-controller.mjs', import.meta.url)
      ),
      '@ikun/music-backend': fileURLToPath(new URL('./backend/dist/index.js', import.meta.url))
    }
  },
  optimizeDeps: { exclude: ['@ikun/music-backend'] },
  server: { host: '127.0.0.1', port: 5178, strictPort: true }
});
