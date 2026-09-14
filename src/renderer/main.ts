import '@/utils/desktopBridge';
import './index.css';
import '@/assets/css/mobile.css';
import 'remixicon/fonts/remixicon.css';
import 'animate.css';

import { initializeDesktopSettings } from '@/utils/desktopBridge';

// 根因：Tauri 配置异步读取，Pinia 的旧同步兼容入口可能先拿到默认值并写回，
// 覆盖已保存的端口、音源和主题。先完成配置初始化，再求值路由与各个 store。
void initializeDesktopSettings()
  .catch((error) => {
    console.warn('读取桌面设置遇到问题，使用默认设置启动：', error);
  })
  .then(() => {
    return import('./bootstrap');
  });
