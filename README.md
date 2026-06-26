# DiaryArchive

A place for your thoughts. Public or private.

A diary platform with end-to-end encryption, rich text editing, and community features. Built with FastAPI, Next.js, MongoDB, and Redis.

## Quick Start

**Prerequisites:** [Python 3.13+](https://www.python.org/downloads/), [Node.js 18+](https://nodejs.org/en/download/), [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```powershell
# One command to start developing
.\scripts\dev.ps1
```

This installs dependencies, starts MongoDB + Redis via Docker, and launches both servers with hot reload.

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Available Scripts

| Command | What it does |
|---------|-------------|
| `.\scripts\dev.ps1` | Full dev environment (setup + infra + servers + dashboard) |
| `.\scripts\setup.ps1` | Check prerequisites and install dependencies |
| `.\scripts\infra.ps1` | Start MongoDB + Redis via Docker |
| `.\scripts\stop.ps1` | Stop all services |
| `.\scripts\test.ps1` | Run backend tests |
| `.\scripts\test.ps1 -Frontend` | Run backend + frontend tests |

## Project Structure

```
diaryarchive/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/        # API routes and dependencies
│   │   ├── core/       # Config, security, database, middleware
│   │   ├── models/     # Pydantic schemas
│   │   ├── repositories/  # Data access layer
│   │   └── schemas/    # MongoDB index definitions
│   └── tests/          # Backend tests
├── frontend/           # Next.js application
│   └── src/
│       ├── app/        # Pages and layouts
│       ├── components/ # UI and layout components
│       ├── hooks/      # Custom React hooks
│       ├── lib/        # Utilities and API client
│       └── store/      # Zustand state management
├── docs/               # Documentation
│   ├── milestones/     # Engineering milestone plans
│   └── developer/      # Developer guides
├── scripts/            # PowerShell development scripts
├── docker-compose.yml  # Full production-like stack
└── docker-compose.infra.yml  # Dev infrastructure (MongoDB + Redis)
```

## Environment Setup

Development environment variables are pre-configured in:

- `backend/.env.development` — Backend settings (loaded automatically)
- `frontend/.env.development` — Frontend settings (loaded by Next.js)

For local overrides, create `backend/.env` (gitignored).

## Testing

```powershell
# Backend tests
.\scripts\test.ps1

# Backend + frontend tests
.\scripts\test.ps1 -Frontend

# Direct
cd backend && python -m pytest -v
```

## Linting

```powershell
# Backend
cd backend && python -m ruff check .

# Frontend
cd frontend && npx next lint .

# TypeScript check
cd frontend && npx tsc --noEmit
```

## Deployment

Deployment uses Docker Compose:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
