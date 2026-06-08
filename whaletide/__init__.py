"""Compatibility loader for running DeepSeek-Tide without installation."""

from pathlib import Path

_source_package = Path(__file__).resolve().parent.parent / "src" / "whaletide"
__path__.append(str(_source_package))

__version__ = "0.2.0"
