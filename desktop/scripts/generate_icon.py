from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

# 4x 超采样,最后缩小 -> 平滑抗锯齿
SS = 4

# DeepSeek 蓝渐变(上浅下深)+ 白色波浪。与 App 内的蓝色主题和波形 logo 统一。
BLUE_TOP = (102, 173, 255)
BLUE_BOTTOM = (43, 98, 230)
WAVE = (255, 255, 255, 255)


def _lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def make_icon(size: int) -> Image.Image:
    s = size * SS
    k = s / 512  # 把 512 设计坐标缩放到实际渲染尺寸

    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # 1) 竖直蓝色渐变
    gradient = Image.new("RGBA", (s, s))
    gdraw = ImageDraw.Draw(gradient)
    for y in range(s):
        color = _lerp(BLUE_TOP, BLUE_BOTTOM, y / (s - 1))
        gdraw.line([(0, y), (s, y)], fill=color + (255,))

    # 2) 圆角方块遮罩,把渐变裁成圆角方块
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (26 * k, 26 * k, s - 26 * k, s - 26 * k),
        radius=104 * k,
        fill=255,
    )
    image.paste(gradient, (0, 0), mask)

    # 3) 白色波浪(2 个周期):用密集重叠圆点描边 -> 无缝、圆头、平滑的笔触
    #    (Pillow 的 line 不抗锯齿,粗线段会有接缝纹理,改用圆点更干净)
    draw = ImageDraw.Draw(image)
    x0, x1 = 150, 362  # 512 设计坐标
    r = 15 * k  # 笔触半径(线宽 ~30)
    steps = 640
    for i in range(steps + 1):
        progress = i / steps
        logical_x = x0 + (x1 - x0) * progress
        y = 256 + math.sin(progress * math.pi * 4) * 52
        px, py = logical_x * k, y * k
        draw.ellipse((px - r, py - r, px + r, py + r), fill=WAVE)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    output = Path(__file__).resolve().parent.parent / "build"
    output.mkdir(parents=True, exist_ok=True)
    image = make_icon(512)
    image.save(output / "icon.png")
    image.save(
        output / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("wrote", output / "icon.png", "and icon.ico")


if __name__ == "__main__":
    main()
