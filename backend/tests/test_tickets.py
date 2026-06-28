import io
from decimal import Decimal
from unittest.mock import MagicMock

import pytest


def _make_mock_ocr():
    client = MagicMock()
    response = MagicMock()
    choice = MagicMock()
    choice.message.content = (
        '{"store_name": "Lidl", "purchased_at": "2026-05-20T14:30:00Z", '
        '"items": [{"name": "Bread", "price": "1.49"}], '
        '"discount_total": "0.50", "total_price": "0.99"}'
    )
    response.choices = [choice]
    client.chat.completions.create.return_value = response
    return client


@pytest.mark.asyncio
async def test_upload_valid_jpeg_returns_draft(client, auth_headers):
    from app.main import app
    from app.routers.tickets import get_ocr_service
    from app.services.ocr_service import OCRService

    mock_client = _make_mock_ocr()

    def mock_ocr():
        return OCRService(openai_client=mock_client)

    app.dependency_overrides[get_ocr_service] = mock_ocr
    try:
        content = b"\xff\xd8\xff" + b"\x00" * 100
        resp = await client.post(
            "/tickets/upload",
            files=[("files", ("test.jpg", io.BytesIO(content), "image/jpeg"))],
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "store_name" in data
        assert "items" in data
    finally:
        app.dependency_overrides.pop(get_ocr_service, None)


@pytest.mark.asyncio
async def test_upload_exe_rejected(client, auth_headers):
    from app.main import app
    from app.routers.tickets import get_ocr_service
    from app.services.ocr_service import OCRService

    def mock_ocr():
        return OCRService(openai_client=MagicMock())

    app.dependency_overrides[get_ocr_service] = mock_ocr
    try:
        resp = await client.post(
            "/tickets/upload",
            files=[("files", ("test.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream"))],
            headers=auth_headers,
        )
        assert resp.status_code == 422
    finally:
        app.dependency_overrides.pop(get_ocr_service, None)


@pytest.mark.asyncio
async def test_upload_without_jwt(client):
    content = b"\xff\xd8\xff" + b"\x00" * 100
    resp = await client.post(
        "/tickets/upload",
        files=[("files", ("test.jpg", io.BytesIO(content), "image/jpeg"))],
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_create_ticket_proportional_discount(client, auth_headers, db_session, member):
    payload = {
        "store_name": "Lidl",
        "purchased_at": "2026-05-20T14:30:00Z",
        "paid_by_id": str(member.id),
        "total_price": "10.00",
        "discount_total": "1.00",
        "items": [
            {"name": "Item A", "price": "6.00", "position": 0, "member_ids": [str(member.id)]},
            {"name": "Item B", "price": "4.00", "position": 1, "member_ids": [str(member.id)]},
        ],
    }
    resp = await client.post("/tickets", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    items = {i["name"]: Decimal(i["discounted_price"]) for i in data["items"]}
    assert items["Item A"] == Decimal("5.40")
    assert items["Item B"] == Decimal("3.60")


@pytest.mark.asyncio
async def test_create_ticket_empty_member_ids_rejected(client, auth_headers, member):
    payload = {
        "store_name": "Store",
        "purchased_at": "2026-05-20T14:30:00Z",
        "paid_by_id": str(member.id),
        "total_price": "5.00",
        "discount_total": "0.00",
        "items": [
            {"name": "Item", "price": "5.00", "position": 0, "member_ids": []},
        ],
    }
    resp = await client.post("/tickets", json=payload, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_ticket_inactive_member_rejected(client, auth_headers, db_session, member):
    member.is_active = False
    await db_session.flush()

    payload = {
        "store_name": "Store",
        "purchased_at": "2026-05-20T14:30:00Z",
        "paid_by_id": str(member.id),
        "total_price": "5.00",
        "discount_total": "0.00",
        "items": [
            {"name": "Item", "price": "5.00", "position": 0, "member_ids": [str(member.id)]},
        ],
    }
    resp = await client.post("/tickets", json=payload, headers=auth_headers)
    assert resp.status_code == 422
