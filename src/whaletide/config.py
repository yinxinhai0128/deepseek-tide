from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    api_key: str
    base_url: str
    model: str
    mode: str
    workspace: Path
    max_steps: int = 24
    timeout_seconds: int = 660
    max_retries: int = 4
    stream: bool = True

    @classmethod
    def from_args(
        cls,
        *,
        api_key: str | None,
        base_url: str,
        model: str,
        mode: str,
        workspace: str,
        max_steps: int,
        timeout_seconds: int,
        max_retries: int,
        stream: bool,
    ) -> "Config":
        resolved_key = api_key or os.environ.get("DEEPSEEK_API_KEY", "")
        return cls(
            api_key=resolved_key,
            base_url=base_url.rstrip("/"),
            model=model,
            mode=mode,
            workspace=Path(workspace).resolve(),
            max_steps=max_steps,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
            stream=stream,
        )
