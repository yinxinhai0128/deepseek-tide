from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .security import redact


class SessionStore:
    def __init__(self, workspace: Path) -> None:
        self.directory = workspace / ".whaletide"
        self.path = self.directory / "session.json"
        self.legacy_paths = [
            workspace / ".codetide" / "session.json",
            workspace / ".whaleforge" / "session.json",
        ]

    def load(self) -> list[dict[str, Any]]:
        source = self.path
        if not source.exists():
            source = next((path for path in self.legacy_paths if path.exists()), source)
        if not source.exists():
            return []
        payload = json.loads(source.read_text(encoding="utf-8"))
        messages = payload.get("messages", [])
        return messages if isinstance(messages, list) else []

    def save(self, messages: list[dict[str, Any]]) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "messages": redact(messages),
        }
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
