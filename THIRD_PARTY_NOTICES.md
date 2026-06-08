# Third-Party Notices

## CodeWhale

DeepSeek-Tide's default runtime is the official binary distribution of
[Hmbown/CodeWhale](https://github.com/Hmbown/CodeWhale), distributed under the
MIT License.

CodeWhale copyright:

Copyright (c) 2024-2025 DeepSeek CLI Contributors

The installer downloads CodeWhale from the maintainer's official GitHub
Release, verifies the published SHA-256 checksum, and preserves any license
file shipped in that archive. DeepSeek-Tide's launcher, desktop client, and
installer code are separately covered by this repository's MIT License.

## DeepSeek-Reasonix design research

The cache observability and stable-prefix profile were independently
implemented after studying the public MIT-licensed
[esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix)
repository at commit `3f75e4e22cdbf515290cfd64549e6680e57aabfa`.

The studied concepts include deterministic configuration fingerprints,
cache-stable prefixes, infrequent context compaction, and lazy plugin startup.
DeepSeek-Tide does not copy, compile, vendor, or distribute Reasonix source.

Reasonix copyright:

Copyright (c) 2026 Reasonix Contributors

## Desktop design research

The desktop interface was informed by publicly documented features and
screenshots of [thabti/kirodex](https://github.com/thabti/kirodex), an
MIT-described Tauri desktop coding-agent client. DeepSeek-Tide does not ship
Kirodex source code or its Kiro-specific runtime. Its Electron/React interface
and CodeWhale process bridge are independently implemented.

The Python code under `src/whaletide` predates the current distribution
approach and is an independent clean-room fallback implementation.
