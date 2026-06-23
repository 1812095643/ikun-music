# 桌面端便携版打包事故记录

## 事故时间

2026-06-23

## 现象

用户双击 `D:\自研音乐APP\打包产物\ikun音乐-5.1.0-便携版.exe` 后，窗口没有进入音乐首页，而是显示 Microsoft Edge WebView 的错误页：

- 页面提示 `localhost 拒绝连接`
- 错误码为 `ERR_CONNECTION_REFUSED`
- 首页内容、歌单、搜索、播放入口都无法正常使用

这类现象不是酷我音源问题，也不是本地音乐 API 接口问题，而是桌面壳加载地址错了。

## 根本原因

旧版 `scripts/package-desktop.ps1` 的便携版流程是：

1. 先执行 `npm run build:desktop`
2. 再进入 `src-tauri` 执行 `cargo build --release`
3. 直接复制 `src-tauri\target\release\ikun-music-tauri.exe` 到 `打包产物`

这个流程绕过了 Tauri CLI 的正式生产构建流程。直接 `cargo build --release` 时，Tauri 的生产资源注入不完整，`devUrl` 会被编译进 exe。最终用户双击便携版时，窗口会访问开发地址：

```text
http://localhost:5173
```

用户机器上没有启动 Vite 开发服务，所以窗口只会显示 `localhost 拒绝连接`。

## 错误做法

以后禁止用下面这种方式生成给用户的便携版：

```powershell
npm run build:desktop
cd src-tauri
cargo build --release
copy target\release\ikun-music-tauri.exe D:\自研音乐APP\打包产物\
```

这只能算 Rust 编译，不等于 Tauri 正式打包。

## 正确做法

便携版必须走 Tauri CLI 的正式构建入口：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\package-desktop.ps1
```

当前脚本内部对便携版执行的是：

```powershell
npm run tauri:build -- --no-bundle
```

这样会触发 `src-tauri/tauri.conf.json` 中的 `beforeBuildCommand`，完整执行：

1. 准备内置音乐 API 运行时
2. 构建前端生产资源
3. 通过 Tauri CLI 编译正式 release exe
4. 只复制便携版 exe，不额外生成安装包

## 正确产物

便携版输出位置固定为：

```text
D:\自研音乐APP\打包产物\ikun音乐-5.1.0-便携版.exe
```

2026-06-23 修复后的产物信息：

```text
大小：81431552 bytes
时间：2026-06-23 10:06:33
```

## 验收清单

每次给用户前必须至少检查下面几项：

1. 执行打包脚本成功：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\package-desktop.ps1
```

2. 启动便携版：

```powershell
Start-Process -FilePath 'D:\自研音乐APP\打包产物\ikun音乐-5.1.0-便携版.exe'
```

3. 确认没有连接开发端口 `5173`：

```powershell
Get-NetTCPConnection -RemotePort 5173 -ErrorAction SilentlyContinue
```

正常结果：没有输出。

4. 确认内置后端监听 `30488`：

```powershell
Get-NetTCPConnection -LocalPort 30488 -ErrorAction SilentlyContinue
```

正常结果：能看到 `127.0.0.1:30488` 的 `Listen`。

5. 确认本地音乐 API 可用：

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:30488/banner' -TimeoutSec 5
Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:30488/search?keywords=test' -TimeoutSec 8
```

正常结果：两个请求都返回 `200`。

6. 验证完成后清理本次启动的进程：

```powershell
Get-CimInstance Win32_Process |
  Where-Object {
    $_.ExecutablePath -eq 'D:\自研音乐APP\打包产物\ikun音乐-5.1.0-便携版.exe' -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*alger-music-api.js*')
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
```

## PowerShell 编码注意事项

`scripts/package-desktop.ps1` 里有中文注释。Windows PowerShell 5 对 UTF-8 无 BOM 文件识别不稳定，可能把中文注释读成乱码，甚至把后续脚本解析坏。

因此该脚本需要保留 UTF-8 BOM。修改脚本后必须确认 Windows PowerShell 可以解析：

```powershell
powershell -NoProfile -Command '$errors = $null; [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw ''D:\自研音乐APP\Tauri music\scripts\package-desktop.ps1''), [ref]$errors) | Out-Null; if ($errors) { $errors | Format-List *; exit 1 } else { ''Windows PowerShell解析通过'' }'
```

## 本次修复提交

```text
e9180e1 fix(打包): 修复便携版启动访问开发地址
```

## 以后打包前的硬性要求

- 不允许直接复制 `cargo build --release` 的 exe 给用户。
- 不允许只看构建成功就交付，必须实际启动便携版。
- 不允许只验证窗口打开，必须确认没有访问 `5173`。
- 不允许只验证前端，必须确认 `30488` 本地后端和搜索接口可用。
- 修改 PowerShell 脚本后，必须用 Windows PowerShell 解析一次，不只用 `pwsh`。
