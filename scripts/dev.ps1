param(
  [switch]$SkipSetup,
  [switch]$SkipInfra,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "DiaryArchive Dev"

# Write status line to console without newline helpers
function Write-OK($msg) { Write-Host "  $([char]0x2713) $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  $([char]0x2192) $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  $([char]0x26A0) $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  $([char]0x2717) $msg" -ForegroundColor Red }

$BACKEND_PORT = 8000
$FRONTEND_PORT = 3000

# ─── Step 1: Run setup ───────────────────────────────────────────────────────
if (-not $SkipSetup) {
  & "$root\scripts\setup.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# ─── Step 2: Start infrastructure ────────────────────────────────────────────
if (-not $SkipInfra) {
  & "$root\scripts\infra.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# ─── Step 3: Kill any existing dev processes on our ports ─────────────────────
$existingBE = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
if ($existingBE) {
  $proc = Get-Process -Id $existingBE.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "python") {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

# ─── Step 4: Start backend ───────────────────────────────────────────────────
Write-Host ""
Write-Info "Starting backend on port $BACKEND_PORT..."
$backendLogDir = "$root\backend"
$backendProcess = Start-Process -FilePath "uvicorn" -ArgumentList "app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT" `
  -WorkingDirectory "$root\backend" `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput "$backendLogDir\.dev-stdout.log" `
  -RedirectStandardError "$backendLogDir\.dev-stderr.log"

# ─── Step 5: Start frontend ──────────────────────────────────────────────────
Write-Info "Starting frontend on port $FRONTEND_PORT..."
$frontendLogDir = "$root\frontend"
$frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run dev" `
  -WorkingDirectory "$root\frontend" `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput "$frontendLogDir\.dev-stdout.log" `
  -RedirectStandardError "$frontendLogDir\.dev-stderr.log"

# ─── Step 6: Wait for backend health ─────────────────────────────────────────
Write-Info "Waiting for backend to be ready..."
$backendReady = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:$BACKEND_PORT/api/v1/health" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Write-OK "Backend is ready"
      $backendReady = $true
      break
    }
  } catch {}
  if ($i -eq 0) { Write-Info "  Polling..." }
  Start-Sleep -Seconds 1
}
if (-not $backendReady) {
  Write-Warn "Backend health check timed out. Check $backendLogDir\.dev-stderr.log for errors."
}

# ─── Step 7: Wait for frontend ───────────────────────────────────────────────
Write-Info "Waiting for frontend..."
$frontendReady = $false
for ($i = 0; $i -lt 45; $i++) {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:$FRONTEND_PORT" -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      Write-OK "Frontend is ready"
      $frontendReady = $true
      break
    }
  } catch {}
  if ($i -eq 0) { Write-Info "  Polling..." }
  Start-Sleep -Seconds 1
}
if (-not $frontendReady) {
  Write-Warn "Frontend health check timed out. Check $frontendLogDir\.dev-stdout.log for errors."
}

# ─── Step 8: Open browser ────────────────────────────────────────────────────
if (-not $NoBrowser) {
  try {
    Start-Process "http://localhost:$FRONTEND_PORT"
  } catch {}
}

# ─── Step 9: Dashboard ───────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        DiaryArchive — Development Mode           ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# URLs
Write-Host "  Frontend    " -NoNewline; Write-Host "http://localhost:$FRONTEND_PORT" -ForegroundColor DarkGray
Write-Host "  Backend     " -NoNewline; Write-Host "http://localhost:$BACKEND_PORT" -ForegroundColor DarkGray
Write-Host "  API Docs    " -NoNewline; Write-Host "http://localhost:$BACKEND_PORT/docs" -ForegroundColor DarkGray
Write-Host ""

# Service status
Write-Host "  Services" -ForegroundColor White

$mongoDot = "○"; $mongoColor = "Red"
try {
  $mongoResult = docker compose -f "$root\docker-compose.infra.yml" exec -T mongodb mongosh --quiet --eval 'db.runCommand("ping").ok' 2>&1
  if ($mongoResult -match "1") { $mongoDot = "●"; $mongoColor = "Green" }
} catch {}
Write-Host "    " -NoNewline; Write-Host $mongoDot -ForegroundColor $mongoColor -NoNewline; Write-Host " MongoDB  port 27017"

$redisDot = "○"; $redisColor = "Red"
try {
  $redisResult = docker compose -f "$root\docker-compose.infra.yml" exec -T redis redis-cli ping 2>&1
  if ($redisResult -match "PONG") { $redisDot = "●"; $redisColor = "Green" }
} catch {}
Write-Host "    " -NoNewline; Write-Host $redisDot -ForegroundColor $redisColor -NoNewline; Write-Host " Redis    port 6379"

