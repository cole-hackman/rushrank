import pytest
from python_server.slideshow import (
    hex_to_rgb,
    accent_or_default,
    initials_for_name,
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
