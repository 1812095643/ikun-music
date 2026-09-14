param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$NodeExe = ''
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $OutputEncoding
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if ([string]::IsNullOrWhiteSpace($NodeExe)) {
  $NodeExe = (Get-Command node.exe -ErrorAction Stop).Source
}
$NodeExe = (Resolve-Path -LiteralPath $NodeExe).Path
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'src-tauri\embedded-runtime'))
$runtimeDir = Join-Path $runtimeRoot 'music-api-runtime'
$zipPath = Join-Path $runtimeRoot 'music-api-runtime.zip'
$signaturePath = Join-Path $runtimeRoot '.runtime-signature'
$scriptSource = Join-Path $ProjectRoot 'src-tauri\bin\alger-music-api.js'
$manifestDir = Join-Path $ProjectRoot 'src-tauri\runtime'
$manifestPath = Join-Path $manifestDir 'package.json'
$lockPath = Join-Path $manifestDir 'package-lock.json'

# 根因：根项目的生产依赖也包含前端 Vue/Pinia 及其 TypeScript 对等依赖，
# 直接复制根 package.json 会把与 Node 服务无关的工具链打进 EXE。
# 独立清单只声明服务使用的依赖，由 npm ci 安装完整且锁定的传递依赖，不裁剪依赖实现。
$inputPaths = @($NodeExe, $scriptSource, $manifestPath, $lockPath, $PSCommandPath)
$signature = ($inputPaths | ForEach-Object {
  (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash
}) -join ':'
if ((Test-Path -LiteralPath $zipPath) -and (Test-Path -LiteralPath $signaturePath)) {
  if ((Get-Content -LiteralPath $signaturePath -Raw).Trim() -eq $signature) {
    Write-Host '内置音乐服务没有变化，复用已验证的运行时压缩包。'
    exit 0
  }
}

# 删除前校验绝对路径，清理范围严格限定在当前工程生成的运行时目录。
$expectedRoot = Join-Path $ProjectRoot 'src-tauri\embedded-runtime'
if ($runtimeRoot -ne $expectedRoot -or !$runtimeRoot.StartsWith($ProjectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw '运行时目录不在当前工程内，已停止清理。'
}
if (Test-Path -LiteralPath $runtimeRoot) {
  Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $runtimeDir 'bin') -Force | Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $runtimeDir 'node.exe')
Copy-Item -LiteralPath $scriptSource -Destination (Join-Path $runtimeDir 'bin\alger-music-api.js')
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $runtimeDir 'package.json')
Copy-Item -LiteralPath $lockPath -Destination (Join-Path $runtimeDir 'package-lock.json')

Push-Location $runtimeDir
try {
  & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund
  # Windows PowerShell 5 不会因外部命令非零退出而自动 throw，必须显式阻止打包半成品。
  if ($LASTEXITCODE -ne 0) { throw "内置音乐服务依赖安装未完成，退出码：$LASTEXITCODE" }
  & $NodeExe --check (Join-Path $runtimeDir 'bin\alger-music-api.js')
  if ($LASTEXITCODE -ne 0) { throw '内置音乐服务脚本语法检查未通过。' }
} finally {
  Pop-Location
}

Compress-Archive -Path (Join-Path $runtimeDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
[IO.File]::WriteAllText($signaturePath, $signature, (New-Object System.Text.UTF8Encoding($false)))
$zipInfo = Get-Item -LiteralPath $zipPath
Write-Host ("音乐 API 内置运行时已生成：{0} ({1} MiB)" -f $zipInfo.FullName, [math]::Round($zipInfo.Length / 1MB, 2))