param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$NodeExe = ''
)
$ErrorActionPreference = 'Stop'
$previousNode = $env:IKUN_NODE_BINARY
try {
  if ($NodeExe) { $env:IKUN_NODE_BINARY = (Resolve-Path -LiteralPath $NodeExe).Path }
  & node.exe (Join-Path $ProjectRoot 'scripts/prepare-music-api-runtime.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Music runtime preparation failed: $LASTEXITCODE" }
} finally {
  $env:IKUN_NODE_BINARY = $previousNode
}
