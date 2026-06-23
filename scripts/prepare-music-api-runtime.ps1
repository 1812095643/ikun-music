param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$NodeExe = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Join-Chars([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

function Build-Message([int[]]$Codes, [string]$Value) {
  return (Join-Chars $Codes) + $Value
}

$runtimeRoot = Join-Path $ProjectRoot 'src-tauri\embedded-runtime'
$runtimeDir = Join-Path $runtimeRoot 'music-api-runtime'
$zipPath = Join-Path $runtimeRoot 'music-api-runtime.zip'
$scriptSource = Join-Path $ProjectRoot 'src-tauri\bin\alger-music-api.js'
$packageJson = Join-Path $ProjectRoot 'package.json'
$packageLock = Join-Path $ProjectRoot 'package-lock.json'

if (!(Test-Path -LiteralPath $NodeExe)) {
  throw (Build-Message @(0x627E, 0x4E0D, 0x5230, 0x0020, 0x004E, 0x006F, 0x0064, 0x0065, 0x0020, 0x8FD0, 0x884C, 0x65F6, 0xFF1A) $NodeExe)
}
if (!(Test-Path -LiteralPath $scriptSource)) {
  throw (Build-Message @(0x627E, 0x4E0D, 0x5230, 0x97F3, 0x4E50, 0x0020, 0x0041, 0x0050, 0x0049, 0x0020, 0x811A, 0x672C, 0xFF1A) $scriptSource)
}

if (Test-Path -LiteralPath $runtimeRoot) {
  Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $runtimeDir 'bin') -Force | Out-Null

Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $runtimeDir 'node.exe') -Force
Copy-Item -LiteralPath $scriptSource -Destination (Join-Path $runtimeDir 'bin\alger-music-api.js') -Force
Copy-Item -LiteralPath $packageJson -Destination (Join-Path $runtimeDir 'package.json') -Force
Copy-Item -LiteralPath $packageLock -Destination (Join-Path $runtimeDir 'package-lock.json') -Force

Push-Location $runtimeDir
try {
  npm ci --omit=dev --ignore-scripts
} finally {
  Pop-Location
}

Get-ChildItem -LiteralPath (Join-Path $runtimeDir 'node_modules') -Directory -Force |
  Where-Object { $_.Name -in '.bin', '.cache', '.vite', '.vue-global-types' } |
  Remove-Item -Recurse -Force

Compress-Archive -Path (Join-Path $runtimeDir '*') -DestinationPath $zipPath -Force

$zipInfo = Get-Item -LiteralPath $zipPath
$message = Join-Chars @(0x97F3, 0x4E50, 0x0020, 0x0041, 0x0050, 0x0049, 0x0020, 0x5185, 0x7F6E, 0x8FD0, 0x884C, 0x65F6, 0x5DF2, 0x751F, 0x6210, 0xFF1A)
Write-Host ($message + $zipInfo.FullName + " ($([math]::Round($zipInfo.Length / 1MB, 2)) MB)")
