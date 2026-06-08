from __future__ import annotations

import argparse
import shutil
import urllib.request
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output")
    parser.add_argument("--proxy", default="")
    args = parser.parse_args()

    handlers: list[urllib.request.BaseHandler] = []
    if args.proxy:
        handlers.append(
            urllib.request.ProxyHandler(
                {"http": args.proxy, "https": args.proxy}
            )
        )
    opener = urllib.request.build_opener(*handlers)
    request = urllib.request.Request(
        args.url,
        headers={"User-Agent": "CodeTide-Installer/1.0"},
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with opener.open(request, timeout=180) as response:
        with output.open("wb") as destination:
            shutil.copyfileobj(response, destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
