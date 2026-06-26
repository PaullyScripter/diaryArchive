param(
  [switch]$Force
)

$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $PSScriptRoot

function Write-OK($msg) { Write-Host "  $([char]0x2713) $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  $([char]0x2192) $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  $([char]0x26A0) $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  DiaryArchive — Stop" -ForegroundColor Yellow
Write-Host ""

# ─── Find and kill backend ───────────────────────────────────────────────────
$beStopped = $false
$pythonProcs = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue
foreach ($proc in $pythonProcs) {
  if ($proc.CommandLine -match "uvicorn") {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    $beStopped = $true
  }
}
if ($beStopped) {
  Write-OK "Backend stopped"
} else {
  Write-Info "No backend process found"
}

# ─── Find and kill frontend ──────────────────────────────────────────────────
$feStopped = $false
$nodeProcs = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
foreach ($proc in $nodeProcs) {
  if ($proc.CommandLine -match "next dev") {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    $feStopped = $true
  }
}
if ($feStopped) {
  Write-OK "Frontend stopped"
} else {
  Write-Info "No frontend process found"
}

# ─── Stop Docker infrastructure ──────────────────────────────────────────────
$composeFile = "$root\docker-compose.infra.yml"
$containersRunning = docker compose -f $composeFile ps --status running -q 2>$null

if ($containersRunning) {
  if ($Force) {
    $answer = "y"
  } else {
    $answer = Read-Host "Stop Docker infrastructure (MongoDB + Redis)? [Y/n]"
  }
  if ($answer -notmatch '^[nN]') {
    docker compose -f $composeFile down
    Write-OK "MongoDB and Redis stopped"
  } else {
    Write-Info "Infrastructure left running. Start it with: .\scripts\infra.ps1"
  }
} else {
  Write-Info "Infrastructure is not running"
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
