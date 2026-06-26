param(
  [switch]$Frontend,
  [switch]$NoSummary
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# ------------------------------------------------------------------
# Helpers (ASCII only so the script works on PowerShell 5.1 and 7+)
# ------------------------------------------------------------------
function Write-OK($msg)   { Write-Host "  [OK] $msg"  -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [X] $msg"   -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "  ! $msg"    -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "  -> $msg"   -ForegroundColor Cyan }
function Write-Step($msg) { Write-Host "`n$msg"       -ForegroundColor White }

Write-Host ""
Write-Host "  DiaryArchive - Test Runner" -ForegroundColor Cyan
Write-Host ""

$backendPassed  = $true
$frontendPassed = $true

# === Backend tests =============================================
Write-Step "Running backend tests..."
Push-Location "$root\backend"
$ErrorActionPreference = "Continue"
$beOutput = python -m pytest -v 2>&1
$beExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
Pop-Location

if ($beExitCode -eq 0) {
  Write-OK "Backend tests passed"
} else {
  Write-Fail "Backend tests failed (exit code $beExitCode)"
  $backendPassed = $false
}

# Show backend test summary (last few lines of output)
$beOutput -split "`n" | Select-Object -Last 10 | ForEach-Object {
  if ($_) { Write-Host "    $_" -ForegroundColor DarkGray }
}

# === Frontend tests (optional, requires -Frontend flag) ========
if ($Frontend) {
  Write-Step "Running frontend tests..."
  Push-Location "$root\frontend"

  # Check if Playwright is available
  if (Test-Path "$root\frontend\node_modules\.bin\playwright") {
    $ErrorActionPreference = "Continue"
    $npxCmd = (Get-Command "npx.cmd" -ErrorAction SilentlyContinue).Source
    if (-not $npxCmd) { $npxCmd = "npx.cmd" }
    $feOutput = & $npxCmd playwright test 2>&1
    $feExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    Pop-Location

    if ($feExitCode -eq 0) {
      Write-OK "Frontend tests passed"
    } else {
      Write-Fail "Frontend tests failed (exit code $feExitCode)"
      $frontendPassed = $false
    }

    $feOutput -split "`n" | Select-Object -Last 10 | ForEach-Object {
      if ($_) { Write-Host "    $_" -ForegroundColor DarkGray }
    }
  } else {
    Pop-Location
    Write-Warn "Playwright not found. Install it: cd frontend; npx playwright install"
    $frontendPassed = $false
  }
} else {
  Write-Info "Skipping frontend tests (use -Frontend flag to include them)"
}

# === Summary ===================================================
if (-not $NoSummary) {
  Write-Step "Test Summary"
  if ($backendPassed) { Write-OK "Backend" } else { Write-Fail "Backend" }
  if ($Frontend) {
    if ($frontendPassed) { Write-OK "Frontend" } else { Write-Fail "Frontend" }
  } else {
    Write-Info "Frontend not run (pass -Frontend)"
  }

  $allPassed = $backendPassed -and ($Frontend -eq $false -or $frontendPassed)
  if ($allPassed) {
    Write-Host ""
    Write-Host "All tests passed!" -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Some tests failed. See output above for details." -ForegroundColor Yellow
  }
}

if (-not $backendPassed) { exit 1 }