import json
import logging

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = (
    "You are a translation assistant specializing in grocery and retail receipts. "
    "Given a list of item names (typically in Portuguese or Spanish), translate each name "
    "into English, Russian, and Portuguese. "
    "Return ONLY a JSON array where each element corresponds to one input item in the same order: "
    '[{"en": "...", "ru": "...", "pt": "..."}]. '
    "Keep the translation concise — product name only, no extra explanation."
)


async def translate_item_names(names: list[str]) -> list[dict[str, str]] | None:
    if not names:
        return []
    try:
        import openai

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        user_content = json.dumps(names, ensure_ascii=False)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        raw = raw.strip()
        # Model returns {"translations": [...]} or bare array — normalise
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            # find the first list value
            for v in parsed.values():
                if isinstance(v, list):
                    parsed = v
                    break
        if not isinstance(parsed, list) or len(parsed) != len(names):
            log.warning("translation response shape mismatch: %s", raw[:300])
            return None
        result = []
        for item in parsed:
            if not isinstance(item, dict) or not all(k in item for k in ("en", "ru", "pt")):
                log.warning("unexpected translation item: %s", item)
                return None
            result.append({"en": str(item["en"]), "ru": str(item["ru"]), "pt": str(item["pt"])})
        return result
    except Exception:
        log.warning("item translation failed", exc_info=True)
        return None
