param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$OutputRoot = '',
  [ValidateSet('portable','all')][string]$Target = 'all',
  [ValidateSet('x64','arm64')][string]$Architecture = 'x64',
  [string]$NodeExe = ''
)
$ErrorActionPreference = 'Stop'
$previousNode = $env:IKUN_NODE_BINARY
$buildTarget = 'x86_64-pc-windows-msvc'
if ($Architecture -eq 'arm64') { $buildTarget = 'aarch64-pc-windows-msvc' }
try {
  if ($NodeExe) { $env:IKUN_NODE_BINARY = (Resolve-Path -LiteralPath $NodeExe).Path }
  $buildArgs = @((Join-Path $ProjectRoot 'scripts/package-desktop.mjs'), "--target=$buildTarget")
  if ($OutputRoot) { $buildArgs += "--output=$([IO.Path]::GetFullPath($OutputRoot))" }
  & node.exe @buildArgs
  if ($LASTEXITCODE -ne 0) { throw "Desktop packaging failed: $LASTEXITCODE" }
} finally {
  $env:IKUN_NODE_BINARY = $previousNode
}
