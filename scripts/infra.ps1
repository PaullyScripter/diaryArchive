param(
  [switch]$Down
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Write-OK($msg) { Write-Host "  $([char]0x2713) $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  $([char]0x2192) $msg" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "  $([char]0x2717) $msg" -ForegroundColor Red }

$composeFile = "$root\docker-compose.infra.yml"

if ($Down) {
  Write-Host "Stopping infrastructure..." -ForegroundColor Yellow
  docker compose -f $composeFile down
  if ($LASTEXITCODE -eq 0) {
    Write-OK "MongoDB and Redis stopped"
  } else {
    Write-Fail "Failed to stop infrastructure"
  }
  exit
}

Write-Host ""
Write-Host "  DiaryArchive — Starting Infrastructure" -ForegroundColor Cyan
Write-Host ""

# ─── Start containers ────────────────────────────────────────────────────────
Write-Info "Starting MongoDB and Redis..."
docker compose -f $composeFile up -d 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Fail "Failed to start Docker containers. Is Docker Desktop running?"
  Write-Host "  Start Docker Desktop from the Start Menu and try again." -ForegroundColor Yellow
  exit 1
}

# ─── Wait for MongoDB health ─────────────────────────────────────────────────
Write-Info "Waiting for MongoDB..."
$mongoOk = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $result = docker compose -f $composeFile exec -T mongodb mongosh --quiet --eval 'db.runCommand("ping").ok' 2>&1
    if ($result -match "1") {
      Write-OK "MongoDB is healthy on port 27017"
      $mongoOk = $true
      break
    }
  } catch {}
  if ($i -eq 0) { Write-Info "  Polling..." }
  Start-Sleep -Seconds 1
}
if (-not $mongoOk) {
  Write-Fail "MongoDB failed to start within 30 seconds"
  Write-Info "Check logs: docker compose -f $composeFile logs mongodb"
  exit 1
}

# ─── Wait for Redis health ───────────────────────────────────────────────────
Write-Info "Waiting for Redis..."
$redisOk = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    $result = docker compose -f $composeFile exec -T redis redis-cli ping 2>&1
    if ($result -match "PONG") {
      Write-OK "Redis is healthy on port 6379"
      $redisOk = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $redisOk) {
  Write-Fail "Redis failed to start within 15 seconds"
  Write-Info "Check logs: docker compose -f $composeFile logs redis"
  exit 1
}

Write-Host ""
Write-Host "Infrastructure ready." -ForegroundColor Green
