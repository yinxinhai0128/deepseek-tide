from __future__ import annotations

import re
from typing import Any


SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(
        r"(?i)\b(api[_-]?key|authorization)\b(\s*[:=]\s*)([^\s\"']+)"
    ),
]


def redact_text(value: str) -> str:
    redacted = SECRET_PATTERNS[0].sub("[REDACTED_API_KEY]", value)
    return SECRET_PATTERNS[1].sub(r"\1\2[REDACTED]", redacted)


def redact(value: Any) -> Any:
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, dict):
        return {key: redact(item) for key, item in value.items()}
    return value
