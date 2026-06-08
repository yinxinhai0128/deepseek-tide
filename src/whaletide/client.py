from __future__ import annotations

import json
import random
import socket
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


class APIError(RuntimeError):
    pass


EventHandler = Callable[[str, str], None]


class DeepSeekClient:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: int,
        max_retries: int = 4,
        stream: bool = True,
    ) -> None:
        self.api_key = api_key
        self.url = f"{base_url}/chat/completions"
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.stream = stream

    def complete(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        on_event: EventHandler | None = None,
    ) -> dict[str, Any]:
        body = {
            "model": self.model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "stream": self.stream,
        }
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                return self._request(body, on_event)
            except urllib.error.HTTPError as exc:
                response_body = exc.read().decode("utf-8", errors="replace")
                error = APIError(f"API HTTP {exc.code}: {response_body}")
                if exc.code not in {429, 500, 502, 503, 504}:
                    raise error from exc
                last_error = error
            except (urllib.error.URLError, TimeoutError, socket.timeout) as exc:
                reason = getattr(exc, "reason", exc)
                last_error = APIError(f"API connection failed: {reason}")

            if attempt >= self.max_retries:
                break
            delay = min(30.0, (2**attempt) + random.random())
            if on_event:
                on_event(
                    "retry",
                    f"request failed; retrying in {delay:.1f}s "
                    f"({attempt + 1}/{self.max_retries})",
                )
            time.sleep(delay)
        raise last_error or APIError("API request failed")

    def _request(
        self,
        body: dict[str, Any],
        on_event: EventHandler | None,
    ) -> dict[str, Any]:
        payload = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.url,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream" if self.stream else "application/json",
                "User-Agent": "DeepSeek-Tide/0.2",
            },
        )
        with urllib.request.urlopen(
            request, timeout=self.timeout_seconds
        ) as response:
            if self.stream:
                return self._read_stream(response, on_event)
            result = json.loads(response.read().decode("utf-8"))
            return self._message_from_response(result)

    @staticmethod
    def _message_from_response(result: dict[str, Any]) -> dict[str, Any]:
        try:
            return result["choices"][0]["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise APIError(f"Unexpected API response: {result}") from exc

    @staticmethod
    def _read_stream(response: Any, on_event: EventHandler | None) -> dict[str, Any]:
        content_parts: list[str] = []
        reasoning_parts: list[str] = []
        tool_calls: dict[int, dict[str, Any]] = {}

        for raw_line in response:
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line or line.startswith(":"):
                if line.startswith(":") and on_event:
                    on_event("keepalive", "")
                continue
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
            except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                raise APIError(f"Invalid SSE chunk: {data[:500]}") from exc

            content = delta.get("content")
            if content:
                content_parts.append(content)
                if on_event:
                    on_event("text", content)
            reasoning = delta.get("reasoning_content")
            if reasoning:
                reasoning_parts.append(reasoning)
                if on_event:
                    on_event("reasoning", reasoning)

            for fragment in delta.get("tool_calls") or []:
                index = int(fragment.get("index", 0))
                call = tool_calls.setdefault(
                    index,
                    {
                        "id": "",
                        "type": "function",
                        "function": {"name": "", "arguments": ""},
                    },
                )
                if fragment.get("id"):
                    call["id"] = fragment["id"]
                function = fragment.get("function") or {}
                if function.get("name"):
                    call["function"]["name"] += function["name"]
                if function.get("arguments"):
                    call["function"]["arguments"] += function["arguments"]

        message: dict[str, Any] = {
            "role": "assistant",
            "content": "".join(content_parts) or None,
        }
        if reasoning_parts:
            message["reasoning_content"] = "".join(reasoning_parts)
        if tool_calls:
            message["tool_calls"] = [tool_calls[index] for index in sorted(tool_calls)]
        return message
