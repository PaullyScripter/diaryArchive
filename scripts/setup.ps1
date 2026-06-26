param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# ------------------------------------------------------------------
# Helpers (ASCII only so the script works on PowerShell 5.1 and 7+)
# ------------------------------------------------------------------
function Write-Step($msg)  { Write-Host "`n$msg" -ForegroundColor White }
function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  -> $msg"   -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "  ! $msg"    -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "  [X] $msg"  -ForegroundColor Red }

Write-Host ""
Write-Host "  DiaryArchive - Setup" -ForegroundColor Cyan
Write-Host ""

# === Step 1: Verify prerequisites =================================
Write-Step "Checking prerequisites..."
$errors = 0

# --- Python ---
try {
  $pyVer = python --version 2>&1
  $pyVerStr = ($pyVer -replace 'Python ','' -replace '`n','' -replace '`r','').Trim()
  $pyMajor = [int](($pyVerStr -split '\.')[0])
  $pyMinor = [int](($pyVerStr -split '\.')[1])
  if ($pyMajor -ge 3 -and $pyMinor -ge 13) {
    Write-OK "Python $pyVerStr"
  } elseif ($pyMajor -ge 3 -and $pyMinor -ge 12) {
    Write-Warn "Python $pyVerStr (3.13+ recommended)"
  } else {
    Write-Fail "Python 3.13+ required (found $pyVerStr)"
    $errors++
  }
} catch {
  Write-Fail "Python is not installed. Install it from https://www.python.org/downloads/"
  $errors++
}

# --- Node.js ---
try {
  $nodeVer = node --version 2>&1
  $nodeVerStr = ($nodeVer -replace 'v','').Trim()
  $nodeMajor = [int]($nodeVerStr -split '\.')[0]
  if ($nodeMajor -ge 18) {
    Write-OK "Node.js $nodeVerStr"
  } else {
    Write-Fail "Node.js 18+ required (found $nodeVerStr)"
    $errors++
  }
} catch {
  Write-Fail "Node.js is not installed. Install it from https://nodejs.org/en/download/"
  $errors++
}

# --- Docker ---
try {
  $dockerVer = docker --version 2>&1
  Write-OK $dockerVer
  # Check Docker is actually running
  $dockerInfo = docker info 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "Docker Desktop is installed but not running. Start it from the Start menu."
  }
} catch {
  Write-Fail "Docker Desktop is not installed. Install it from https://www.docker.com/products/docker-desktop/"
  $errors++
}

if ($errors -gt 0) {
  Write-Host "`nInstall missing dependencies above, then re-run this script." -ForegroundColor Red
  exit 1
}

# === Step 2: Install backend dependencies =========================
$depsMarker = "$root\backend\.deps_installed"
Write-Step "Installing backend dependencies..."
if ((-not (Test-Path $depsMarker)) -or $Force) {
  Write-Info "Running pip install..."
  Push-Location "$root\backend"
  $ErrorActionPreference = "Continue"
  pip install -e ".[dev]" -q 2>&1 | Out-Null
  $pipCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($pipCode -eq 0) {
    Write-OK "Backend dependencies installed"
    New-Item -ItemType File -Path $depsMarker -Force | Out-Null
  } else {
    Write-Fail "Failed to install backend dependencies (pip exit code $pipCode)"
    Pop-Location
    exit 1
  }
  Pop-Location
} else {
  Write-OK "Backend dependencies cached (use -Force to reinstall)"
}

# === Step 3: Install frontend dependencies =======================
Write-Step "Installing frontend dependencies..."
if ((-not (Test-Path "$root\frontend\node_modules")) -or $Force) {
  Write-Info "Running npm install..."
  Push-Location "$root\frontend"
  $ErrorActionPreference = "Continue"
  npm install --silent 2>&1 | Out-Null
  $npmCode = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($npmCode -eq 0) {
    Write-OK "Frontend dependencies installed"
  } else {
    Write-Fail "Failed to install frontend dependencies (npm exit code $npmCode)"
    Pop-Location
    exit 1
  }
  Pop-Location
} else {
  Write-OK "Frontend dependencies cached (use -Force to reinstall)"
}

# === Step 4: Create .env files if missing ========================
Write-Step "Setting up environment files..."
if (-not (Test-Path "$root\backend\.env")) {
  Copy-Item "$root\backend\.env.development" "$root\backend\.env"
  Write-OK "Created backend\.env from .env.development"
} else {
  Write-OK "backend\.env exists"
}

if (-not (Test-Path "$root\frontend\.env.development.local")) {
  if (Test-Path "$root\frontend\.env.development") {
    Copy-Item "$root\frontend\.env.development" "$root\frontend\.env.development.local"
    Write-OK "Created frontend\.env.development.local"
  }
} else {
  Write-OK "frontend\.env.development.local exists"
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green