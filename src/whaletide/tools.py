from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable


class ToolError(RuntimeError):
    pass


def _schema(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str],
) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
                "additionalProperties": False,
            },
        },
    }


TOOL_SCHEMAS = [
    _schema(
        "read_file",
        "Read a UTF-8 text file inside the workspace.",
        {
            "path": {"type": "string"},
            "start_line": {"type": "integer", "minimum": 1},
            "end_line": {"type": "integer", "minimum": 1},
        },
        ["path"],
    ),
    _schema(
        "list_files",
        "List files and directories inside the workspace.",
        {
            "path": {"type": "string"},
            "recursive": {"type": "boolean"},
        },
        [],
    ),
    _schema(
        "search_text",
        "Search text in workspace files.",
        {
            "query": {"type": "string"},
            "path": {"type": "string"},
            "max_results": {"type": "integer", "minimum": 1, "maximum": 200},
        },
        ["query"],
    ),
    _schema(
        "write_file",
        "Create or fully replace a UTF-8 text file inside the workspace.",
        {
            "path": {"type": "string"},
            "content": {"type": "string"},
        },
        ["path", "content"],
    ),
    _schema(
        "replace_text",
        "Replace one exact text occurrence in a UTF-8 file.",
        {
            "path": {"type": "string"},
            "old_text": {"type": "string"},
            "new_text": {"type": "string"},
        },
        ["path", "old_text", "new_text"],
    ),
    _schema(
        "edit_file",
        "Apply multiple exact replacements to one UTF-8 file atomically.",
        {
            "path": {"type": "string"},
            "edits": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "properties": {
                        "old_text": {"type": "string"},
                        "new_text": {"type": "string"},
                    },
                    "required": ["old_text", "new_text"],
                    "additionalProperties": False,
                },
            },
        },
        ["path", "edits"],
    ),
    _schema(
        "git_status",
        "Show concise Git workspace status.",
        {},
        [],
    ),
    _schema(
        "git_diff",
        "Show the current Git diff, optionally for one workspace-relative path.",
        {"path": {"type": "string"}},
        [],
    ),
    _schema(
        "run_command",
        "Run a command in the workspace and return combined output.",
        {
            "command": {"type": "string"},
            "timeout_seconds": {
                "type": "integer",
                "minimum": 1,
                "maximum": 600,
            },
        },
        ["command"],
    ),
]


@dataclass
class WorkspaceTools:
    workspace: Path
    output_limit: int = 40_000

    def _resolve(self, raw_path: str = ".") -> Path:
        candidate = (self.workspace / raw_path).resolve()
        try:
            candidate.relative_to(self.workspace)
        except ValueError as exc:
            raise ToolError(f"Path escapes workspace: {raw_path}") from exc
        return candidate

    def execute(self, name: str, arguments: dict[str, Any]) -> str:
        handlers: dict[str, Callable[..., str]] = {
            "read_file": self.read_file,
            "list_files": self.list_files,
            "search_text": self.search_text,
            "write_file": self.write_file,
            "replace_text": self.replace_text,
            "edit_file": self.edit_file,
            "git_status": self.git_status,
            "git_diff": self.git_diff,
            "run_command": self.run_command,
        }
        handler = handlers.get(name)
        if handler is None:
            raise ToolError(f"Unknown tool: {name}")
        return self._truncate(handler(**arguments))

    def _truncate(self, value: str) -> str:
        if len(value) <= self.output_limit:
            return value
        return value[: self.output_limit] + "\n...[output truncated]"

    def read_file(
        self,
        path: str,
        start_line: int = 1,
        end_line: int | None = None,
    ) -> str:
        target = self._resolve(path)
        lines = target.read_text(encoding="utf-8").splitlines()
        selected = lines[start_line - 1 : end_line]
        return "\n".join(
            f"{number}: {line}"
            for number, line in enumerate(selected, start=start_line)
        )

    def list_files(self, path: str = ".", recursive: bool = False) -> str:
        target = self._resolve(path)
        if target.is_file():
            return str(target.relative_to(self.workspace))
        iterator = target.rglob("*") if recursive else target.iterdir()
        entries = []
        for item in sorted(iterator):
            relative = item.relative_to(self.workspace)
            suffix = "/" if item.is_dir() else ""
            entries.append(f"{relative}{suffix}")
        return "\n".join(entries)

    def search_text(
        self,
        query: str,
        path: str = ".",
        max_results: int = 50,
    ) -> str:
        target = self._resolve(path)
        files = [target] if target.is_file() else target.rglob("*")
        results: list[str] = []
        for file_path in files:
            if not file_path.is_file() or ".git" in file_path.parts:
                continue
            try:
                lines = file_path.read_text(encoding="utf-8").splitlines()
            except (UnicodeDecodeError, OSError):
                continue
            for line_number, line in enumerate(lines, start=1):
                if query.lower() in line.lower():
                    relative = file_path.relative_to(self.workspace)
                    results.append(f"{relative}:{line_number}: {line.strip()}")
                    if len(results) >= max_results:
                        return "\n".join(results)
        return "\n".join(results) or "No matches."

    def write_file(self, path: str, content: str) -> str:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Wrote {len(content.encode('utf-8'))} bytes to {path}"

    def replace_text(self, path: str, old_text: str, new_text: str) -> str:
        target = self._resolve(path)
        content = target.read_text(encoding="utf-8")
        occurrences = content.count(old_text)
        if occurrences != 1:
            raise ToolError(
                f"Expected exactly one occurrence, found {occurrences} in {path}"
            )
        target.write_text(content.replace(old_text, new_text, 1), encoding="utf-8")
        return f"Updated {path}"

    def edit_file(self, path: str, edits: list[dict[str, str]]) -> str:
        target = self._resolve(path)
        content = target.read_text(encoding="utf-8")
        updated = content
        for index, edit in enumerate(edits, start=1):
            old_text = edit.get("old_text", "")
            new_text = edit.get("new_text", "")
            occurrences = updated.count(old_text)
            if not old_text or occurrences != 1:
                raise ToolError(
                    f"Edit {index} expected one non-empty match, "
                    f"found {occurrences} in {path}"
                )
            updated = updated.replace(old_text, new_text, 1)
        target.write_text(updated, encoding="utf-8")
        return f"Applied {len(edits)} edits to {path}"

    def git_status(self) -> str:
        return self._run_process(["git", "status", "--short", "--branch"], 30)

    def git_diff(self, path: str = "") -> str:
        command = ["git", "diff", "--"]
        if path:
            target = self._resolve(path)
            command.append(str(target.relative_to(self.workspace)))
        return self._run_process(command, 30)

    def run_command(self, command: str, timeout_seconds: int = 120) -> str:
        shell_command: list[str]
        if os.name == "nt":
            shell_command = ["powershell", "-NoProfile", "-Command", command]
        else:
            shell_command = ["/bin/sh", "-lc", command]
        return self._run_process(shell_command, timeout_seconds)

    def _run_process(self, command: list[str], timeout_seconds: int) -> str:
        try:
            completed = subprocess.run(
                command,
                cwd=self.workspace,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise ToolError(f"Command timed out after {timeout_seconds}s") from exc
        output = completed.stdout or ""
        return f"exit_code={completed.returncode}\n{output}"
