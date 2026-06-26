# Developer Getting Started Guide

## Prerequisites

Install these tools **before** cloning the repository.

### Required Software

| Software | Minimum Version | Install Link |
|----------|----------------|--------------|
| Python | 3.13 | https://www.python.org/downloads/ |
| Node.js | 18 | https://nodejs.org/en/download/ |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop/ |
| PowerShell | 5.1 (ships with Windows) | preinstalled |

### Windows-Specific Instructions

**Python:** During installation, check **"Add Python to PATH"**. After install, restart PowerShell and verify:

```powershell
python --version
```

Expected output: `Python 3.13.x` or later.

**Node.js:** The installer adds `node` and `npm` to PATH automatically. Verify:

```powershell
node --version
npm --version
```

Expected: `v18.x.x` or later for node, `10.x.x` or later for npm.

**Docker Desktop:**
1. Download from https://www.docker.com/products/docker-desktop/
2. Run the installer (WSL 2 backend recommended)
3. Launch Docker Desktop from the Start menu
4. Wait for the whale icon in the system tray to stop animating
5. Verify:

```powershell
docker info
```

If this errors, Docker Desktop is not running. Open it from the Start menu and wait for it to show "Engine running".

**PowerShell Execution Policy:** If you get a security error when running scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## First-Time Setup

### Step 1: Clone the Repository

```powershell
git clone <repository-url> diaryarchive
cd diaryarchive
```

### Step 2: Verify All Prerequisites

Run these commands to confirm everything is installed:

```powershell
python --version
```

**Expected:** `Python 3.13.x`

```powershell
node --version
```

**Expected:** `v18.x.x` or higher

```powershell
docker --version
```

**Expected:** `Docker version 24.x.x` or higher

```powershell
docker info
```

**Expected:** Prints Docker system information (no errors).

**If `docker info` fails:** Docker Desktop is not running. Open Docker Desktop from the Start menu and wait for the status to show "Running". Then retry.

### Step 3: Run the Setup Script

```powershell
.\scripts\setup.ps1
```

**What this does:**
- Verifies Python 3.13+ is installed
- Verifies Node.js 18+ is installed
- Verifies Docker Desktop is installed
- Installs Python dependencies (`pip install -e "backend[dev]"`)
- Installs Node.js dependencies (`npm install` in `frontend/`)
- Creates `backend\.env` from `backend\.env.development` (if missing)
- Creates `frontend\.env.development.local` from `frontend\.env.development` (if missing)

**Expected output:**

```
  DiaryArchive — Setup

Checking prerequisites...
  ✓ Python 3.13.x
  ✓ Node.js v18.x.x
  ✓ Docker Desktop

Installing backend dependencies...
  ✓ Backend dependencies installed

Installing frontend dependencies...
  ✓ Frontend dependencies installed

Setting up environment files...
  ✓ backend\.env exists
  ✓ frontend\.env.development.local exists

Setup complete.
```

**Common errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Python is not installed` | Python not found on PATH | Reinstall Python, check "Add to PATH" |
| `Node.js 18+ required` | Old Node.js version | Download latest from nodejs.org |
| `Docker Desktop is not installed` | Docker not found | Install Docker Desktop from docker.com |
| `pip install failed` | Network issue or build error | Run manually: `cd backend && pip install -e ".[dev]"` |
| `npm install failed` | Network issue | Run manually: `cd frontend && npm install` |

### Step 4: Start Infrastructure (Docker)

You can start just the infrastructure to verify MongoDB and Redis:

```powershell
.\scripts\infra.ps1
```

**What this does:**
- Runs `docker compose -f docker-compose.infra.yml up -d`
- Starts MongoDB on port 27017
- Starts Redis on port 6379
- Waits for both to respond to health checks (up to 30 seconds for MongoDB, 15 for Redis)

**Expected output:**

```
  DiaryArchive — Starting Infrastructure

  → Starting MongoDB and Redis...
  → Waiting for MongoDB...
  ✓ MongoDB is healthy on port 27017
  → Waiting for Redis...
  ✓ Redis is healthy on port 6379

