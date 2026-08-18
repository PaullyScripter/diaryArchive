"""PHASE 10: observability /metrics endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.core.metrics import record_request, record_task_run, render_metrics
from app.main import app


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in ("users", "diaries", "refresh_tokens"):
        await db[coll].delete_many({})


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestMetrics:
    def test_render_metrics_empty(self):
        text = render_metrics()
        assert "# HELP process_uptime_seconds" in text
        assert "# TYPE request_requests_total counter" in text

    def test_record_request_and_render(self):
        record_request("/api/v1/health", 200, 0.012)
        record_request("/api/v1/health", 500, 0.5)
        text = render_metrics()
        assert 'request_requests_total{route="/api/v1/health"} 2' in text
        assert 'request_errors_total{route="/api/v1/health"} 1' in text
        assert 'request_duration_seconds_count{route="/api/v1/health"} 2' in text

    def test_record_task_run_and_render(self):
        record_task_run("cleanup", {"likes": {"orphans_removed": 3}, "users": {"users_updated": 1}})
        text = render_metrics()
        assert 'task_last_run_seconds{task="cleanup"}' in text
        assert 'task_metric{task="cleanup",key="users.users_updated"} 1' in text
        assert 'task_metric{task="cleanup",key="likes.orphans_removed"} 3' in text

    async def test_metrics_endpoint(self, client: AsyncClient):
        response = await client.get("/api/v1/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers.get("content-type", "")
        assert "# HELP process_uptime_seconds" in response.text
        assert "request_requests_total" in response.text
