"""Slideshow (PPTX) export for chapter PNM rosters."""

from __future__ import annotations

from typing import Iterable

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
