param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$OutputRoot = '',
  [ValidateSet('portable', 'all')]
  [string]$Target = 'portable'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Join-Chars([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path -LiteralPath $cargoBin) {
  $env:PATH = "$cargoBin;$env:PATH"
}

$outputDirName = Join-Chars @(0x6253, 0x5305, 0x4EA7, 0x7269)
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path (Split-Path -Parent $ProjectRoot) $outputDirName
}

$musicText = Join-Chars @(0x97F3, 0x4E50)
$portableText = Join-Chars @(0x4FBF, 0x643A, 0x7248)
$setupText = Join-Chars @(0x5B89, 0x88C5, 0x7248)
$appProcessName = "ikun$musicText"
$portableProcessName = "ikun$musicText-5.1.0-$portableText"

$releaseDir = Join-Path $ProjectRoot 'src-tauri\target\release'
$bundleDir = Join-Path $releaseDir 'bundle\nsis'
$portableSource = Join-Path $releaseDir 'ikun-music-tauri.exe'
$portableTarget = Join-Path $OutputRoot "ikun$musicText-5.1.0-$portableText.exe"
$setupTarget = Join-Path $OutputRoot "ikun$musicText-5.1.0-$setupText.exe"
$portableCopiedText = Join-Chars @(0x4FBF, 0x643A, 0x7248, 0x5DF2, 0x590D, 0x5236, 0xFF1A)
$setupCopiedText = Join-Chars @(0x5B89, 0x88C5, 0x7248, 0x5DF2, 0x590D, 0x5236, 0xFF1A)
$portableMissingText = Join-Chars @(0x672A, 0x627E, 0x5230, 0x4FBF, 0x643A, 0x7248, 0x0020, 0x0065, 0x0078, 0x0065, 0xFF1A)
$setupMissingText = Join-Chars @(0x672A, 0x627E, 0x5230, 0x5B89, 0x88C5, 0x7248, 0x0020, 0x0073, 0x0065, 0x0074, 0x0075, 0x0070, 0x0020, 0x0065, 0x0078, 0x0065, 0xFF1A)

Push-Location $ProjectRoot
try {
  npm run build:desktop
} finally {
  Pop-Location
}

Push-Location (Join-Path $ProjectRoot 'src-tauri')
try {
  cargo build --release
} finally {
  Pop-Location
}

Get-Process 'ikun-music-tauri', $appProcessName, $portableProcessName -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process |
  Where-Object {
    $_.ExecutablePath -in @($portableSource, $portableTarget) -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*alger-music-api.js*')
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

if (!(Test-Path -LiteralPath $portableSource)) {
  throw ($portableMissingText + $portableSource)
}

New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
Copy-Item -LiteralPath $portableSource -Destination $portableTarget -Force

Write-Host ($portableCopiedText + $portableTarget)

if ($Target -eq 'all') {
  Push-Location $ProjectRoot
  try {
    npm run tauri:build
  } finally {
    Pop-Location
  }

  $setupSource = Get-ChildItem -Path $bundleDir -Filter '*setup.exe' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if ($null -eq $setupSource) {
    throw ($setupMissingText + $bundleDir)
  }

  Copy-Item -LiteralPath $setupSource.FullName -Destination $setupTarget -Force
  Write-Host ($setupCopiedText + $setupTarget)
}
