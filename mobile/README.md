# ikun 音乐移动端

使用 uni-app、Vue 3 和 TypeScript，共用安卓与 iOS 页面。无需登录，不提供多端同步；收藏、歌单、播放队列和下载记录保存在本机。

## 本地开发

在 `mobile` 目录执行，不需要安装桌面端依赖：

```powershell
npm ci
npm run dev:h5
```

Chrome 预览地址为 `http://127.0.0.1:5178`。预览通过 Vite 的本机代理访问真实音源。安装版使用 `uni.request` 直接请求音源，不依赖电脑、Node 服务或常开的服务器。H5 目前用于开发验收，不能把开发代理当作已部署的公共服务。

```powershell
npm run typecheck
npm run build:h5
npm run build:app
```

`build:app` 生成 `dist/build/app` 原生应用资源。这不是 APK 或 IPA。`src/manifest.json` 使用 DCloud 中国大陆区分配的 AppID `__UNI__199846B`，安卓包名为 `cn.ikun.music`。安卓使用官方 SDK 在本机 Gradle 编译并签名为可直接安装的 APK，无需上架商店，也无需请求 DCloud 云打包。iOS 真机安装包仍需苹果证书及描述文件。

GitHub 的「构建安卓手机平板车机预览版」工作流复用本机离线构建流程。官方 `Android-SDK@5.26.82680_20260914.zip` 保存在本仓库 `build-tools-android-5.26` 草稿发行版中，保持原始文件与许可证完整；构建前校验 SHA-256。签名与 AppKey 使用仓库 Secrets `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`DCLOUD_APPKEY`，不需要 DCloud 登录密码。校验成功后可发布独立 `mobile-v版本号` 预览版，不改变桌面 `latest.json`。

本机需要 Java 17、Gradle 8.13、Android 平台 36.1 与 Build Tools 36.1.0。配置 `DCLOUD_ANDROID_SDK` 为官方 SDK 解压目录，`ANDROID_HOME` 为 Android SDK 路径，`DCLOUD_APPKEY` 为应用离线 Key，并配置 `ANDROID_KEYSTORE_FILE`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`；独立密钥密码可用 `ANDROID_KEY_PASSWORD` 指定。签名必须与 DCloud 后台登记的 SHA-1 一致。然后在 `mobile` 目录运行：

```powershell
npm run build:device-kit
npm run build:app
npm run build:apk
```

APK 与 SHA-256 清单输出到仓库的 `release-stage/android`，包含 ARM64 与 ARM32，适用于 Android 8.0 及以上手机、平板和可安装 APK 的车机。`npm run check:apk` 只检查原生编译，不生成安装包；`npm run build:apk -- --emulator` 生成单独的 x86_64 模拟器验收包，不进入发布目录。`GRADLE_BIN` 可指定 Gradle 可执行文件路径。

iOS 同样可以由 GitHub 调用官方打包工具，或使用 macOS runner 与官方离线 SDK；IPA 仍需要匹配的 Apple 证书、描述文件和 Bundle ID。目前未配置这些材料，也未创建声称能够产出 IPA 的工作流。车机互传、系统音乐扫描和原生频谱的 iOS 扩展也尚未实现。

## 源码复用与设计

- `backend/build.mjs` 直接编译桌面的 `src/renderer/api/kuwo.ts`、音质配置和歌词解析器，不复制后另行维护。
- `src-tauri/runtime/kuwo-playback.cjs` 同时由桌面 Node 服务和移动端构建使用，继续使用已经验证的取流参数与原依赖加密模块。播放和下载共用这一接口。
- 音源传输适配在 `src/services/musicApi.ts`。安卓通过 `src/nativeplugins/Ikun-DeviceKit` 复用 Media3；网页使用 HTMLAudio/Web Audio，iOS 当前保留 uni-app 背景音频适配。
- Logo 来自桌面的 `src/renderer/assets/logo.png`；配色从 `base.css` 的 `--qqm-*` 变量生成；图标继续使用同版本 Remix Icon。
- 底部为发现、搜索、歌单、我的四个入口，导航上方常驻迷你播放器。完整播放器支持封面与歌词切换、进度拖动、队列、收藏及音质下载。
- 界面结构参考 QQ 音乐的使用习惯；APlayer、Gramophone 的原生音乐体验用于调研，没有复制其应用代码。

