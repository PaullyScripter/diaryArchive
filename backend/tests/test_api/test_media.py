import io
from unittest.mock import patch, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import DatabaseManager
from app.core.minio_client import get_minio_client
from app.main import app


@pytest.fixture(autouse=True)
async def clean_media():
    db = DatabaseManager.get_db()
    await db.media.delete_many({})
    await db.users.delete_many({})
    await db.diaries.delete_many({})
    await db.refresh_tokens.delete_many({})


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def _register_user(client: AsyncClient, username: str = "testuser") -> dict:
    response = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "ValidPass123"},
    )
    assert response.status_code == 201
    data = response.json()
    if "data" in data:
        return data["data"]
    return data


def _make_mock_minio():
    mock = MagicMock()
    mock.bucket_exists.return_value = True
    return mock


@pytest.fixture(autouse=True)
def mock_minio():
    with patch("app.services.media_service.get_minio_client", return_value=_make_mock_minio()), \
         patch("app.services.image_service.Image.open", return_value=_make_mock_image()), \
         patch("app.services.image_service.ImageOps.exif_transpose", side_effect=lambda x: x), \
         patch("app.services.image_service._strip_exif", side_effect=lambda x: x), \
         patch("app.services.image_service.get_image_dimensions", return_value=(800, 600)):
        yield


def _make_mock_image():
    img = MagicMock()
    img.size = (800, 600)
    img.mode = "RGB"
    img.info = {}
    img.getdata.return_value = []
    return img


def _jpeg_data() -> bytes:
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01" + b"\x00" * 100


def _png_data() -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


def _webp_data() -> bytes:
    return b"RIFF\x20\x00\x00\x00WEBP" + b"\x00" * 100


