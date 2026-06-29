import io
import json
import logging
import re
import unicodedata
from typing import Any

import magic
from fastapi import UploadFile

from app.config import get_settings
from app.schemas.ticket import OCRDraft, OCRItemDraft

log = logging.getLogger(__name__)

settings = get_settings()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

# Single system prompt that does OCR + translation + categorization in one shot.
# Categories are injected at call time as a JSON list.
_SYSTEM_PROMPT_TEMPLATE = """\
You are a receipt OCR assistant. Extract structured data from the receipt image, \
translate each item name into English, Russian, and Portuguese, and assign each item \
to the best matching category from the provided list (use "Other" if nothing fits).

Available categories (JSON array of {{id, name}}):
{categories_json}

Return ONLY valid JSON with this exact schema — no markdown, no explanation:
{{
  "store_name": "string",
  "purchased_at": "ISO8601 datetime",
  "discount_total": "decimal string",
  "total_price": "decimal string",
  "items": [
    {{
      "name": "string (original from receipt)",
      "price": "decimal string",
      "translation_en": "string",
      "translation_ru": "string",
      "translation_pt": "string",
      "category_id": "uuid string or null"
    }}
  ]
}}
Rules:
- Keep item names exactly as printed on the receipt.
- category_id must be one of the ids from the provided list, or null if no match.
- Always pick the closest category rather than defaulting to null.
- Translations should be concise product names only."""


class UploadValidationError(Exception):
    pass


class OCRParseError(Exception):
    pass


class OCRServiceError(Exception):
    pass


class OCRService:
    def __init__(self, openai_client: Any = None) -> None:
        self._client = openai_client

    def _get_client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            import openai
            return openai.OpenAI(api_key=settings.openai_api_key)
        except ImportError as exc:
            raise OCRServiceError("OpenAI SDK not available") from exc

    @staticmethod
    def _detect_mime(content: bytes) -> str:
        detected = magic.from_buffer(content[:512], mime=True)
        if detected == "application/octet-stream" and len(content) >= 12:
            if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
                return "image/webp"
        return detected

    def _validate_upload(self, content: bytes) -> None:
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise UploadValidationError(f"File exceeds {settings.max_upload_size_mb} MB limit")
        detected = self._detect_mime(content)
        if detected not in ALLOWED_CONTENT_TYPES:
            raise UploadValidationError(f"Unsupported file type: {detected}")

    def _convert_pdf_to_image(self, pdf_bytes: bytes) -> bytes:
        import pdf2image
        images = pdf2image.convert_from_bytes(pdf_bytes, first_page=1, last_page=1)
        if not images:
            raise OCRServiceError("Failed to convert PDF to image")
        buf = io.BytesIO()
        images[0].save(buf, format="JPEG")
        return buf.getvalue()

    async def process_upload(self, file: UploadFile, categories: list[dict] | None = None) -> OCRDraft:
        content = await file.read()
        self._validate_upload(content)

        detected_mime = self._detect_mime(content)
        if detected_mime == "application/pdf":
            image_bytes = self._convert_pdf_to_image(content)
            mime = "image/jpeg"
        else:
            image_bytes = content
            mime = detected_mime

        import base64
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        client = self._get_client()

        cats = categories or []
        categories_json = json.dumps(
            [{"id": str(c["id"]), "name": c["name"]} for c in cats],
            ensure_ascii=False,
        )
        system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(categories_json=categories_json)

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{b64}"},
                            }
                        ],
                    },
                ],
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            log.error("OCR API call failed", exc_info=True)
            raise OCRServiceError("OCR service unavailable") from exc

        raw = response.choices[0].message.content or ""
        raw = raw.strip()

        # Extract JSON object even if the model wrapped it in prose or fences
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1:
            log.warning("OCR model returned no JSON object: %s", raw[:200])
            raise UploadValidationError(
                "The image does not appear to be a receipt. Please upload a clear photo of a receipt."
            )
        raw = raw[start : end + 1]

        try:
            data = json.loads(raw)
        except (ValueError, TypeError) as exc:
            raise OCRParseError(f"OCR returned invalid JSON: {raw[:200]}") from exc

        try:
            items = []
            for item in data.get("items", []):
                items.append(OCRItemDraft(
                    name=item["name"],
                    price=str(item["price"]),
                    translation_en=item.get("translation_en") or None,
                    translation_ru=item.get("translation_ru") or None,
                    translation_pt=item.get("translation_pt") or None,
                    suggested_category_id=item.get("category_id") or None,
                ))
            return OCRDraft(
                store_name=data.get("store_name", ""),
                purchased_at=data.get("purchased_at", ""),
                items=items,
                discount_total=str(data.get("discount_total", "0.00")),
                total_price=str(data.get("total_price", "0.00")),
            )
        except Exception as exc:
            raise OCRParseError(f"OCR response missing required fields: {exc}") from exc

    @staticmethod
    def _normalize_item_key(name: str, price: str) -> str:
        # Normalize to lowercase ASCII, collapse whitespace, round price to 2dp for comparison
        nfkd = unicodedata.normalize("NFKD", name.lower())
        ascii_name = nfkd.encode("ascii", "ignore").decode("ascii")
        clean = re.sub(r"\s+", " ", ascii_name).strip()
        try:
            from decimal import Decimal
            price_key = str(Decimal(price).quantize(Decimal("0.01")))
        except Exception:
            price_key = price.strip()
        return f"{clean}|{price_key}"

    async def process_multiple_uploads(
        self,
        files: list[UploadFile],
        categories: list[dict] | None = None,
    ) -> OCRDraft:
        """Process one or more receipt images and merge into a single OCRDraft.

        Multiple images of the same long receipt may produce overlapping items;
        exact duplicates (same normalised name + price) are filtered out.
        Multiple distinct receipts are simply concatenated.
        """
        if not files:
            raise UploadValidationError("No files provided")

        drafts: list[OCRDraft] = []
        for f in files:
            draft = await self.process_upload(f, categories=categories)
            drafts.append(draft)

        if len(drafts) == 1:
            return drafts[0]

        # Use header fields from the first receipt
        merged = OCRDraft(
            store_name=drafts[0].store_name,
            purchased_at=drafts[0].purchased_at,
            discount_total=drafts[0].discount_total,
            total_price=drafts[0].total_price,
            items=[],
            raw_image_url=drafts[0].raw_image_url,
        )

        seen: set[str] = set()
        for draft in drafts:
            for item in draft.items:
                key = self._normalize_item_key(item.name, item.price)
                if key in seen:
                    continue
                seen.add(key)
                merged.items.append(item)

        # Sum totals across all distinct receipts (discount_total and total_price
        # may each come from a separate receipt; sum them for the merged result)
        if len(drafts) > 1:
            from decimal import Decimal
            merged.discount_total = str(
                sum(Decimal(d.discount_total) for d in drafts)
            )
            merged.total_price = str(
                sum(Decimal(item.price) for item in merged.items)
            )

        return merged
