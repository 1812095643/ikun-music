ikun音乐 5.3.7

- 移除桌面首页右上角的登录按钮和登录页面。
- 保留右上角“我的音乐”入口与个人中心，集中显示收藏、歌单和最近播放，无需登录即可查看本机记录。
- 旧登录地址自动进入个人音乐库。
- 清理仅供登录页面使用的请求、导航和样式。

本次通过 GitHub Actions 构建 Windows x64、Windows ARM64、Mac Intel 和 Mac Apple 芯片四种架构。Windows 提供安装版和便携版，Mac 提供 DMG 安装包及 `.app.tar.gz` 更新文件；自动更新按系统、架构和安装形式匹配。

Windows 便携版须完整解压并保留 runtime 目录。Mac 要求 macOS 13.5 或更高版本，目前使用临时签名、未完成苹果公证，尚未进行 Mac 真机完整播放与桌面歌词验收。

5.3.6 可通过应用内检查更新升级；5.3.5 及以前版本需从 GitHub 手动安装一次。安卓手机、平板和车机安装包见独立的 [Android 0.1.1 发布页](https://github.com/1812095643/ikun-music/releases/tag/mobile-v0.1.1)。
