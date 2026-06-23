import axios from 'axios';

import { isElectron } from '.';
import { ensureMusicApiReady } from './tauriElectronCompat';

const baseURL = `${import.meta.env.VITE_API_MUSIC}`;
const request = axios.create({
  baseURL,
  timeout: 10000
});

// 请求拦截器
request.interceptors.request.use(
  async (config) => {
    if (isElectron) {
      await ensureMusicApiReady();
    }
    return config;
  },
  (error) => {
    // 当请求异常时做一些处理
    return Promise.reject(error);
  }
);

export default request;
