from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from .client import DeepSeekClient
from .policy import Policy
from .session import SessionStore
from .tools import TOOL_SCHEMAS, ToolError, WorkspaceTools


SYSTEM_PROMPT = """You are DeepSeek-Tide, a terminal coding agent.

Work directly in the user's workspace. Inspect before editing, keep changes
focused, and verify results with available tools. Never claim success without
evidence. Paths must remain inside the workspace.

Execution modes are enforced by the host:
- plan: read-only investigation and planning
- agent: writes and commands require user approval
- yolo: workspace-local actions are automatically approved

When tool output reports a failure, diagnose it and continue when possible.
End with a concise summary of changes and verification.
"""


class Agent:
    def __init__(
        self,
        *,
        client: DeepSeekClient,
        tools: WorkspaceTools,
        policy: Policy,
        sessions: SessionStore,
        max_steps: int,
        continue_session: bool = False,
        on_event: Callable[[str, str], None] | None = None,
    ) -> None:
        self.client = client
        self.tools = tools
        self.policy = policy
        self.sessions = sessions
        self.max_steps = max_steps
        self.on_event = on_event
        self.messages: list[dict[str, Any]] = (
            sessions.load() if continue_session else []
        )
        if not self.messages:
            self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def run(self, prompt: str) -> str:
        self.messages.append({"role": "user", "content": prompt})
        self.sessions.save(self.messages)

        for _ in range(self.max_steps):
            assistant = self.client.complete(
                self.messages,
                TOOL_SCHEMAS,
                on_event=self.on_event,
            )
            self.messages.append(assistant)
            self.sessions.save(self.messages)

            tool_calls = assistant.get("tool_calls") or []
            if not tool_calls:
                return assistant.get("content") or ""

            for call in tool_calls:
                function = call.get("function", {})
                name = function.get("name", "")
                raw_arguments = function.get("arguments", "{}")
                if self.on_event:
                    self.on_event("tool_start", name)
                try:
                    arguments = json.loads(raw_arguments)
                    if not isinstance(arguments, dict):
                        raise ValueError("arguments must be an object")
                    if not self.policy.authorize(name, arguments):
                        result = f"Denied by {self.policy.mode} mode policy."
                    else:
                        result = self.tools.execute(name, arguments)
                except (json.JSONDecodeError, ValueError, TypeError) as exc:
                    result = f"Invalid tool arguments: {exc}"
                except (ToolError, OSError) as exc:
                    result = f"Tool failed: {exc}"
                if self.on_event:
                    self.on_event("tool_end", f"{name}: {result[:500]}")

                self.messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id", ""),
                        "content": result,
                    }
                )
                self.sessions.save(self.messages)

        raise RuntimeError(f"Agent exceeded maximum of {self.max_steps} steps")


def create_agent(
    *,
    client: DeepSeekClient,
    workspace: Path,
    mode: str,
    max_steps: int,
    continue_session: bool,
    interactive: bool,
    allow_dangerous: bool = False,
    on_event: Callable[[str, str], None] | None = None,
) -> Agent:
    return Agent(
        client=client,
        tools=WorkspaceTools(workspace),
        policy=Policy(
            mode=mode,
            interactive=interactive,
            allow_dangerous=allow_dangerous,
        ),
        sessions=SessionStore(workspace),
        max_steps=max_steps,
        continue_session=continue_session,
        on_event=on_event,
    )
