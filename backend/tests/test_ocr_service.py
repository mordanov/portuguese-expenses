"""OCR tests — OpenAI client is ALWAYS mocked (constitution § II)."""
import io
from unittest.mock import MagicMock

import pytest
from fastapi import UploadFile

from app.services.ocr_service import OCRParseError, OCRService, UploadValidationError


def _make_upload(content: bytes, content_type: str, filename: str = "test.jpg") -> UploadFile:
    return UploadFile(filename=filename, file=io.BytesIO(content), size=len(content), headers={"content-type": content_type})


def _make_mock_client(json_str: str) -> MagicMock:
    client = MagicMock()
    response = MagicMock()
    choice = MagicMock()
    choice.message.content = json_str
    response.choices = [choice]
    client.chat.completions.create.return_value = response
    return client


@pytest.mark.asyncio
async def test_valid_jpeg_returns_draft(mock_ocr_client):
    service = OCRService(openai_client=mock_ocr_client)
    upload = _make_upload(b"\xff\xd8\xff" + b"\x00" * 100, "image/jpeg")
    draft = await service.process_upload(upload)
    assert draft.store_name == "Lidl"
    assert len(draft.items) == 1
    assert draft.items[0].name == "Bread"
    assert draft.items[0].price == "1.49"


@pytest.mark.asyncio
async def test_malformed_json_raises_parse_error():
    client = _make_mock_client("{not valid json}")
    service = OCRService(openai_client=client)
    upload = _make_upload(b"\xff\xd8\xff" + b"\x00" * 100, "image/jpeg")
    with pytest.raises(OCRParseError):
        await service.process_upload(upload)


@pytest.mark.asyncio
async def test_invalid_file_type_raises_validation_error():
    service = OCRService(openai_client=MagicMock())
    upload = _make_upload(b"MZ\x90\x00", "application/octet-stream", "test.exe")
    with pytest.raises(UploadValidationError):
        await service.process_upload(upload)


@pytest.mark.asyncio
async def test_oversized_file_raises_validation_error():
    service = OCRService(openai_client=MagicMock())
    big = b"\xff\xd8\xff" + b"\x00" * (21 * 1024 * 1024)
    upload = _make_upload(big, "image/jpeg")
    with pytest.raises(UploadValidationError):
        await service.process_upload(upload)


@pytest.mark.asyncio
async def test_webp_accepted(mock_ocr_client):
    service = OCRService(openai_client=mock_ocr_client)
    upload = _make_upload(b"RIFF\x00\x00\x00\x00WEBP", "image/webp", "test.webp")
    draft = await service.process_upload(upload)
    assert draft.store_name == "Lidl"