Infrastructure ready.
```

**Verification:**

Check MongoDB:
```powershell
docker compose -f docker-compose.infra.yml exec mongodb mongosh --quiet --eval 'db.runCommand("ping").ok'
```

**Expected:** `1`

Check Redis:
```powershell
docker compose -f docker-compose.infra.yml exec redis redis-cli ping
```

**Expected:** `PONG`

**Common errors:**

| Error | Cause | Fix |
|-------|-------|------|
| `Failed to start Docker containers` | Docker Desktop not running | Open Docker Desktop, wait for it to be ready |
| `MongoDB failed to start` | Port conflict on 27017 | Check `Get-NetTCPConnection -LocalPort 27017`, stop the conflicting process |
| `Redis failed to start` | Port conflict on 6379 | Same as above for port 6379 |

### Step 5: Stop Infrastructure

To stop the Docker containers when done:

```powershell
.\scripts\infra.ps1 -Down
```

---

## Starting Development

### Full Dev Environment

The single command to start everything:

```powershell
.\scripts\dev.ps1
```

**What this does (in order):**

1. Runs `setup.ps1` — installs dependencies if missing
2. Runs `infra.ps1` — starts MongoDB and Redis via Docker
3. Kills any leftover Python processes on port 8000
4. Starts the **backend** (`uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`)
5. Starts the **frontend** (`npm run dev` in `frontend/`)
6. Waits for the backend health endpoint to respond (up to 30 seconds)
7. Waits for the frontend to load (up to 45 seconds)
8. Opens `http://localhost:3000` in your default browser
9. Displays an interactive dashboard

**Expected output (first part):**

```
  DiaryArchive — Setup
  ...
  ✓ Setup complete

  DiaryArchive — Starting Infrastructure
  ...
  ✓ Infrastructure ready

  → Starting backend on port 8000...
  → Starting frontend on port 3000...
  → Waiting for backend to be ready...
  ✓ Backend is ready
  → Waiting for frontend...
  ✓ Frontend is ready
```

**Then the dashboard appears:**

```
  ╔═══════════════════════════════════════════════════╗
  ║        DiaryArchive — Development Mode           ║
  ╚═══════════════════════════════════════════════════╝

  Frontend    http://localhost:3000
  Backend     http://localhost:8000
  API Docs    http://localhost:8000/docs

  Services
    ● MongoDB  port 27017
    ● Redis    port 6379
    ○ Meilisearch port 7700 (optional, not started)

  ● Backend running (PID 12345)
  ● Frontend running (PID 12346)

  Commands:
    Q        Quit and stop all services
    L        Tail backend logs
    F        Tail frontend logs
    R        Refresh dashboard
```

### Dashboard Controls

While the dashboard is displayed:

| Press | Action |
|-------|--------|
| `Q` | Quit — stops backend and frontend processes |
| `L` | Tail backend logs — shows live stderr output (press Ctrl+C to return) |
| `F` | Tail frontend logs — shows live stdout output (press Ctrl+C to return) |
| `R` | Refresh dashboard with latest service status |

### If the Backend Fails to Start

Check the backend log file:

```powershell
Get-Content backend\.dev-stderr.log -Tail 20
```

Common causes:
- MongoDB isn't running (run `.\scripts\infra.ps1`)
- Port 8000 is in use (run `.\scripts\stop.ps1` then retry)
- Python dependencies missing (run `.\scripts\setup.ps1`)

### If the Frontend Fails to Start

Check the frontend log file:

```powershell
Get-Content frontend\.dev-stdout.log -Tail 20
```

Common causes:
- Node dependencies missing (run `.\scripts\setup.ps1`)
- Port 3000 is in use

---

## Project URLs

