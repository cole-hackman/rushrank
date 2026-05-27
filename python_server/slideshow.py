"""Slideshow (PPTX) export for chapter PNM rosters."""

from __future__ import annotations

from io import BytesIO
from typing import Iterable
from PIL import Image, ImageDraw, ImageFont, ImageOps

DEFAULT_ACCENT_RGB = (10, 10, 10)        # near-black
CREAM_RGB = (250, 247, 240)
TEXT_RGB = (10, 10, 10)
MUTED_RGB = (92, 92, 92)
BORDER_RGB = (232, 227, 214)


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    s = hex_str.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def accent_or_default(theme: dict | None) -> tuple[int, int, int]:
    if not theme:
        return DEFAULT_ACCENT_RGB
    if not theme.get("enabled"):
        return DEFAULT_ACCENT_RGB
    hex_ = theme.get("accent_hex")
    if not hex_:
        return DEFAULT_ACCENT_RGB
    return hex_to_rgb(hex_)


def initials_for_name(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][0].upper()
    return (parts[0][0] + parts[-1][0]).upper()


PHOTO_W, PHOTO_H = 600, 750  # 4:5 portrait, source size before placement on slide


def render_initials_avatar(
    name: str,
    accent_rgb: tuple[int, int, int],
    size: tuple[int, int] = (PHOTO_W, PHOTO_H),
) -> bytes:
    bg = (
        int(CREAM_RGB[0] * 0.93 + accent_rgb[0] * 0.07),
        int(CREAM_RGB[1] * 0.93 + accent_rgb[1] * 0.07),
        int(CREAM_RGB[2] * 0.93 + accent_rgb[2] * 0.07),
    )
    img = Image.new("RGB", size, color=bg)
    draw = ImageDraw.Draw(img)
    text = initials_for_name(name)

    font_size = int(size[1] * 0.4)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size[0] - tw) / 2 - bbox[0]
    y = (size[1] - th) / 2 - bbox[1]
    draw.text((x, y), text, fill=accent_rgb, font=font)

    out = BytesIO()
    img.save(out, format="JPEG", quality=88)
    return out.getvalue()


def prepare_photo_bytes(data: bytes) -> bytes:
    img = Image.open(BytesIO(data))
    img = ImageOps.exif_transpose(img).convert("RGB")

    # center-crop to 4:5
    w, h = img.size
    target_ratio = 4 / 5
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif current_ratio < target_ratio:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))

    # cap long edge at 1200
    max_edge = 1200
    if max(img.size) > max_edge:
        ratio = max_edge / max(img.size)
        img = img.resize((int(img.size[0] * ratio), int(img.size[1] * ratio)))

    out = BytesIO()
    img.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()