## 当前验证与边界

已用真实接口检查推荐歌单、孙燕姿搜索与封面、播放全部、两轮快速切歌、歌曲身份与实际音频时长、歌词备用匹配、收藏和本地歌单。三档取流返回 128 kbps MP3、320 kbps MP3 和 FLAC；完整标准音质下载可解码，时长符合歌曲信息。桌面共享取流模块与提取前的三档结果完全一致，私有服务握手、调用和退出通过。

已在 Android 12 模拟器安装实际 APK，验证启动、首页与封面、搜索及播放全部、连续切歌、媒体会话歌曲一致、下载文件回放、同目录 LRC，以及原生互传接收图片和 6,900 字符文本。修复了原生启动时误用浏览器 AbortController 入口，以及 Media3 无法识别下载目录别名的问题。

0.1.1 修复媒体会话未注册到播放服务的问题，接入系统通知栏与锁屏的歌名、歌手、封面、暂停和前后切歌。切歌时保留媒体项与前台通知，避免清空播放器后被 Android 拒绝从后台重新启动播放服务；播放错误或停止后会重新准备音源，服务被回收时保留页面进度并允许重建当前歌曲。APK 已实测原生媒体卡片操作、锁屏自动切歌及主动停止播放服务后的同曲恢复。设置增加小米、vivo、OPPO 的后台限制说明和系统设置入口。

实体小米、vivo、OPPO 与车机仍需真机验收，模拟器验证不代表厂商省电策略兼容性已确认。耳机切换、FLAC、长时间锁屏及整个应用进程被回收后的恢复仍需进一步验证；iOS 未生成 IPA。

下载在 App 内保存到应用私有音乐目录，成功后同时尝试保存同名 LRC。暂停后的任务可重新下载；暂不宣称已实现跨进程断点续传。浏览器下载的临时文件仅在当前会话可用，不视作原生离线库。

从 0.1.2 起，安卓启动后自动查询 GitHub 移动发行版，成功检查间隔为六小时；设置中可随时手动检查。检测会排除桌面版本、草稿和不完整附件。点击“下载并安装”后显示进度，可取消或重试；完整安装包通过大小、SHA-256、包名、版本及原签名校验后交给系统安装。首次可能需要允许本应用安装更新；用户仍须确认系统安装提示，应用不会静默安装。0.1.1 及以前版本需要先手动覆盖安装一次。GitHub 网络不可用时会说明原因并提供发行页面入口。

更新流程已在 Android 12 模拟器使用临时低版本包验证真实 GitHub 新版本检测、下载取消与重试、完整包复用、原生校验、安装授权返回和系统更新确认框。模拟器为 x86_64，公开 APK 为 ARM，因此未以该测试宣称 ARM 真机已完成覆盖安装。临时验证包不发布。

