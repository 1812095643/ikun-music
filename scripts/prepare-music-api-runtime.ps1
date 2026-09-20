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
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $ProjectRoot 'src-tauri\runtime-stage'))
$runtimeDir = $runtimeRoot
$signaturePath = Join-Path $runtimeRoot '.runtime-signature'
$manifestDir = Join-Path $ProjectRoot 'src-tauri\runtime'
$scriptSource = Join-Path $manifestDir 'music-service.cjs'
$playbackSource = Join-Path $manifestDir 'kuwo-playback.cjs'
$manifestPath = Join-Path $manifestDir 'package.json'
$lockPath = Join-Path $manifestDir 'package-lock.json'

$inputPaths = @($NodeExe, $scriptSource, $playbackSource, $manifestPath, $lockPath, $PSCommandPath)
$signature = ($inputPaths | ForEach-Object {
  $stream = [IO.File]::OpenRead($_)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
  finally { $stream.Dispose(); $sha.Dispose() }
}) -join ':'
if ((Test-Path -LiteralPath (Join-Path $runtimeDir 'node.exe')) -and (Test-Path -LiteralPath $signaturePath)) {
  if ((Get-Content -LiteralPath $signaturePath -Raw).Trim() -eq $signature) {
    Write-Host 'Reusing the verified music service runtime.'
    exit 0
  }
}

$expectedRoot = Join-Path $ProjectRoot 'src-tauri\runtime-stage'
if ($runtimeRoot -ne $expectedRoot -or !$runtimeRoot.StartsWith($ProjectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Runtime directory is outside the project.'
}
if (Test-Path -LiteralPath $runtimeRoot) {
  Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $runtimeDir 'node.exe')
Copy-Item -LiteralPath $scriptSource -Destination (Join-Path $runtimeDir 'music-service.cjs')
Copy-Item -LiteralPath $playbackSource -Destination (Join-Path $runtimeDir 'kuwo-playback.cjs')
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $runtimeDir 'package.json')
Copy-Item -LiteralPath $lockPath -Destination (Join-Path $runtimeDir 'package-lock.json')

Push-Location $runtimeDir
try {
  & npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "Runtime dependency installation failed: $LASTEXITCODE" }
  & $NodeExe --check (Join-Path $runtimeDir 'music-service.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Music service syntax check failed.' }
  & $NodeExe --check (Join-Path $runtimeDir 'kuwo-playback.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Playback module syntax check failed.' }
} finally {
  Pop-Location
}

[IO.File]::WriteAllText($signaturePath, $signature, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Music service runtime is ready for packaging.'
