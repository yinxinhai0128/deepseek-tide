from __future__ import annotations

import argparse
import sys
from typing import TextIO

from . import __version__
from .agent import create_agent
from .client import APIError, DeepSeekClient
from .config import Config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="deepseek-tide",
        description="Terminal coding agent for DeepSeek-compatible APIs",
    )
    parser.add_argument("-p", "--prompt", help="Run one prompt and exit")
    parser.add_argument(
        "--mode",
        choices=("plan", "agent", "yolo"),
        default="agent",
    )
    parser.add_argument("--model", default="deepseek-v4-flash")
    parser.add_argument("--base-url", default="https://api.deepseek.com")
    parser.add_argument("--api-key")
    parser.add_argument("--workspace", default=".")
    parser.add_argument("--max-steps", type=int, default=24)
    parser.add_argument("--timeout", type=int, default=660)
    parser.add_argument("--max-retries", type=int, default=4)
    parser.add_argument("--no-stream", action="store_true")
    parser.add_argument(
        "--allow-dangerous",
        action="store_true",
        help="Allow destructive shell commands in yolo mode",
    )
    parser.add_argument("--continue-session", action="store_true")
    parser.add_argument("--version", action="version", version=__version__)
    return parser


class ConsoleEvents:
    def __init__(self, output: TextIO = sys.stdout) -> None:
        self.output = output
        self._streaming = False
        self._reasoning = False

    def __call__(self, kind: str, value: str) -> None:
        if kind == "reasoning":
            if not self._reasoning:
                print("\n[thinking] ", end="", file=self.output, flush=True)
                self._reasoning = True
            print(value, end="", file=self.output, flush=True)
            return
        if kind == "text":
            if not self._streaming:
                print("\n[assistant] ", end="", file=self.output, flush=True)
                self._streaming = True
            print(value, end="", file=self.output, flush=True)
            return
        if kind == "keepalive":
            return
        if self._streaming or self._reasoning:
            print(file=self.output)
            self._streaming = False
            self._reasoning = False
        labels = {"tool_start": "tool", "tool_end": "result", "retry": "retry"}
        print(f"[{labels.get(kind, kind)}] {value}", file=self.output, flush=True)

    def finish(self) -> None:
        if self._streaming or self._reasoning:
            print(file=self.output)
            self._streaming = False
            self._reasoning = False


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = Config.from_args(
        api_key=args.api_key,
        base_url=args.base_url,
        model=args.model,
        mode=args.mode,
        workspace=args.workspace,
        max_steps=args.max_steps,
        timeout_seconds=args.timeout,
        max_retries=args.max_retries,
        stream=not args.no_stream,
    )
    if not config.api_key:
        print(
            "Missing API key. Set DEEPSEEK_API_KEY or pass --api-key.",
            file=sys.stderr,
        )
        return 2

    client = DeepSeekClient(
        api_key=config.api_key,
        base_url=config.base_url,
        model=config.model,
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
        stream=config.stream,
    )
    events = ConsoleEvents()
    agent = create_agent(
        client=client,
        workspace=config.workspace,
        mode=config.mode,
        max_steps=config.max_steps,
        continue_session=args.continue_session,
        interactive=args.prompt is None or sys.stdin.isatty(),
        allow_dangerous=args.allow_dangerous,
        on_event=events,
    )

    try:
        if args.prompt:
            result = agent.run(args.prompt)
            events.finish()
            if not config.stream:
                print(result)
            return 0

        print(f"DeepSeek-Tide {__version__} | {config.mode} | {config.model}")
        print("输入 /exit 退出，/clear 开始新会话。")
        while True:
            try:
                prompt = input("\n> ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                return 0
            if not prompt:
                continue
            if prompt == "/exit":
                return 0
            if prompt == "/clear":
                agent.messages = [agent.messages[0]]
                agent.sessions.save(agent.messages)
                print("会话已清空。")
                continue
            result = agent.run(prompt)
            events.finish()
            if not config.stream:
                print(result)
    except (APIError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
