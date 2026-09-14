# ikun音乐

桌面应用使用 Vue 3 + Tauri 2 + Rust。音乐协议复用独立 Node 服务随包分发；不包含 Electron、Chromium 或 Electron 预加载层。Windows 使用系统 WebView2，安装版可补装 WebView2；便携版要求系统已有 WebView2。

## 架构与端口

- `src/renderer`：Vue 页面、播放器和状态；`utils/desktopBridge.ts` 统一调度 Tauri 窗口、文件、事件与配置。
- `src-tauri/src/music_service.rs`：管理私有 Node 子进程，按请求 ID 分发标准输入输出消息，支持并发、超时和断开恢复。
- `src-tauri/runtime`：音乐服务入口和独立锁文件；直接调用现有音乐协议库，按需加载模块。
- `src-tauri/src/updates.rs`：Tauri 官方签名验证、下载、安装和便携包安全替换。
- 桌面业务不监听 HTTP 端口，旧 `30488` 不再使用。`5173` 只在 Vite 开发环境使用。Android/Web 使用各自配置的网络 API。

## 开发与打包

```powershell
npm ci
npm run dev
npm run typecheck:web
npm run prepare:music-api-runtime
node scripts/check-music-service.mjs src-tauri/runtime-stage --live
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/package-desktop.ps1 -Target all
```

Node 服务从独立清单 `npm ci` 安装全部必要依赖。Tauri EXE 只嵌入前端资源，Node 与协议库作为 `runtime` 随安装包分发，避免每次启动释放大 ZIP。便携 ZIP 必须完整解压，不能单独复制 EXE。

## 更新发布

1. 同步提升根项目、Rust、Tauri 配置与 runtime 清单版本，更新 `release-notes.md`。
2. 使用本项目独立签名私钥构建。默认私钥位于用户目录 `.tauri/ikun-music-updater.key`，也可设置 `TAURI_SIGNING_PRIVATE_KEY`；私钥不能提交或上传。
3. 提交代码并推送对应 `v版本号` 标签，把产物中的安装 EXE、便携 ZIP 和各自 `.sig` 上传 Gitee 同名发行版。
4. 验证附件完整后，把构建产物 `latest.json` 更新到仓库 `updates/latest.json` 并推送。清单记录版本、签名、SHA-256、大小和附件 URL。

应用启动三秒后检查更新，此后每四小时以及恢复网络时检查。发现新版本显示可关闭提示；用户点击后下载，官方插件验证签名、再核对 SHA-256，最后允许安装。便携更新只替换 `ikun-music-tauri.exe`、`runtime`、`portable.json`，用户配置保留在应用数据目录。

旧 5.1.x / 5.2.x 使用完整新安装包或完整 ZIP 升级一次，此后进入本版本签名更新链路。
