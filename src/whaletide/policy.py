from __future__ import annotations

from dataclasses import dataclass
import re


READ_TOOLS = {
    "read_file",
    "list_files",
    "search_text",
    "git_status",
    "git_diff",
}
WRITE_TOOLS = {"write_file", "replace_text", "edit_file"}
EXEC_TOOLS = {"run_command"}

DANGEROUS_COMMANDS = [
    re.compile(r"(?i)\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)"),
    re.compile(r"(?i)\b(remove-item|rm|rmdir|del)\b[^\r\n]*(--?recurse|-r\b|/s\b)"),
    re.compile(r"(?i)\b(format|shutdown|restart-computer|stop-computer)\b"),
    re.compile(r"(?i)\b(curl|wget|iwr)\b[^\r\n]*\|\s*(sh|bash|pwsh|powershell)\b"),
]


@dataclass
class Policy:
    mode: str
    interactive: bool = True
    allow_dangerous: bool = False

    def authorize(self, tool_name: str, arguments: dict[str, object]) -> bool:
        if tool_name in READ_TOOLS:
            return True
        if self.mode == "plan":
            return False
        dangerous = tool_name == "run_command" and self._dangerous(
            str(arguments.get("command", ""))
        )
        if dangerous and not self.allow_dangerous:
            return False
        if self.mode == "yolo":
            return True
        if not self.interactive:
            return False

        detail = arguments.get("path") or arguments.get("command") or arguments
        answer = input(f"\n允许 {tool_name} ({detail})? [y/N] ").strip().lower()
        return answer in {"y", "yes"}

    @staticmethod
    def _dangerous(command: str) -> bool:
        return any(pattern.search(command) for pattern in DANGEROUS_COMMANDS)
