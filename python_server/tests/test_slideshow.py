import pytest
from io import BytesIO
from PIL import Image
from python_server.slideshow import (
    hex_to_rgb,
    accent_or_default,
    initials_for_name,
    render_initials_avatar,
    prepare_photo_bytes,
)


def test_hex_to_rgb_parses_uppercase():
    assert hex_to_rgb("#0033A0") == (0, 51, 160)


def test_hex_to_rgb_parses_lowercase():
    assert hex_to_rgb("#ffc0cb") == (255, 192, 203)


def test_accent_or_default_returns_default_when_disabled():
    theme = {"enabled": False, "accent_hex": "#0033A0", "source": "auto"}
    assert accent_or_default(theme) == (10, 10, 10)


def test_accent_or_default_returns_default_when_no_hex():
    theme = {"enabled": True, "accent_hex": None, "source": "auto"}
    assert accent_or_default(theme) == (10, 10, 10)


def test_accent_or_default_returns_accent_when_enabled():
    theme = {"enabled": True, "accent_hex": "#0033A0", "source": "manual"}
    assert accent_or_default(theme) == (0, 51, 160)


def test_initials_single_word():
    assert initials_for_name("Madonna") == "M"


def test_initials_two_words():
    assert initials_for_name("Marcus Chen") == "MC"


def test_initials_three_plus_words():
    assert initials_for_name("Mary Jane Watson") == "MW"


def test_initials_handles_empty():
    assert initials_for_name("") == "?"


def test_render_initials_avatar_returns_jpeg_bytes():
    data = render_initials_avatar("Marcus Chen", accent_rgb=(0, 51, 160))
    img = Image.open(BytesIO(data))
    assert img.format == "JPEG"
    assert img.size == (600, 750)


def test_prepare_photo_bytes_crops_to_4x5():
    # synthetic landscape jpeg
    src = Image.new("RGB", (1200, 800), color=(120, 120, 120))
    buf = BytesIO()
    src.save(buf, format="JPEG")
    buf.seek(0)
    out = prepare_photo_bytes(buf.getvalue())
    img = Image.open(BytesIO(out))
    assert img.format == "JPEG"
    w, h = img.size
    assert abs((w / h) - (4 / 5)) < 0.01
    assert max(w, h) <= 1200


def test_prepare_photo_bytes_handles_portrait_taller_than_4x5():
    src = Image.new("RGB", (600, 1200), color=(120, 120, 120))
    buf = BytesIO()
    src.save(buf, format="JPEG")
    buf.seek(0)
    out = prepare_photo_bytes(buf.getvalue())
    img = Image.open(BytesIO(out))
    w, h = img.size
    assert abs((w / h) - (4 / 5)) < 0.01
