import axios, { InternalAxiosRequestConfig } from 'axios';

import { useUserStore } from '@/store/modules/user';

import { getSetData, isAndroidRuntime, isDesktopRuntime, isElectron, isMobile } from '.';
import { ensureMusicApiReady } from './tauriElectronCompat';

let setData: any = null;

// 扩展请求配置接口
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  retryCount?: number;
  noRetry?: boolean;
}

const baseURL = isDesktopRuntime
  ? `http://127.0.0.1:${setData?.musicApiPort}`
  : import.meta.env.VITE_API;

const request = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true
});

// 最大重试次数
const MAX_RETRIES = 1;
// 重试延迟（毫秒）
const RETRY_DELAY = 500;

// 请求拦截器
request.interceptors.request.use(
  async (config: CustomAxiosRequestConfig) => {
    if (isDesktopRuntime) {
      // 根因：Tauri 打包版启动时 Vue 首屏会立刻请求首页、搜索和歌词接口，
      // 但内置 Node 音乐 API 需要先完成脚本加载、端口监听和酷我等音源模块初始化。
      // 之前请求层没有等待后端 ready，首次双击 exe 时就可能把请求打到尚未监听的
      // 30488，页面拿到的都是空数据。这里在所有桌面音乐 API 请求发出前统一等待
      // Rust 端确认服务可用，并同步可能被端口占用后自动漂移的实际端口。
      await ensureMusicApiReady();
    }
    setData = getSetData();
    config.baseURL = isDesktopRuntime
      ? `http://127.0.0.1:${setData?.musicApiPort}`
      : import.meta.env.VITE_API;
    // 只在retryCount未定义时初始化为0
    if (config.retryCount === undefined) {
      config.retryCount = 0;
    }

    // 在请求发送之前做一些处理
    // 在get请求params中添加timestamp
    config.params = {
      ...config.params,
      timestamp: Date.now(),
      device: isAndroidRuntime || isMobile ? 'mobile' : isElectron ? 'pc' : 'web'
    };
    const token = localStorage.getItem('token');
    if (token && config.method !== 'post') {
      config.params.cookie = config.params.cookie !== undefined ? config.params.cookie : token;
    } else if (token && config.method === 'post') {
      config.data = {
        ...config.data,
        cookie: token
      };
    }
    if (isDesktopRuntime) {
      const proxyConfig = setData?.proxyConfig;
      if (proxyConfig?.enable && ['http', 'https'].includes(proxyConfig?.protocol)) {
        config.params.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
      }
      if (setData.enableRealIP && setData.realIP) {
        config.params.realIP = setData.realIP;
      }
    }

    return config;
  },
  (error) => {
    // 当请求异常时做一些处理
    return Promise.reject(error);
  }
);

const NO_RETRY_URLS = ['暂时没有'];

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('error', error);
    const config = error.config as CustomAxiosRequestConfig;

    // 如果没有配置，直接返回错误
    if (!config) {
      return Promise.reject(error);
    }

    // 处理 301 状态码
    if (error.response?.status === 301 && config.params.noLogin !== true) {
      // 使用 store mutation 清除用户信息
      const userStore = useUserStore();
      userStore.handleLogout();
      console.log(`301 状态码，清除登录信息后重试第 ${config.retryCount} 次`);
      config.retryCount = 3;
    }

    // 检查是否还可以重试
    if (
      config.retryCount !== undefined &&
      config.retryCount < MAX_RETRIES &&
      !NO_RETRY_URLS.includes(config.url as string) &&
      !config.noRetry
    ) {
      config.retryCount++;
      console.error(`请求重试第 ${config.retryCount} 次`);

      // 延迟重试
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

      // 重新发起请求
      return request(config);
    }

    console.error(`重试${MAX_RETRIES}次后仍然失败`);
    return Promise.reject(error);
  }
);

export default request;
