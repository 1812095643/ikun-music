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

const invalidEntries = REQUIRED_KEYS.filter((key) => {
  const value = androidEnv[key];
  if (!value || value === '***') return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
  } catch {
    return true;
  }
});

if (missingKeys.length > 0) {
  console.error('\n\u0041\u006e\u0064\u0072\u006f\u0069\u0064 \u6784\u5efa\u7f3a\u5c11\u5fc5\u8981\u7684\u8fdc\u7a0b\u63a5\u53e3\u914d\u7f6e\uff1a');
  missingKeys.forEach((key) => console.error(`- ${key}`));
  console.error(
    '\n\u8bf7\u590d\u5236 .env.android.example \u4e3a .env.android\uff0c\u5e76\u586b\u5199\u771f\u5b9e\u53ef\u8bbf\u95ee\u7684\u8fdc\u7a0b\u63a5\u53e3\u5730\u5740\u3002'
  );
  console.error(
    '\u0041\u006e\u0064\u0072\u006f\u0069\u0064 \u7b2c\u4e00\u9636\u6bb5\u4e0d\u542f\u52a8\u684c\u9762\u5185\u7f6e \u004e\u006f\u0064\u0065 \u97f3\u4e50 \u0041\u0050\u0049\uff0c\u4e0d\u80fd\u4f7f\u7528 127.0.0.1 \u4f5c\u4e3a\u79fb\u52a8\u7aef\u63a5\u53e3\u3002\n'
  );
  process.exit(1);
}

if (invalidEntries.length > 0) {
  console.error(
    '\n\u0041\u006e\u0064\u0072\u006f\u0069\u0064 \u6784\u5efa\u68c0\u6d4b\u5230\u4e0d\u53ef\u7528\u7684\u63a5\u53e3\u5730\u5740\uff1a'
  );
  invalidEntries.forEach((key) => console.error(`- ${key}: ${androidEnv[key]}`));
  console.error(
    '\n\u8bf7\u4f7f\u7528\u624b\u673a\u53ef\u8bbf\u95ee\u7684\u8fdc\u7a0b HTTP/HTTPS \u5730\u5740\uff0c\u4e0d\u8981\u4f7f\u7528 localhost\u3001127.0.0.1 \u6216\u975e\u6cd5 URL\u3002\n'
  );
  process.exit(1);
}