When the dev environment is running, these URLs are active:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js application |
| Backend API | http://localhost:8000 | FastAPI server |
| API Docs | http://localhost:8000/docs | Interactive Swagger UI |
| MongoDB | localhost:27017 | Database (inside Docker) |
| Redis | localhost:6379 | Cache (inside Docker) |

---

## Stopping Development

### Quick Stop (from the dashboard)

Press `Q` in the dashboard. This stops the backend and frontend processes but **leaves Docker containers running**.

### Full Stop (all services)

After quitting the dashboard, run:

```powershell
.\scripts\stop.ps1
```

**What this does:**
1. Finds and kills the backend Python process (using `uvicorn`)
2. Finds and kills the frontend Node.js process (using `next dev`)
3. Prompts: "Stop Docker infrastructure (MongoDB + Redis)? [Y/n]"
   - Press Enter or type `Y` to stop Docker containers
   - Type `N` to leave them running (faster restart later)

**Expected output:**

```
  DiaryArchive — Stop

  ✓ Backend stopped
  ✓ Frontend stopped
  Stop Docker infrastructure (MongoDB + Redis)? [Y/n]
```

### Stop Only Docker Infrastructure

If you want to stop just MongoDB and Redis (without stopping dev servers):

```powershell
.\scripts\infra.ps1 -Down
```

### Force Stop (no prompt)

```powershell
.\scripts\stop.ps1 -Force
```

This stops backend, frontend, and Docker infrastructure without any prompts.

---

## Running Tests

### Backend Tests

```powershell
.\scripts\test.ps1
```

**What this does:**
- Runs `python -m pytest -v` in the `backend/` directory
- Shows verbose output for each test
- Displays a pass/fail summary
- Exits with code 0 on success, 1 on failure

**Expected output:**

```
  DiaryArchive — Test Runner

Running backend tests...
  ✓ Backend tests passed
    ============================= test session starts =============================
    platform win32 -- Python 3.13.x ...
    collected 22 items

    tests/test_api/test_auth.py::TestRegister::test_register_success PASSED
    tests/test_api/test_auth.py::TestRegister::test_register_duplicate_username PASSED
    ...

  Test Summary
  ✓ Backend
  ✗ Frontend not run (pass -Frontend)

All tests passed!
```

**Note:** Backend tests require MongoDB to be running. Run `.\scripts\infra.ps1` first if you haven't started the dev environment.

### Run a Specific Test File

```powershell
cd backend
python -m pytest tests/test_api/test_auth.py -v
```

### Run with Coverage

```powershell
cd backend
python -m pytest --cov=app tests/
```

### Frontend Tests

Frontend tests use Playwright and are **not installed by default**. To include them:

```powershell
.\scripts\test.ps1 -Frontend
```

If Playwright is not installed, the script will warn and skip frontend tests. Install it:

```powershell
cd frontend
npx playwright install
```

### Full Test Suite

```powershell
.\scripts\test.ps1 -Frontend
```

---

## Common Problems

### 1. Docker Desktop is not running

**Symptoms:**
- `docker info` errors
- `.\scripts\infra.ps1` fails with `Failed to start Docker containers`
- `.\scripts\dev.ps1` fails at the infra step

**Diagnose:**
```powershell
docker info
```

**Fix:**
1. Open Docker Desktop from the Start menu
2. Wait for the whale icon in the system tray to be solid (not animating)
3. Verify: `docker info`

### 2. Docker Desktop is installed but Docker commands fail

**Symptoms:**
- `docker --version` works
- `docker info` errors: `error during connect`

**Fix:**
```powershell
# Restart Docker Desktop
# Or check if the Docker service is running:
Get-Service -Name "com.docker.service" | Start-Service
```

### 3. Port already in use

**Symptoms:**
- Backend fails to start
- Error: `[Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000)`
- Frontend shows: `Error: listen EADDRINUSE: address already in use :::3000`

**Diagnose:**
```powershell
# Check what is using port 8000
Get-NetTCPConnection -LocalPort 8000

# Check what is using port 3000
Get-NetTCPConnection -LocalPort 3000
```

