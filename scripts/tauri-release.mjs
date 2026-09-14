import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

// Windows PowerShell 5 设置空环境变量会删除变量，导致 CLI 在后台等待签名密码。
// Node 按结构化参数传递显式空密码；私钥只保存在环境中，不输出到日志。
const keySource = process.env.TAURI_SIGNING_PRIVATE_KEY || join(homedir(), '.tauri/ikun-music-updater.key');
if (!process.env.TAURI_SIGNING_PRIVATE_KEY && !existsSync(keySource)) throw new Error('未找到项目更新签名密钥');
// build 允许文件路径，但 signer sign 会把环境变量直接当成 Base64 私钥。
// 统一读取为内容，避免 Windows 盘符被误解码；内容只传给签名子进程，不进入命令行或日志。
const key = existsSync(keySource) ? readFileSync(keySource, 'utf8').trim() : keySource;
const child = spawn(process.execPath, [resolve('node_modules/@tauri-apps/cli/tauri.js'), ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, CI: 'true', TAURI_SIGNING_PRIVATE_KEY: key,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' }
});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error('Tauri 发布命令未启动：', error.message); process.exitCode = 1; });
