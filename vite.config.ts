import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => ({
  base: './',
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@renderer': resolve('src/renderer'),
      '@i18n': resolve('src/i18n')
    }
  },
  plugins: [
    vue(),
    {
      name: 'music-modern-icons',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/remixicon/fonts/remixicon.css')) return;
        // 在 Vite 收集 CSS 资源之前只保留官方 WOFF2 字体，不维护手写字形子集。
        // 完整图标映射保持原样，新增播放器按钮不会因缺字而显示方框。
        return {
          code: code.replace(
            /@font-face\s*\{[\s\S]*?\}/,
            '@font-face { font-family: "remixicon"; src: url("./remixicon.woff2") format("woff2"); font-display: swap; }'
          ),
          map: null
        };
      }
    },
    // Tauri 直接读取嵌入资源，额外的 .gz 文件无人使用，只在 Web 构建时生成。
    viteCompression({ disable: mode === 'desktop' }),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar']
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })
  ],
  publicDir: resolve('resources'),
  build: {
    target: 'esnext',
    outDir: resolve('dist'),
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {}
  }
}));