class TestMediaUpload:
    async def test_upload_jpeg(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "data" in data
        assert data["data"]["mime_type"] == "image/webp"

    async def test_upload_png(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.png", io.BytesIO(_png_data()), "image/png")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    async def test_upload_webp(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.webp", io.BytesIO(_webp_data()), "image/webp")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    async def test_upload_requires_auth(self, client: AsyncClient):
        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        response = await client.post("/api/v1/media/upload", files=files)
        assert response.status_code == 401

    async def test_upload_unsupported_mime(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        pdf_data = b"%PDF-1.4" + b"\x00" * 100
        files = {"file": ("test.pdf", io.BytesIO(pdf_data), "application/pdf")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422 or response.status_code == 400

    async def test_upload_renamed_exe_as_jpeg(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        exe_data = b"MZ\x90\x00" + b"\x00" * 100
        files = {"file": ("malware.jpg", io.BytesIO(exe_data), "image/jpeg")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code in (400, 422)

    async def test_upload_empty_file(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code in (400, 422)

    async def test_upload_oversized_file(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        big_data = b"\xff\xd8\xff" + b"\x00" * (11 * 1024 * 1024)
        files = {"file": ("big.jpg", io.BytesIO(big_data), "image/jpeg")}
        response = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code in (400, 422, 413)

    async def test_upload_with_diary_id(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        create_resp = await client.post(
            "/api/v1/diaries",
            json={"privacy": "public", "title": "Test Diary",
                  "content_html": "<p>Test</p>", "content_text": "Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201
        diary_id = create_resp.json()["data"]["id"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        response = await client.post(
            f"/api/v1/media/upload?diary_id={diary_id}",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    async def test_upload_private_media(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        response = await client.post(
            "/api/v1/media/upload?is_private=true",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201
        resp_data = response.json()
        assert resp_data["data"]["is_private"] is True


class TestMediaGallery:
    async def test_gallery_empty(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        response = await client.get(
            "/api/v1/media",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["meta"]["total"] == 0

    async def test_gallery_pagination(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        for i in range(3):
            files = {"file": (f"test{i}.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
            await client.post(
                "/api/v1/media/upload",
                files=files,
                headers={"Authorization": f"Bearer {token}"},
            )

        response = await client.get(
            "/api/v1/media?per_page=2&page=1",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["meta"]["has_next"] is True

        response2 = await client.get(
            "/api/v1/media?per_page=2&page=2",
            headers={"Authorization": f"Bearer {token}"},
        )
        data2 = response2.json()
        assert len(data2["data"]) == 1


class TestMediaDelete:
    async def test_delete_owner(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204

    async def test_delete_non_owner(self, client: AsyncClient):
        user1 = await _register_user(client, "user1")
        user2 = await _register_user(client, "user2")

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {user1['access_token']}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {user2['access_token']}"},
        )
        assert response.status_code == 403

    async def test_delete_not_found(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        response = await client.delete(
            "/api/v1/media/000000000000000000000000",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404

    async def test_delete_requires_auth(self, client: AsyncClient):
        response = await client.delete("/api/v1/media/000000000000000000000000")
        assert response.status_code == 401


class TestMediaGet:
    async def test_get_media_detail(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        response = await client.get(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["id"] == media_id
        assert "url" in data["data"]

    async def test_get_media_signed_url(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        response = await client.get(
            f"/api/v1/media/{media_id}/url",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data["data"]
        assert "expires_in_seconds" in data["data"]


class TestCascadeDelete:
    async def test_media_deleted_with_diary(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        create_resp = await client.post(
            "/api/v1/diaries",
            json={"privacy": "public", "title": "Diary with Media",
                  "content_html": "<p>Test</p>", "content_text": "Test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        diary_id = create_resp.json()["data"]["id"]

        files = {"file": ("photo.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            f"/api/v1/media/upload?diary_id={diary_id}",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upload_resp.status_code == 201
        media_id = upload_resp.json()["data"]["id"]

        delete_resp = await client.delete(
            f"/api/v1/diaries/{diary_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert delete_resp.status_code == 204

        from app.services.media_service import cascade_delete_diary_media
        await cascade_delete_diary_media(diary_id)

        get_resp = await client.get(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_resp.status_code == 404


class TestMediaDetailAuthorization:
    async def test_owner_can_access(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        resp = await client.get(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    async def test_non_owner_gets_404(self, client: AsyncClient):
        user_a = await _register_user(client, "usera")
        user_b = await _register_user(client, "userb")

        files = {"file": ("test.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        upload_resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {user_a['access_token']}"},
        )
        media_id = upload_resp.json()["data"]["id"]

        resp = await client.get(
            f"/api/v1/media/{media_id}",
            headers={"Authorization": f"Bearer {user_b['access_token']}"},
        )
        assert resp.status_code == 404


class TestSVGRejection:
    async def test_svg_upload_rejected(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]
        svg_data = b'<?xml version="1.0"?><svg></svg>' + b"\x00" * 50
        files = {"file": ("image.svg", io.BytesIO(svg_data), "image/svg+xml")}
        resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (400, 422)

    async def test_svg_no_namespace_rejected(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]
        svg_data = b"<svg><script>alert(1)</script></svg>" + b"\x00" * 20
        files = {"file": ("evil.svg", io.BytesIO(svg_data), "image/png")}
        resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (400, 422)


class TestFilenameSanitization:
    async def test_html_filename_sanitized(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]
        files = {"file": ("<script>alert(1)</script>.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        filename = resp.json()["data"]["filename"]
        assert "<" not in filename
        assert ">" not in filename

    async def test_special_chars_removed(self, client: AsyncClient):
        user = await _register_user(client)
        token = user["access_token"]
        files = {"file": ("test\x00null.jpg", io.BytesIO(_jpeg_data()), "image/jpeg")}
        resp = await client.post(
            "/api/v1/media/upload", files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        filename = resp.json()["data"]["filename"]
        assert "\x00" not in filename


class TestDecompressionBomb:
    async def test_decompression_bomb_setting_applied(self):
        from PIL import Image
        from app.services.image_service import MAX_PIXELS
        from app.core.media_validator import MAX_PIXELS as V_MAX
        assert Image.MAX_IMAGE_PIXELS == V_MAX
        assert Image.MAX_IMAGE_PIXELS == 64_000_000