**Fix:**
```powershell
# Stop the conflicting service
.\scripts\stop.ps1

# Or kill the specific process (replace PID with the OwningProcess from above)
Stop-Process -Id <PID> -Force
```

### 4. MongoDB won't start

**Symptoms:**
- `.\scripts\infra.ps1` prints `✗ MongoDB failed to start`
- `.\scripts\dev.ps1` fails at the infra step

**Diagnose:**
```powershell
docker compose -f docker-compose.infra.yml logs mongodb
```

**Fixes:**
- Port 27017 conflict: `Get-NetTCPConnection -LocalPort 27017` — stop the conflicting process
- Docker image not pulled: `docker pull mongo:7`
- Docker Desktop issue: restart Docker Desktop

### 5. Redis won't start

**Symptoms:**
- `.\scripts\infra.ps1` prints `✗ Redis failed to start`

**Diagnose:**
```powershell
docker compose -f docker-compose.infra.yml logs redis
```

**Fixes:**
- Port 6379 conflict: `Get-NetTCPConnection -LocalPort 6379`
- Docker image not pulled: `docker pull redis:7-alpine`

### 6. MongoDB unreachable (backend fails to connect)

**Symptoms:**
- Backend logs contain: `ServerSelectionTimeoutError`
- Health check at http://localhost:8000/api/v1/health shows MongoDB as "unreachable"

**Diagnose:**
```powershell
# Check if MongoDB is running
docker compose -f docker-compose.infra.yml ps

# Verify MongoDB responds
docker compose -f docker-compose.infra.yml exec mongodb mongosh --quiet --eval 'db.runCommand("ping").ok'
```

**Fix:**
```powershell
.\scripts\infra.ps1
```

### 7. Redis unavailable

**Symptoms:**
- Health check shows Redis as "unreachable"

**Diagnose:**
```powershell
docker compose -f docker-compose.infra.yml ps
docker compose -f docker-compose.infra.yml exec redis redis-cli ping
```

**Fix:**
```powershell
.\scripts\infra.ps1
```

### 8. Python not found

**Symptoms:**
- `python --version` errors
- `.\scripts\setup.ps1` fails with `Python is not installed`

**Fix:**
1. Install Python 3.13+ from https://www.python.org/downloads/
2. **Check "Add Python to PATH"** during installation
3. Restart PowerShell
4. Verify: `python --version`

### 9. Node.js not found

**Symptoms:**
- `node --version` errors

**Fix:**
1. Install Node.js 18+ from https://nodejs.org/en/download/
2. Restart PowerShell
3. Verify: `node --version`

### 10. Dependency installation failed

**Symptoms:**
- `.\scripts\setup.ps1` fails during pip install or npm install

**Diagnose:**
```powershell
# Try backend manually
cd backend
pip install -e ".[dev]"

# Try frontend manually
cd frontend
npm install
```

**Fixes:**
- Network issue: Check internet connection, try a different network
- Python build error: Install Visual C++ Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools/
- npm permissions: Do NOT use `npm install --global`. The project uses local dependencies.

### 11. Backend health check times out

**Symptoms:**
- `dev.ps1` shows `⚠ Backend health check timed out`
- The dashboard shows "○ Backend stopped"

**Diagnose:**
```powershell
Get-Content backend\.dev-stderr.log -Tail 30
```

**Common causes and fixes:**
- MongoDB not running → `.\scripts\infra.ps1`
- Import error → `.\scripts\setup.ps1` (reinstall dependencies)
- Port conflict → `.\scripts\stop.ps1` then retry
- Syntax error in code → check the log file for Python traceback

### 12. Frontend fails to build

**Symptoms:**
- `dev.ps1` shows `⚠ Frontend health check timed out`

**Diagnose:**
```powershell
Get-Content frontend\.dev-stdout.log -Tail 30
```

**Fixes:**
- Missing dependencies → `.\scripts\setup.ps1`
- TypeScript error → `cd frontend && npx tsc --noEmit` to check

