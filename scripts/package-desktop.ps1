#requires -Version 5.1
param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$OutputRoot = '',
  [ValidateSet('portable','all')][string]$Target = 'all'
)
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$version = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
if ([string]::IsNullOrWhiteSpace($OutputRoot)) { $OutputRoot = Join-Path (Split-Path $ProjectRoot -Parent) ('打包产物\' + $version) }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$releaseExe = Join-Path $ProjectRoot 'src-tauri\target\release\ikun-music-tauri.exe'
$portableRoot = Join-Path $OutputRoot 'ikun-music-portable'
$runtimeSource = Join-Path $ProjectRoot 'src-tauri\runtime-stage'
$packageName = 'ikun-music-' + $version
$keyPath = Join-Path $env:USERPROFILE '.tauri\ikun-music-updater.key'
if (!$env:TAURI_SIGNING_PRIVATE_KEY) {
  if (!(Test-Path -LiteralPath $keyPath)) { throw '请先配置 TAURI_SIGNING_PRIVATE_KEY 签名密钥。' }
  $env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
}
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
$env:PATH = (Join-Path $env:USERPROFILE '.cargo\bin') + ';' + $env:PATH

# 已运行的测试程序只能按精确路径结束；不枚举其它项目的 Node 进程。
$targets = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -in @($releaseExe, (Join-Path $portableRoot 'ikun-music-tauri.exe')) })
foreach ($process in $targets) { Stop-Process -Id $process.ProcessId -Force }
Push-Location $ProjectRoot
try {
  & node.exe scripts/tauri-release.mjs build
  if ($LASTEXITCODE -ne 0) { throw "桌面构建未完成，退出码：$LASTEXITCODE" }
  & node.exe scripts/check-music-service.mjs $runtimeSource
  if ($LASTEXITCODE -ne 0) { throw '随包音乐服务验收未通过，停止交付。' }
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
  # 便携包需同时包含 EXE 与运行时资源。只复制小 EXE 会缺少协议库，不能作为便携版交付。
  if (Test-Path -LiteralPath $portableRoot) {
    $resolved = (Resolve-Path -LiteralPath $portableRoot).Path
    if ([IO.Path]::GetDirectoryName($resolved) -ne $OutputRoot -or (Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '便携输出目录不符合预期，停止清理。' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
  New-Item -ItemType Directory -Path $portableRoot | Out-Null
  Copy-Item -LiteralPath $releaseExe -Destination (Join-Path $portableRoot 'ikun-music-tauri.exe')
  Copy-Item -LiteralPath $runtimeSource -Destination (Join-Path $portableRoot 'runtime') -Recurse
  @{product='ikun音乐'; version=$version; format=1} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $portableRoot 'portable.json') -Encoding UTF8
  $zip = Join-Path $OutputRoot ($packageName + '-portable.zip')
  if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($portableRoot, $zip, [IO.Compression.CompressionLevel]::Optimal, $true)
  & node.exe scripts/tauri-release.mjs signer sign $zip
  if ($LASTEXITCODE -ne 0) { throw '便携包签名未完成。' }
  $setupSource = Join-Path $ProjectRoot ('src-tauri\target\release\bundle\nsis\ikun音乐_' + $version + '_x64-setup.exe')
  $setup = Join-Path $OutputRoot ($packageName + '-setup.exe')
  Copy-Item -LiteralPath $setupSource -Destination $setup -Force
  Copy-Item -LiteralPath ($setupSource + '.sig') -Destination ($setup + '.sig') -Force
  & node.exe scripts/prepare-release.mjs $OutputRoot
  if ($LASTEXITCODE -ne 0) { throw '发布清单验证未通过。' }
  Get-ChildItem -LiteralPath $OutputRoot -File | Select-Object Name, Length
} finally { Pop-Location }