Write-Host "    ○ Meilisearch port 7700 (optional, not started)" -ForegroundColor DarkGray
Write-Host ""

# Process status
$beRunning = $null -ne (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)
$feRunning = $null -ne (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)

if ($beRunning) { Write-Host "  ● Backend running (PID $($backendProcess.Id))" -ForegroundColor Green }
else { Write-Host "  ○ Backend stopped" -ForegroundColor Yellow }

if ($feRunning) { Write-Host "  ● Frontend running (PID $($frontendProcess.Id))" -ForegroundColor Green }
else { Write-Host "  ○ Frontend stopped" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Commands:" -ForegroundColor DarkGray
Write-Host "    Q        Quit and stop all services" -ForegroundColor DarkGray
Write-Host "    L        Tail backend logs" -ForegroundColor DarkGray
Write-Host "    F        Tail frontend logs" -ForegroundColor DarkGray
Write-Host "    R        Refresh dashboard" -ForegroundColor DarkGray
Write-Host ""

# ─── Interactive loop ────────────────────────────────────────────────────────
function Show-Dashboard {
  Clear-Host
  # Quick status refresh
  $mongoDot = "○"; $mongoColor = "Red"
  try {
    $mongoResult = docker compose -f "$root\docker-compose.infra.yml" exec -T mongodb mongosh --quiet --eval 'db.runCommand("ping").ok' 2>&1
    if ($mongoResult -match "1") { $mongoDot = "●"; $mongoColor = "Green" }
  } catch {}
  $redisDot = "○"; $redisColor = "Red"
  try {
    $redisResult = docker compose -f "$root\docker-compose.infra.yml" exec -T redis redis-cli ping 2>&1
    if ($redisResult -match "PONG") { $redisDot = "●"; $redisColor = "Green" }
  } catch {}
  $beRunning = $null -ne (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)
  $feRunning = $null -ne (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)

  Write-Host ""
  Write-Host "  ╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "  ║        DiaryArchive — Development Mode           ║" -ForegroundColor Cyan
  Write-Host "  ╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Frontend    http://localhost:$FRONTEND_PORT" -ForegroundColor DarkGray
  Write-Host "  Backend     http://localhost:$BACKEND_PORT" -ForegroundColor DarkGray
  Write-Host "  API Docs    http://localhost:$BACKEND_PORT/docs" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  Services" -ForegroundColor White
  Write-Host "    " -NoNewline; Write-Host $mongoDot -ForegroundColor $mongoColor -NoNewline; Write-Host " MongoDB  port 27017"
  Write-Host "    " -NoNewline; Write-Host $redisDot -ForegroundColor $redisColor -NoNewline; Write-Host " Redis    port 6379"
  Write-Host "    ○ Meilisearch port 7700 (optional, not started)" -ForegroundColor DarkGray
  Write-Host ""
  if ($beRunning) { Write-Host "  ● Backend running (PID $($backendProcess.Id))" -ForegroundColor Green }
  else { Write-Host "  ○ Backend stopped" -ForegroundColor Yellow }
  if ($feRunning) { Write-Host "  ● Frontend running (PID $($frontendProcess.Id))" -ForegroundColor Green }
  else { Write-Host "  ○ Frontend stopped" -ForegroundColor Yellow }
  Write-Host ""
  Write-Host "  Q=Quit  L=Backend logs  F=Frontend logs  R=Refresh" -ForegroundColor DarkGray
  Write-Host ""
}

function Tail-Log($path, $label) {
  if (-not (Test-Path $path)) { Write-Host "Log file not found: $path"; return }
  Write-Host "── $label logs (Ctrl+C to return to dashboard) ──" -ForegroundColor Cyan
  try {
    Get-Content $path -Tail 30 -Wait
  } catch {
    # User pressed Ctrl+C to return
  }
  Show-Dashboard
}

try {
  do {
    $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    switch ($key.Character) {
      'q' { break }
      'l' { Tail-Log "$root\backend\.dev-stderr.log" "Backend" }
      'f' { Tail-Log "$root\frontend\.dev-stdout.log" "Frontend" }
      'r' { Show-Dashboard }
    }
  } while ($key.Character -ne 'q')
} finally {
  Write-Host "`nShutting down..." -ForegroundColor Yellow
  if ($backendProcess -and (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-OK "Backend stopped"
  }
  if ($frontendProcess -and (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-OK "Frontend stopped"
  }
  Write-Host ""
  Write-Host "Tip: Run .\scripts\stop.ps1 to also stop Docker infrastructure." -ForegroundColor DarkGray
  Write-Host "Goodbye!" -ForegroundColor Green
}
