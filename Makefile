.PHONY: build build-backend build-frontend clean logs

# ─── Docker builds (for CI and production) ────────────────────────────────────
# Local development uses PowerShell scripts instead. See scripts/dev.ps1.

build:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build

build-backend:
	docker build -t diaryarchive-backend ./backend

build-frontend:
	docker build -t diaryarchive-frontend ./frontend

clean:
	docker compose down -v
	docker system prune -f

logs:
	docker compose logs -f