参考：[uni-app 背景音频](https://uniapp.dcloud.net.cn/api/media/background-audio-manager.html)、[APlayer](https://github.com/rRemix/APlayer)、[Gramophone](https://github.com/FoedusProgramme/Gramophone)。

## 手机、平板与车机

窗口大小和横竖屏变化会自动重排。首页在手机、平板和车机上保持相同的纵向内容顺序，宽屏只增加每行卡片和歌曲数量，不将模块分成左右两区。宽屏使用侧边导航与横向播放页，手机保留四栏底部导航；主界面没有常驻的“此刻在听”侧栏。安卓优先读取系统车载模式与 Automotive 硬件标志，未正确上报类型的改装车机可在「设置 → 显示模式」选择车机，选择会保存在本机。配置已允许四种屏幕方向，键盘弹出不改变原生设备分类。

车机和平板的底部播放器、完整播放页显示圆角频谱条。安卓使用 Media3 的 `TeeAudioProcessor` 读取播放 PCM，再由 JTransforms 做左右声道 FFT；网页复用 Web Audio 的声道分离与分析节点。没有麦克风采集，也没有随机动画代替音频数据。暂停、无声片段和停止会归零；没有分析能力的平台会明确提示。iOS App 的原生频谱尚未接入。

## 局域网互传与本地音乐

「我的 → 局域网互传」或宽屏侧栏可开启独立传输服务。另一台设备连接相同 Wi-Fi/热点后，在浏览器打开屏幕地址，输入六位连接码即可使用；二维码会携带连接码。手机可用 Android 或 iOS 浏览器，无需安装配套 App。这是浏览器互传协议，不实现 LocalSend 的设备发现或协议兼容。

传输复用 NanoHTTPD，端口由系统分配，默认关闭。支持任意文件类型，逐段写入应用私有目录；重名文件各自保存，取消和断流不会登记为已完成文件。文件大小受可用磁盘空间约束，文本请求上限为 2 MiB。接收后可通过系统文件选择器另存到用户指定位置；分享的文件可由手机浏览器直接下载。连接码只对当前服务会话有效，关闭服务后原连接失效。遇到路由器设备隔离，可改用手机热点。

安卓「本地音乐」支持系统媒体库扫描、系统文件选择器、列表勾选及全选后添加。互传收到的音频也纳入扫描；文件传输本身不限制类型。播放本地音乐直接使用文件 URI，不调用在线取流接口。网页只能选择用户授权的文件，浏览器文件仅在本次会话内有效。

「歌单 → 文字导入」可粘贴收到的歌单列表，三路并发查询真实音源并支持停止。只有歌名与歌手都匹配才自动勾选，其他候选须手动核对，再一次性写入本机歌单。

## 构建安卓本地扩展

源码位于 `native-kit`，页面仍是 uni-app，没有自有 Kotlin 页面。使用 JDK 17、Gradle 8.10+ 和 Android SDK 编译：

```powershell
npm run build:device-kit
npm run build:app
```

脚本优先读取 `ANDROID_HOME`/`ANDROID_SDK_ROOT`，否则寻找 Windows 默认 Android SDK 目录。构建生成 `src/nativeplugins/Ikun-DeviceKit/android/ikun-device-kit.aar`，插件配置和依赖声明已放在 `src/nativeplugins`，App 资源构建会一起复制到输出目录。`DeviceKitModule` 按 DCloud 规范注册模块，前端通过版本握手确认扩展已装载；编译接口来自 DCloud 官方 RichAlert 仓库的固定 SDK，校验 SHA-256 后仅作为 compileOnly 引用，不重复打入 APK。HBuilderX 打包时须包含该本地插件，并配置真实 AppID 与签名；普通基座不包含这些扩展。

`npm run build:device-kit` 同时准备浏览器联调用的 Java 类路径。开发预览开启互传时会运行同一份 Java 服务内核，实际接收文件到 `.native-preview`，不是模拟接口。关闭互传或退出开发服务会停止该进程。

原生内核已做实际 HTTP 二进制往返、长文本、授权隔离、中断清理、未知文件大小与左右声道/静音测试；浏览器页面已做双端发送、完整文本复制、本地文件勾选与真实播放验证。这些结果不替代车机和平板 APK 的真机验收。iOS App 当前没有本地服务、系统音乐扫描和原生频谱扩展，iPhone/iPad 可通过浏览器参与安卓设备开启的互传。

复用：[Media3 音频分流](https://developer.android.com/reference/androidx/media3/exoplayer/audio/TeeAudioProcessor.AudioBufferSink)、[NanoHTTPD](https://github.com/NanoHttpd/nanohttpd)、[JTransforms](https://github.com/wendykierp/JTransforms)、[二维码生成器](https://github.com/kazuhikoarase/qrcode-generator)。依赖许可保存在 `src/static/licenses`。
