from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw


def make_icon(size: int) -> Image.Image:
    scale = size / 512
    image = Image.new("RGBA", (size, size), (12, 13, 15, 255))
    draw = ImageDraw.Draw(image)
    margin = int(72 * scale)
    radius = int(112 * scale)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=radius,
        fill=(215, 255, 101, 255),
    )

    points: list[tuple[float, float]] = []
    for x in range(int(142 * scale), int(370 * scale) + 1):
        logical_x = x / scale
        progress = (logical_x - 142) / 228
        y = 256 + math.sin(progress * math.pi * 4) * 64
        points.append((x, y * scale))
    draw.line(
        points,
        fill=(15, 17, 13, 255),
        width=max(3, int(24 * scale)),
        joint="curve",
    )
    return image


def main() -> None:
    output = Path(__file__).resolve().parent.parent / "build"
    output.mkdir(parents=True, exist_ok=True)
    image = make_icon(512)
    image.save(output / "icon.png")
    image.save(
        output / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
