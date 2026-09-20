# ikun音乐

桌面应用使用 Vue 3 + Tauri 2 + Rust。音乐协议复用独立 Node 服务随包分发；不包含 Electron、Chromium 或 Electron 预加载层。Windows 使用系统 WebView2，安装版可补装 WebView2；便携版要求系统已有 WebView2。

## 架构与端口

移动端入口为 [mobile](mobile/README.md)，使用 uni-app + Vue 3 共用安卓与 iOS 页面，复用桌面音源源码、Logo 与配色；运行 `npm run dev:mobile` 可预览。`npm run build:mobile` 生成 App 资源，正式安装包另外配置 DCloud AppID 和签名。

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
2. 使用本项目独立签名私钥构建。默认私钥位于用户目录 `.tauri/ikun-music-updater.key`；云端通过 GitHub 仓库的 `TAURI_SIGNING_PRIVATE_KEY` 加密 Secret 注入。私钥不能提交到代码库、日志或发行附件。
3. 推送到 [GitHub 仓库](https://github.com/1812095643/ikun-music)，推送对应 `v版本号` 标签或在 main 上手动运行发布工作流。
4. GitHub Actions 分别在 Windows x64、Windows ARM64、Mac Intel、Mac Apple Silicon 构建并检查随包服务。四项全部成功后，合并签名、SHA-256、大小及平台更新地址，上传完整附件，最后公开 [Release](https://github.com/1812095643/ikun-music/releases)。

Windows 提供安装 EXE 和便携 ZIP；Mac 提供 DMG 和用于自动更新的 `.app.tar.gz`。Mac 当前使用临时签名，尚未完成苹果公证；正式公证还需配置开发者证书。安卓使用 mobile 工程，APK 仍需 DCloud 应用配置，不包含在此桌面构建流程中。

本地打包使用 `npm run package:desktop -- --target=x86_64-pc-windows-msvc`。交叉编译 Windows ARM64 时指定 `--target=aarch64-pc-windows-msvc`，并通过 `IKUN_NODE_BINARY` 指向经过官方哈希核验的 ARM64 Node；构建脚本会拒绝混入错误架构的后端。macOS 构建须在对应架构的 Mac 执行，同一脚本生成 DMG。

应用启动三秒后检查更新，此后每四小时以及恢复网络时检查。发现新版本显示可关闭提示；用户点击后下载，官方插件验证签名、再核对 SHA-256，最后允许安装。便携更新只替换 `ikun-music-tauri.exe`、`runtime`、`portable.json`，用户配置保留在应用数据目录。

5.3.5 及以前版本的更新地址和下载校验固定为 Gitee。迁移后请从 GitHub 手动下载安装包或完整 ZIP 升级一次，用户配置仍保留；从 5.3.6 开始自动更新统一使用 GitHub。Gitee 保留历史版本，不再继续发布。
