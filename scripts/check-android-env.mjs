import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REQUIRED_KEYS = ['VITE_API', 'VITE_API_MUSIC'];
const ENV_FILES = ['.env', '.env.local', '.env.android', '.env.android.local'];

const readEnvFile = (filePath) => {
  if (!existsSync(filePath)) return {};

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return env;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      env[key] = rawValue.replace(/^['"]|['"]$/g, '');
      return env;
    }, {});
};

const loadAndroidEnv = () => {
  return ENV_FILES.reduce(
    (env, fileName) => ({
      ...env,
      ...readEnvFile(resolve(process.cwd(), fileName))
    }),
    {}
  );
};

const androidEnv = loadAndroidEnv();
const missingKeys = REQUIRED_KEYS.filter((key) => {
  const value = androidEnv[key];
  return !value || value === '***';
});

if (missingKeys.length > 0) {
  console.error('\nAndroid 构建缺少必要的远程接口配置：');
  missingKeys.forEach((key) => console.error(`- ${key}`));
  console.error('\n请复制 .env.android.example 为 .env.android，并填写真实可访问的远程接口地址。');
  console.error('Android 第一阶段不启动桌面内置 Node 音乐 API，不能使用 127.0.0.1 作为移动端接口。\n');
  process.exit(1);
}

