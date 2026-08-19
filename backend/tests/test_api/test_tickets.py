import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.main import app
from app.repositories.ticket_repo import MAX_MESSAGES


@pytest.fixture(autouse=True)
async def clear_db():
    db = DatabaseManager.get_db()
    for coll in ["users", "tickets", "audit_logs", "refresh_tokens"]:
        try:
            await db[coll].delete_many({})
        except Exception:
            pass


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register(client: AsyncClient, username: str) -> dict:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "ValidPass1", "accepted_terms": True},
    )
    assert resp.status_code == 201
    return resp.json().get("data", resp.json())


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_ticket(client: AsyncClient, token: str) -> str:
    resp = await client.post(
        "/api/v1/tickets",
        json={
            "category": "report_problem",
            "subject": "Pagination issue",
            "description": "Testing message pagination behavior.",
        },
        headers=_headers(token),
    )
    assert resp.status_code == 201
    return resp.json().get("data", resp.json())["id"]


async def _reply(client: AsyncClient, token: str, ticket_id: str, message: str):
    return await client.post(
        f"/api/v1/tickets/{ticket_id}/reply",
        json={"message": message},
        headers=_headers(token),
    )


@pytest.mark.asyncio
async def test_ticket_message_pagination(client):
    user = await _register(client, "pager_user")
    token = user["access_token"]
    ticket_id = await _create_ticket(client, token)

    for i in range(1, 6):
        resp = await _reply(client, token, ticket_id, f"reply {i}")
        assert resp.status_code == 201

    resp = await client.get(
        f"/api/v1/tickets/{ticket_id}?page=1&per_page=2", headers=_headers(token)
    )
    assert resp.status_code == 200
    body = resp.json().get("data", resp.json())
    assert len(body["messages"]) == 2
    assert body["pagination"]["total"] == 6
    assert body["pagination"]["total_pages"] == 3
    assert body["pagination"]["page"] == 1

    page3 = await client.get(
        f"/api/v1/tickets/{ticket_id}?page=3&per_page=2", headers=_headers(token)
    )
    body3 = page3.json().get("data", page3.json())
    assert len(body3["messages"]) == 2
    assert body3["messages"][-1]["message"] == "reply 5"

    overflow = await client.get(
        f"/api/v1/tickets/{ticket_id}?page=99&per_page=2", headers=_headers(token)
    )
    bodyo = overflow.json().get("data", overflow.json())
    assert bodyo["pagination"]["page"] == 3


@pytest.mark.asyncio
async def test_ticket_messages_bounded(client):
    user = await _register(client, "cap_user")
    token = user["access_token"]
    ticket_id = await _create_ticket(client, token)

    from app.repositories.ticket_repo import TicketRepository

    repo = TicketRepository()
    for i in range(MAX_MESSAGES + 20):
        await repo.add_message(
            ticket_id,
            {
                "sender_id": user["id"],
                "sender_username": user["username"],
                "message": f"msg {i}",
            },
        )

    db = DatabaseManager.get_db()
    ticket = await db["tickets"].find_one({"_id": __import__("bson").ObjectId(ticket_id)})
    assert len(ticket["messages"]) == MAX_MESSAGES
    assert ticket["messages_count"] == MAX_MESSAGES + 21
    assert ticket["messages"][-1]["message"] == f"msg {MAX_MESSAGES + 19}"

    resp = await client.get(
        f"/api/v1/tickets/{ticket_id}?page=1&per_page=100", headers=_headers(token)
    )
    body = resp.json().get("data", resp.json())
    assert body["pagination"]["total"] == MAX_MESSAGES + 21