### 13. "Running scripts is disabled" (PowerShell execution policy)

**Symptoms:**
- `.\scripts\dev.ps1` errors with execution policy message

**Fix:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## Verification Checklist

Run through this checklist to confirm your environment is working.

### Prerequisites

```
✓ Python 3.13+ installed          → python --version
✓ Node.js 18+ installed           → node --version
✓ Docker Desktop installed        → docker --version
✓ Docker Desktop running          → docker info
```

### Infrastructure

```
✓ MongoDB container running       → docker compose -f docker-compose.infra.yml ps
✓ MongoDB responds to ping        → docker compose -f docker-compose.infra.yml exec mongodb mongosh --quiet --eval 'db.runCommand("ping").ok'
✓ Redis container running         → docker compose -f docker-compose.infra.yml ps
✓ Redis responds to ping          → docker compose -f docker-compose.infra.yml exec redis redis-cli ping
```

### Backend

```
✓ Backend starts without errors   → .\scripts\dev.ps1 (wait for backend)
✓ Health endpoint responds        → curl http://localhost:8000/api/v1/health
```

Expected health response:
```json
{
  "status": "healthy",
  "checks": {
    "mongodb": "ok",
    "redis": "ok"
  }
}
```

### Frontend

```
✓ Frontend loads without errors   → .\scripts\dev.ps1 (wait for frontend)
✓ Frontend page responds          → curl http://localhost:3000
✓ Open in browser                 → http://localhost:3000
```

### API Documentation

```
✓ Swagger UI loads                → http://localhost:8000/docs
```

### Authentication (end-to-end)

```powershell
curl -X POST http://localhost:8000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","password":"TestPass123"}'
```

```
✓ Registration returns 201 with access_token
```

```powershell
curl -X POST http://localhost:8000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","password":"TestPass123"}'
```

```
✓ Login returns 200 with access_token
```

### Tests

```
✓ Backend tests pass              → .\scripts\test.ps1
```

---

## Reference: Scripts Summary

| Script | Description | Flags |
|--------|-------------|-------|
| `.\scripts\dev.ps1` | Full dev environment | `-SkipSetup`, `-SkipInfra`, `-NoBrowser` |
| `.\scripts\setup.ps1` | Install deps, create env files | `-Force` (reinstall) |
| `.\scripts\infra.ps1` | Start MongoDB + Redis | `-Down` (stop instead) |
| `.\scripts\stop.ps1` | Stop all services | `-Force` (no prompt) |
| `.\scripts\test.ps1` | Run tests | `-Frontend` (include frontend), `-NoSummary` |

## Reference: Project Layout

```
diaryarchive/
├── scripts/                    # PowerShell development scripts
│   ├── dev.ps1                 # Main: setup + infra + servers + dashboard
│   ├── setup.ps1               # Prerequisites + dependency installation
│   ├── infra.ps1               # Docker: MongoDB + Redis
│   ├── stop.ps1                # Stop all services
│   └── test.ps1                # Test runner
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/endpoints/   # Route handlers (auth, health)
│   │   ├── core/               # Config, security, database, middleware
│   │   ├── models/             # Pydantic request/response schemas
│   │   ├── repositories/       # Data access layer (repository pattern)
│   │   └── schemas/            # MongoDB index definitions
│   ├── tests/                  # Pytests
│   ├── .env.development        # Development environment variables
│   └── pyproject.toml          # Python project config
├── frontend/                   # Next.js 15 application
│   ├── src/
│   │   ├── app/                # Pages and layouts
│   │   ├── components/         # UI components (shadcn/ui style)
│   │   ├── lib/api/            # Axios client with auth interceptor
│   │   └── store/              # Zustand state management
│   ├── .env.development        # Development environment variables
│   └── package.json            # Node.js project config
├── docker-compose.yml          # Full production-like stack
├── docker-compose.infra.yml    # Dev infrastructure (MongoDB + Redis)
└── .env.example                # Example environment variables
```
