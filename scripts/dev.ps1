param(
  [switch]$SkipSetup,
  [switch]$SkipInfra,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$Host.UI.RawUI.WindowTitle = "DiaryArchive Dev"

# ------------------------------------------------------------------
# Helpers (ASCII only so the script works on PowerShell 5.1 and 7+)
# ------------------------------------------------------------------
function Write-OK($msg)   { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  -> $msg"     -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  ! $msg"      -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [X] $msg"    -ForegroundColor Red }

function Write-Tag($tag, $color, $message) {
  $pad = "$tag".PadRight(6)
  Write-Host "  " -NoNewline
  Write-Host $pad -ForegroundColor $color -NoNewline
  Write-Host " $message"
}

$BACKEND_PORT  = 8000
$FRONTEND_PORT = 3000
$composeFile   = "$root\docker-compose.infra.yml"

# === Step 1: Run setup ===========================================
if (-not $SkipSetup) {
  & "$root\scripts\setup.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# === Step 2: Start infrastructure ===============================
if (-not $SkipInfra) {
  & "$root\scripts\infra.ps1"
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# === Step 3: Kill any existing dev processes on our ports =======
$existingBE = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue
if ($existingBE) {
  $proc = Get-Process -Id $existingBE.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq "python") {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

# === Step 4: Start backend ======================================
Write-Host ""
Write-Info "Starting backend on port $BACKEND_PORT..."
$backendLogDir = "$root\backend"

# Resolve the backend Python from its virtualenv so we don't depend on PATH.
$venvPython = "$root\backend\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Write-Fail "Backend virtualenv not found at $venvPython"
  Write-Info "Create it with: cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -e .[dev]"
  exit 1
}

$backendProcess = Start-Process -FilePath $venvPython `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", $BACKEND_PORT) `
  -WorkingDirectory "$root\backend" `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput "$backendLogDir\.dev-stdout.log" `
  -RedirectStandardError "$backendLogDir\.dev-stderr.log"

# === Step 5: Start frontend =====================================
Write-Info "Starting frontend on port $FRONTEND_PORT..."
$frontendLogDir = "$root\frontend"

# Resolve npm.cmd so Start-Process works on PowerShell 5.1 (where "npm" alone
# resolves to npm.ps1, which Start-Process cannot launch directly).
$npmCmd = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = "npm.cmd" }

$frontendProcess = Start-Process -FilePath $npmCmd `
  -ArgumentList "run dev" `
  -WorkingDirectory "$root\frontend" `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput "$frontendLogDir\.dev-stdout.log" `
  -RedirectStandardError "$frontendLogDir\.dev-stderr.log"

# === Step 6: Wait for backend health ===========================
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

# === Step 7: Wait for frontend =================================
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

# === Step 8: Open browser ======================================
if (-not $NoBrowser) {
  try {
    Start-Process "http://localhost:$FRONTEND_PORT"
  } catch {}
}

# === Step 9: Dashboard + interactive loop =====================

function Get-ServiceStatus {
  $status = @{
    Mongo  = @{ Tag = "[DOWN]"; Color = "Red"   }
    Redis  = @{ Tag = "[DOWN]"; Color = "Red"   }
    Meili  = @{ Tag = "[DOWN]"; Color = "Red" }
  }

  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $mongoResult = docker compose -f "$composeFile" exec -T mongodb mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>&1
    if ($LASTEXITCODE -eq 0 -and "$mongoResult" -match "1") { $status.Mongo.Tag = "[OK]"; $status.Mongo.Color = "Green" }
  } catch {}
  try {
    $redisResult = docker compose -f "$composeFile" exec -T redis redis-cli ping 2>&1
    if ($LASTEXITCODE -eq 0 -and "$redisResult" -match "PONG") { $status.Redis.Tag = "[OK]"; $status.Redis.Color = "Green" }
  } catch {}
  try {
    $meiliResult = Invoke-RestMethod -Uri "http://localhost:7700/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    if ($meiliResult.status -eq "available") { $status.Meili.Tag = "[OK]"; $status.Meili.Color = "Green" }
  } catch {}
  $ErrorActionPreference = $prev

  $status
}

function Show-Dashboard {
  param($Backend, $Frontend)
  Clear-Host

  $svc = Get-ServiceStatus

  $beRunning = $null -ne (Get-Process -Id $Backend.Id -ErrorAction SilentlyContinue)
  $feRunning = $null -ne (Get-Process -Id $Frontend.Id -ErrorAction SilentlyContinue)

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host "               DiaryArchive Development Mode"               -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host ""

  Write-Host "URLs" -ForegroundColor White
  Write-Host "  Frontend : http://localhost:$FRONTEND_PORT"
  Write-Host "  Backend  : http://localhost:$BACKEND_PORT"
  Write-Host "  API Docs : http://localhost:$BACKEND_PORT/docs"
  Write-Host ""

  Write-Host "Services" -ForegroundColor White
  Write-Tag $svc.Mongo.Tag $svc.Mongo.Color "MongoDB      27017"
  Write-Tag $svc.Redis.Tag $svc.Redis.Color "Redis        6379"
  Write-Tag $svc.Meili.Tag $svc.Meili.Color "Meilisearch  7700"
  Write-Host ""

  Write-Host "Processes" -ForegroundColor White
  if ($beRunning) {
    Write-Tag "[OK]"   "Green"  "Backend running (PID $($Backend.Id))"
  } else {
    Write-Tag "[DOWN]" "Yellow" "Backend stopped"
  }
  if ($feRunning) {
    Write-Tag "[OK]"   "Green"  "Frontend running (PID $($Frontend.Id))"
  } else {
    Write-Tag "[DOWN]" "Yellow" "Frontend stopped"
  }
  Write-Host ""

  Write-Host "Commands" -ForegroundColor White
  Write-Host "  Q  - Quit"
  Write-Host "  L  - Backend logs"
  Write-Host "  F  - Frontend logs"
  Write-Host "  R  - Refresh dashboard"
  Write-Host ""
}

function Tail-Log($path, $label, $Backend, $Frontend) {
  if (-not (Test-Path $path)) {
    Write-Warn "Log file not found: $path"
    Start-Sleep -Seconds 2
    Show-Dashboard -Backend $Backend -Frontend $Frontend
    return
  }
  Write-Host ""
  Write-Host "========== $label logs (Ctrl+C to return to dashboard) ==========" -ForegroundColor Cyan
  Write-Host ""
  try {
    Get-Content $path -Tail 30 -Wait
  } catch {
    # User pressed Ctrl+C to return
  }
  Show-Dashboard -Backend $Backend -Frontend $Frontend
}

# Initial dashboard render
Show-Dashboard -Backend $backendProcess -Frontend $frontendProcess

try {
  do {
    $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    switch ($key.Character) {
      'q' { break }
      'l' { Tail-Log "$root\backend\.dev-stderr.log"  "Backend"  $backendProcess  $frontendProcess }
      'f' { Tail-Log "$root\frontend\.dev-stdout.log" "Frontend" $backendProcess  $frontendProcess }
      'r' { Show-Dashboard -Backend $backendProcess -Frontend $frontendProcess }
    }
  } while ($key.Character -ne 'q')
}
finally {
  Write-Host ""
  Write-Host "Shutting down..." -ForegroundColor Yellow
  if ($backendProcess -and (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-OK "Backend stopped"
  }
  if ($frontendProcess -and (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    Write-OK "Frontend stopped"
  }
  Write-Host ""
  Write-Info "Run .\scripts\stop.ps1 to also stop Docker infrastructure."
  Write-Host "Goodbye!" -ForegroundColor Green
}