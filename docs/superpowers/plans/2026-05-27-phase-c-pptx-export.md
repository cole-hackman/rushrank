# Phase C — PPTX Slideshow Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Export to PowerPoint" action on the PNM list that generates a polished, photo-forward `.pptx` file — one slide per PNM, themed with the chapter accent if enabled.

**Architecture:** New `python_server/slideshow.py` module builds the deck in-memory with `python-pptx`. A new FastAPI route streams the bytes as an attachment. Photos are fetched from Supabase Storage concurrently, processed with Pillow (orient, resize, 4:5 crop, JPEG q85), and falls back to server-rendered initials avatars on miss. Frontend toolbar button calls the endpoint with the current filter state and downloads the blob.

**Tech Stack:** FastAPI, asyncpg, `python-pptx`, Pillow, react-query.

**Spec:** `docs/superpowers/specs/2026-05-27-rebrand-themes-landing-export-design.md`

**Depends on:** Phase A merged (`chapters.theme` exists; `theme.accent_hex` available).

---

## File Structure

**Create:**
- `python_server/slideshow.py` — `SlideshowService` + deck-building helpers.
- `python_server/tests/test_slideshow.py` — unit tests for the builder.
- `python_server/tests/test_export_route.py` — route-level tests.

**Modify:**
- `python_server/requirements.txt` — add `python-pptx`, `Pillow`.
- `python_server/routes.py` — add `POST /pnms/export/pptx`.
- `python_server/services.py` — extend `PNMService` with a filter-aware list helper if the existing one doesn't already accept the needed filter shape.
- `frontend/lib/api.ts` — add `exportPnmsPptx`.
- `frontend/app/(dashboard)/pnms/page.tsx` — toolbar button.
- `frontend/app/(dashboard)/exports/page.tsx` — surface the export alongside existing exports.

---

## Task 1: Dependencies

**Files:**
- Modify: `python_server/requirements.txt`

- [ ] **Step 1: Add to requirements**

Append (preserving existing pins):

```
python-pptx>=0.6.23
Pillow>=10.0
```

- [ ] **Step 2: Install**

Run: `pip install -r python_server/requirements.txt`
Expected: both packages install without conflict.

- [ ] **Step 3: Sanity import**

Run: `python -c "from pptx import Presentation; from PIL import Image; print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add python_server/requirements.txt
git commit -m "feat(deps): add python-pptx and Pillow for slideshow export"
```

---

## Task 2: Slideshow module — color helpers (TDD)

**Files:**
- Test: `python_server/tests/test_slideshow.py`
- Create: `python_server/slideshow.py`

- [ ] **Step 1: Failing tests for color utilities**

```python
# python_server/tests/test_slideshow.py
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
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: import errors (module missing).

- [ ] **Step 3: Create slideshow.py with helpers**

```python
# python_server/slideshow.py
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
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/slideshow.py python_server/tests/test_slideshow.py
git commit -m "feat(export): slideshow color + initials helpers"
```

---

## Task 3: Avatar fallback rendering (TDD)

**Files:**
- Test: `python_server/tests/test_slideshow.py` (extend)
- Modify: `python_server/slideshow.py`

- [ ] **Step 1: Add failing tests**

Append to `test_slideshow.py`:

```python
from io import BytesIO
from PIL import Image
from python_server.slideshow import render_initials_avatar, prepare_photo_bytes

def test_render_initials_avatar_returns_jpeg_bytes():
    data = render_initials_avatar("Marcus Chen", accent_rgb=(0, 51, 160))
    img = Image.open(BytesIO(data))
    assert img.format == "JPEG"
    assert img.size == (600, 750)

def test_prepare_photo_bytes_crops_to_4x5():
    # synthetic landscape jpeg
    src = Image.new("RGB", (1200, 800), color=(120, 120, 120))
    buf = BytesIO(); src.save(buf, format="JPEG"); buf.seek(0)
    out = prepare_photo_bytes(buf.getvalue())
    img = Image.open(BytesIO(out))
    assert img.format == "JPEG"
    w, h = img.size
    assert abs((w / h) - (4 / 5)) < 0.01
    assert max(w, h) <= 1200

def test_prepare_photo_bytes_handles_portrait_taller_than_4x5():
    src = Image.new("RGB", (600, 1200), color=(120, 120, 120))
    buf = BytesIO(); src.save(buf, format="JPEG"); buf.seek(0)
    out = prepare_photo_bytes(buf.getvalue())
    img = Image.open(BytesIO(out))
    w, h = img.size
    assert abs((w / h) - (4 / 5)) < 0.01
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: 3 new failures (missing functions).

- [ ] **Step 3: Implement**

Append to `python_server/slideshow.py`:

```python
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageOps

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
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: 11 PASS.

- [ ] **Step 5: Commit**

```bash
git add python_server/slideshow.py python_server/tests/test_slideshow.py
git commit -m "feat(export): avatar fallback + photo preprocessing"
```

---

## Task 4: Deck builder (TDD)

**Files:**
- Test: `python_server/tests/test_slideshow.py` (extend)
- Modify: `python_server/slideshow.py`

- [ ] **Step 1: Add failing tests**

Append to `test_slideshow.py`:

```python
from pptx import Presentation
from python_server.slideshow import build_deck, PnmSlideData

SAMPLE_PNM = lambda i, **kw: PnmSlideData(
    id=f"pnm-{i}",
    name=kw.get("name", f"PNM {i}"),
    year=kw.get("year", "Freshman"),
    major=kw.get("major", "Economics"),
    gpa=kw.get("gpa", 3.7),
    hometown=kw.get("hometown", "Boston, MA"),
    photo_bytes=kw.get("photo_bytes", None),
    tags=kw.get("tags", []),
    status=kw.get("status", "active"),
    vote_summary=kw.get("vote_summary", {"up": 5, "down": 1, "star": 0}),
    latest_note=kw.get("latest_note", None),
)

CHAPTER_META = {"name": "Sigma Chi at BC", "fraternity": "Sigma Chi"}
THEME_ON = {"enabled": True, "accent_hex": "#0033A0", "source": "manual"}
THEME_OFF = {"enabled": False, "accent_hex": None, "source": "auto"}

def test_build_deck_has_cover_and_closing():
    pnms = [SAMPLE_PNM(i) for i in range(3)]
    data = build_deck(pnms, chapter=CHAPTER_META, theme=THEME_OFF, exported_at="2026-05-27")
    pres = Presentation(BytesIO(data))
    # cover + 3 pnms + closing = 5 (no section dividers since all same status)
    assert len(pres.slides) == 5

def test_build_deck_inserts_section_divider_between_statuses():
    pnms = [
        SAMPLE_PNM(1, status="round_1"),
        SAMPLE_PNM(2, status="round_1"),
        SAMPLE_PNM(3, status="round_2"),
    ]
    data = build_deck(pnms, chapter=CHAPTER_META, theme=THEME_OFF, exported_at="2026-05-27")
    pres = Presentation(BytesIO(data))
    # cover + round_1 divider + 2 pnms + round_2 divider + 1 pnm + closing = 7
    assert len(pres.slides) == 7

def test_build_deck_uses_accent_when_theme_enabled():
    pnms = [SAMPLE_PNM(1)]
    data = build_deck(pnms, chapter=CHAPTER_META, theme=THEME_ON, exported_at="2026-05-27")
    pres = Presentation(BytesIO(data))
    # find the accent bar shape on the PNM slide (slide index 1, after cover)
    accent_shapes = [s for s in pres.slides[1].shapes if s.shape_type == 1]  # rectangle
    # at least one rectangle in the accent color
    found = False
    for s in accent_shapes:
        if s.fill.fore_color.rgb == 0x0033A0:
            found = True
            break
    assert found, "no accent-colored shape on PNM slide"

def test_build_deck_missing_photo_uses_avatar():
    pnms = [SAMPLE_PNM(1, photo_bytes=None, name="Marcus Chen")]
    data = build_deck(pnms, chapter=CHAPTER_META, theme=THEME_OFF, exported_at="2026-05-27")
    pres = Presentation(BytesIO(data))
    # slide 1 (cover=0, first PNM=1)
    pics = [s for s in pres.slides[1].shapes if s.shape_type == 13]
    assert len(pics) == 1  # avatar still injected as a picture

def test_build_deck_pnm_slide_contains_name_and_metadata():
    pnms = [SAMPLE_PNM(1, name="Marcus Chen", year="Freshman", major="CS", gpa=3.91)]
    data = build_deck(pnms, chapter=CHAPTER_META, theme=THEME_OFF, exported_at="2026-05-27")
    pres = Presentation(BytesIO(data))
    texts = []
    for shape in pres.slides[1].shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                for r in p.runs:
                    texts.append(r.text)
    full = " ".join(texts)
    assert "Marcus Chen" in full
    assert "Freshman" in full
    assert "CS" in full
    assert "3.91" in full
```

- [ ] **Step 2: Run, confirm fail**

Expected: builder + types not defined.

- [ ] **Step 3: Implement builder**

Append to `python_server/slideshow.py`:

```python
from dataclasses import dataclass, field
from typing import Optional
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE


@dataclass
class PnmSlideData:
    id: str
    name: str
    year: str
    major: str
    gpa: float
    hometown: str
    status: str
    vote_summary: dict
    photo_bytes: Optional[bytes] = None
    tags: list[str] = field(default_factory=list)
    latest_note: Optional[dict] = None  # {"author": str, "text": str}


SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def _rgb(c: tuple[int, int, int]) -> RGBColor:
    return RGBColor(c[0], c[1], c[2])


def _add_background(slide, fill_rgb: tuple[int, int, int]):
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H
    )
    bg.line.fill.background()
    bg.fill.solid()
    bg.fill.fore_color.rgb = _rgb(fill_rgb)
    bg.shadow.inherit = False
    return bg


def _add_accent_bar(slide, accent_rgb):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, Emu(73152))  # ~8px
    bar.line.fill.background()
    bar.fill.solid()
    bar.fill.fore_color.rgb = _rgb(accent_rgb)


def _add_text(slide, left, top, width, height, text, *, size_pt, rgb, bold=False, italic=False, font="Calibri"):
    tx = slide.shapes.add_textbox(left, top, width, height)
    tf = tx.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size_pt)
    run.font.color.rgb = _rgb(rgb)
    run.font.bold = bold
    run.font.italic = italic
    run.font.name = font
    return tx


def _build_cover(pres, chapter, theme, total, exported_at):
    slide = pres.slides.add_slide(pres.slide_layouts[6])  # blank
    _add_background(slide, CREAM_RGB)
    _add_accent_bar(slide, accent_or_default(theme))
    _add_text(slide, Inches(1), Inches(2.6), Inches(11.3), Inches(1.5),
              chapter["name"], size_pt=54, rgb=TEXT_RGB, bold=True, font="Georgia")
    _add_text(slide, Inches(1), Inches(4.2), Inches(11.3), Inches(0.6),
              f"Rush — PNM Roster · {exported_at}", size_pt=18, rgb=MUTED_RGB)
    _add_text(slide, Inches(1), Inches(4.9), Inches(11.3), Inches(0.6),
              f"{total} PNMs", size_pt=14, rgb=MUTED_RGB)


def _build_section_divider(pres, theme, label, count):
    slide = pres.slides.add_slide(pres.slide_layouts[6])
    accent = accent_or_default(theme)
    soft = (
        int(CREAM_RGB[0] * 0.92 + accent[0] * 0.08),
        int(CREAM_RGB[1] * 0.92 + accent[1] * 0.08),
        int(CREAM_RGB[2] * 0.92 + accent[2] * 0.08),
    )
    _add_background(slide, soft)
    _add_text(slide, Inches(1), Inches(3.2), Inches(11.3), Inches(1.2),
              f"{label} — {count} PNMs", size_pt=44, rgb=TEXT_RGB, bold=True, font="Georgia")


def _build_pnm_slide(pres, pnm: PnmSlideData, chapter, theme, page_number):
    slide = pres.slides.add_slide(pres.slide_layouts[6])
    _add_background(slide, CREAM_RGB)
    accent = accent_or_default(theme)
    _add_accent_bar(slide, accent)

    photo_bytes = pnm.photo_bytes or render_initials_avatar(pnm.name, accent)
    photo_stream = BytesIO(photo_bytes)
    slide.shapes.add_picture(photo_stream, Inches(0.7), Inches(0.8), width=Inches(3.5), height=Inches(4.375))

    info_left = Inches(4.7)
    _add_text(slide, info_left, Inches(0.8), Inches(8), Inches(0.9),
              pnm.name, size_pt=32, rgb=TEXT_RGB, bold=True, font="Georgia")
    _add_text(slide, info_left, Inches(1.7), Inches(8), Inches(0.5),
              f"{pnm.year} · {pnm.major}", size_pt=16, rgb=MUTED_RGB)
    _add_text(slide, info_left, Inches(2.2), Inches(8), Inches(0.5),
              f"GPA {pnm.gpa:.2f} · {pnm.hometown}", size_pt=14, rgb=MUTED_RGB)

    if pnm.tags:
        chip_text = "Tags: " + ", ".join(pnm.tags[:5])
        if len(pnm.tags) > 5:
            chip_text += f", +{len(pnm.tags) - 5}"
        _add_text(slide, info_left, Inches(3.0), Inches(8), Inches(0.5),
                  chip_text, size_pt=12, rgb=TEXT_RGB)

    v = pnm.vote_summary
    _add_text(slide, info_left, Inches(3.7), Inches(8), Inches(0.5),
              f"Voting: {v.get('up',0)} bids · {v.get('down',0)} pass · {v.get('star',0)} star",
              size_pt=12, rgb=TEXT_RGB)

    if pnm.latest_note:
        note = pnm.latest_note["text"][:180]
        author = pnm.latest_note.get("author", "")
        _add_text(slide, info_left, Inches(4.5), Inches(8), Inches(0.5),
                  "Latest note:", size_pt=11, rgb=MUTED_RGB, bold=True)
        _add_text(slide, info_left, Inches(4.9), Inches(8), Inches(1.5),
                  f"“{note}”", size_pt=12, rgb=TEXT_RGB, italic=True)
        if author:
            _add_text(slide, info_left, Inches(6.0), Inches(8), Inches(0.4),
                      f"— {author}", size_pt=10, rgb=MUTED_RGB)

    _add_text(slide, Inches(10.8), Inches(7.1), Inches(2.3), Inches(0.3),
              f"{chapter['name']} · {page_number}", size_pt=9, rgb=MUTED_RGB)


def _build_closing(pres, exported_at):
    slide = pres.slides.add_slide(pres.slide_layouts[6])
    _add_background(slide, CREAM_RGB)
    _add_text(slide, Inches(1), Inches(3.4), Inches(11.3), Inches(0.6),
              "Exported from RushRank", size_pt=22, rgb=TEXT_RGB, bold=True, font="Georgia")
    _add_text(slide, Inches(1), Inches(4.1), Inches(11.3), Inches(0.4),
              exported_at, size_pt=12, rgb=MUTED_RGB)


_STATUS_LABEL = {
    "active": "Active",
    "round_1": "Round 1",
    "round_2": "Round 2",
    "round_3": "Round 3",
    "final": "Final",
    "bid": "Extended Bids",
    "cut": "Cut",
}


def build_deck(
    pnms: list[PnmSlideData],
    chapter: dict,
    theme: dict | None,
    exported_at: str,
) -> bytes:
    pres = Presentation()
    pres.slide_width = SLIDE_W
    pres.slide_height = SLIDE_H

    _build_cover(pres, chapter, theme, total=len(pnms), exported_at=exported_at)

    # group consecutive same-status into sections; insert divider when status changes
    page = 1
    last_status = None
    grouped: dict[str, int] = {}
    for p in pnms:
        grouped[p.status] = grouped.get(p.status, 0) + 1

    distinct_statuses = list(grouped.keys())
    insert_dividers = len(distinct_statuses) > 1

    for p in pnms:
        if insert_dividers and p.status != last_status:
            label = _STATUS_LABEL.get(p.status, p.status.title())
            _build_section_divider(pres, theme, label, grouped[p.status])
            last_status = p.status
        _build_pnm_slide(pres, p, chapter, theme, page_number=page)
        page += 1

    _build_closing(pres, exported_at)

    out = BytesIO()
    pres.save(out)
    return out.getvalue()
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: all PASS (16 total).

- [ ] **Step 5: Commit**

```bash
git add python_server/slideshow.py python_server/tests/test_slideshow.py
git commit -m "feat(export): PPTX deck builder with cover, section dividers, PNM slides"
```

---

## Task 5: SlideshowService — concurrent photo fetching

**Files:**
- Modify: `python_server/slideshow.py`

- [ ] **Step 1: Add failing test**

Append to `test_slideshow.py`:

```python
import asyncio
from python_server.slideshow import SlideshowService

class _StubStorage:
    """Simulates Supabase storage fetch."""
    def __init__(self, mapping):
        self.mapping = mapping
        self.calls = 0
    async def fetch(self, path):
        self.calls += 1
        await asyncio.sleep(0)
        if path not in self.mapping:
            raise FileNotFoundError(path)
        return self.mapping[path]

@pytest.mark.asyncio
async def test_slideshow_service_falls_back_on_missing_photo():
    src = Image.new("RGB", (800, 1000)); buf = BytesIO(); src.save(buf, format="JPEG")
    storage = _StubStorage({"pnms/1.jpg": buf.getvalue()})
    svc = SlideshowService(storage=storage)

    pnm_rows = [
        {"id": "1", "name": "Has Photo", "photo_path": "pnms/1.jpg",
         "year": "Fr", "major": "CS", "gpa": 3.5, "hometown": "BC",
         "status": "active", "tags": [], "vote_summary": {"up":1,"down":0,"star":0},
         "latest_note": None},
        {"id": "2", "name": "No Photo", "photo_path": "pnms/missing.jpg",
         "year": "Fr", "major": "CS", "gpa": 3.5, "hometown": "BC",
         "status": "active", "tags": [], "vote_summary": {"up":1,"down":0,"star":0},
         "latest_note": None},
    ]
    data = await svc.build_pnm_deck(
        pnm_rows, chapter=CHAPTER_META, theme=THEME_OFF, exported_at="2026-05-27",
    )
    pres = Presentation(BytesIO(data))
    # cover + 2 pnms + closing
    assert len(pres.slides) == 4
```

- [ ] **Step 2: Implement service**

Append to `python_server/slideshow.py`:

```python
import asyncio
from typing import Protocol


class _StorageClient(Protocol):
    async def fetch(self, path: str) -> bytes: ...


class SlideshowService:
    MAX_CONCURRENT_PHOTO_FETCH = 10

    def __init__(self, storage):
        self.storage = storage

    async def _fetch_one(self, path: str | None, sem: asyncio.Semaphore) -> bytes | None:
        if not path:
            return None
        async with sem:
            try:
                raw = await self.storage.fetch(path)
                return prepare_photo_bytes(raw)
            except Exception:
                return None

    async def build_pnm_deck(
        self,
        pnm_rows: list[dict],
        chapter: dict,
        theme: dict | None,
        exported_at: str,
    ) -> bytes:
        sem = asyncio.Semaphore(self.MAX_CONCURRENT_PHOTO_FETCH)
        photo_results = await asyncio.gather(
            *(self._fetch_one(row.get("photo_path"), sem) for row in pnm_rows)
        )

        pnms: list[PnmSlideData] = []
        for row, photo in zip(pnm_rows, photo_results):
            pnms.append(PnmSlideData(
                id=str(row["id"]),
                name=row["name"],
                year=row.get("year", ""),
                major=row.get("major", ""),
                gpa=float(row.get("gpa") or 0.0),
                hometown=row.get("hometown", ""),
                status=row.get("status", "active"),
                vote_summary=row.get("vote_summary") or {"up": 0, "down": 0, "star": 0},
                photo_bytes=photo,
                tags=list(row.get("tags") or []),
                latest_note=row.get("latest_note"),
            ))

        return build_deck(pnms, chapter=chapter, theme=theme, exported_at=exported_at)
```

- [ ] **Step 3: Run, confirm pass**

Run: `cd python_server && pytest tests/test_slideshow.py -v`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add python_server/slideshow.py python_server/tests/test_slideshow.py
git commit -m "feat(export): SlideshowService with concurrent photo fetch"
```

---

## Task 6: Backend route — POST /pnms/export/pptx (TDD)

**Files:**
- Test: `python_server/tests/test_export_route.py`
- Modify: `python_server/routes.py`
- Modify: `python_server/services.py` (only if PNMService lacks a filter-aware fetch)

- [ ] **Step 1: Verify PNMService has what we need**

Inspect `python_server/services.py` for `PNMService`. We need a method like:
```python
async def list_for_export(self, chapter_id, *, filters: dict, sort: str | None) -> list[dict]
```
that returns rows containing `id, name, year, major, gpa, hometown, status, tags, photo_path, vote_summary, latest_note`. If the existing list/filter method already returns these, reuse it. If not, write a thin wrapper.

If adding, place after the existing list methods on `PNMService`:

```python
async def list_for_export(self, chapter_id, *, filters: dict, sort: str | None = None):
    base = """
      SELECT p.id, p.name, p.year, p.major, p.gpa, p.hometown,
             p.status, p.photo_path,
             COALESCE(p.tags, '{}'::text[]) AS tags,
             COALESCE(jsonb_build_object(
               'up',   (SELECT count(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'up'),
               'down', (SELECT count(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'down'),
               'star', (SELECT count(*) FROM votes v WHERE v.pnm_id = p.id AND v.value = 'star')
             ), '{}'::jsonb) AS vote_summary,
             (SELECT jsonb_build_object('author', u.display_name, 'text', n.body)
                FROM notes n LEFT JOIN users u ON u.id = n.author_id
                WHERE n.pnm_id = p.id ORDER BY n.created_at DESC LIMIT 1) AS latest_note
      FROM pnms p
      WHERE p.chapter_id = $1 AND COALESCE(p.archived, false) = false
    """
    args = [chapter_id]
    if filters.get("status"):
        args.append(filters["status"])
        base += f" AND p.status = ${len(args)}"
    if filters.get("search"):
        args.append(f"%{filters['search'].lower()}%")
        base += f" AND lower(p.name) LIKE ${len(args)}"
    order = "p.status, p.name"
    if sort == "name":
        order = "p.name"
    elif sort == "gpa":
        order = "p.gpa DESC NULLS LAST"
    base += f" ORDER BY {order}"
    async with self.pool.acquire() as conn:
        rows = await conn.fetch(base, *args)
        return [dict(r) for r in rows]
```

(If the table doesn't have a `photo_path` column under that exact name, substitute the correct field — verify with `\d pnms`.)

- [ ] **Step 2: Write route tests**

```python
# python_server/tests/test_export_route.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_export_zero_pnms_returns_400(client: AsyncClient, admin_token):
    r = await client.post(
        "/api/v1/pnms/export/pptx",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"filters": {"status": "no-such-status"}},
    )
    assert r.status_code == 400
    assert "No PNMs" in r.json()["detail"]

@pytest.mark.asyncio
async def test_export_over_cap_returns_400(client: AsyncClient, admin_token, seed_201_pnms):
    r = await client.post(
        "/api/v1/pnms/export/pptx",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"filters": {}},
    )
    assert r.status_code == 400
    assert "200" in r.json()["detail"]

@pytest.mark.asyncio
async def test_export_returns_pptx_bytes(client: AsyncClient, admin_token, seed_some_pnms):
    r = await client.post(
        "/api/v1/pnms/export/pptx",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"filters": {}},
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    assert "attachment" in r.headers["content-disposition"]
    assert r.content[:4] == b"PK\x03\x04"  # zip magic = pptx

@pytest.mark.asyncio
async def test_export_forbidden_for_member(client, member_token, seed_some_pnms):
    r = await client.post(
        "/api/v1/pnms/export/pptx",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"filters": {}},
    )
    assert r.status_code == 403
```

- [ ] **Step 3: Implement route**

In `python_server/routes.py`, add:

```python
from datetime import datetime, timezone
from fastapi.responses import StreamingResponse
from python_server.slideshow import SlideshowService

class ExportPptxRequest(BaseModel):
    filters: dict = Field(default_factory=dict)
    sort: str | None = None

EXPORT_MAX = 200

@router.post("/pnms/export/pptx")
async def export_pnms_pptx(
    body: ExportPptxRequest,
    user=Depends(get_current_user),
    pnm_svc: PNMService = Depends(get_pnm_service),
    chapter_svc: ChapterService = Depends(get_chapter_service),
    storage = Depends(get_storage_client),
    rate_limiter = Depends(rate_limit_export),
):
    chapter_id = await chapter_svc.get_user_chapter_id(user.id)
    role = await chapter_svc.get_user_role(chapter_id, user.id)
    if role not in ("admin", "exec"):
        raise HTTPException(403, "Admin or exec role required")

    rows = await pnm_svc.list_for_export(chapter_id, filters=body.filters, sort=body.sort)
    if len(rows) == 0:
        raise HTTPException(400, "No PNMs match your filters")
    if len(rows) > EXPORT_MAX:
        raise HTTPException(400, f"Filter to fewer than {EXPORT_MAX} PNMs to export")

    chapter = await chapter_svc.get_chapter(chapter_id)
    theme = await chapter_svc.get_theme(chapter_id)

    svc = SlideshowService(storage=storage)
    data = await svc.build_pnm_deck(
        rows,
        chapter={"name": chapter["name"], "fraternity": chapter.get("fraternity") or ""},
        theme=theme,
        exported_at=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    )

    slug = (chapter["name"] or "chapter").lower().replace(" ", "-")
    filename = f"{slug}-pnms-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pptx"
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

- [ ] **Step 4: Add helpers if missing**

In `services.py`, add to `ChapterService` if absent:

```python
async def get_user_role(self, chapter_id, user_id) -> str | None:
    async with self.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role FROM memberships WHERE chapter_id = $1 AND user_id = $2",
            chapter_id, user_id,
        )
        return row["role"] if row else None

async def get_chapter(self, chapter_id) -> dict:
    async with self.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM chapters WHERE id = $1", chapter_id)
        return dict(row) if row else None
```

In a new file `python_server/rate_limit_export.py` (or extend `rate_limit.py`):

```python
from fastapi import HTTPException, Depends
import time

_LAST_CALL: dict[str, float] = {}

async def rate_limit_export(user = Depends(get_current_user)):
    now = time.monotonic()
    last = _LAST_CALL.get(user.id, 0.0)
    if now - last < 30.0:
        raise HTTPException(429, "Export rate limit: try again in a few seconds")
    _LAST_CALL[user.id] = now
```

Provide `get_storage_client` dependency that returns an object with `async def fetch(path) -> bytes`. If `UploadService` already wraps the Supabase storage client, reuse it; otherwise implement a thin wrapper using the existing service-role Supabase client in the codebase.

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd python_server && pytest tests/test_export_route.py -v`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add python_server/
git commit -m "feat(export): POST /pnms/export/pptx with caps and rate limit"
```

---

## Task 7: Frontend — api client + download wiring

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add export function**

Add to `frontend/lib/api.ts`:

```ts
export interface PnmExportFilters {
  status?: string;
  round_id?: string;
  tag_ids?: string[];
  search?: string;
}

export async function exportPnmsPptx(
  filters: PnmExportFilters,
  sort?: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${getApiBase()}/pnms/export/pptx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ filters, sort }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Export failed (${res.status})`);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || "pnms.pptx";
  const blob = await res.blob();
  return { blob, filename };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

(`getApiBase()` should already exist in `api.ts`. If the API base helper is named differently, use that name.)

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(ui): exportPnmsPptx client helper"
```

---

## Task 8: Frontend — Export button on /pnms

**Files:**
- Modify: `frontend/app/(dashboard)/pnms/page.tsx`

- [ ] **Step 1: Add button + handler**

In the PNMs page, locate the toolbar (existing area with filters or other action buttons). Add:

```tsx
"use client";

import { useState } from "react";
import { exportPnmsPptx, triggerBlobDownload, type PnmExportFilters } from "@/lib/api";
import { toast } from "sonner"; // or matching project toast lib

// inside the component, alongside existing filter state:
const [exporting, setExporting] = useState(false);

async function handleExportPptx() {
  setExporting(true);
  const tid = toast.loading("Building your deck… ~10s for 30 PNMs");
  try {
    const filters: PnmExportFilters = {
      status: activeStatus || undefined,
      search: searchQuery || undefined,
      // include other filter state already used by the page
    };
    const { blob, filename } = await exportPnmsPptx(filters);
    triggerBlobDownload(blob, filename);
    toast.success("Deck ready", { id: tid });
  } catch (e: any) {
    toast.error(e?.message || "Export failed", { id: tid });
  } finally {
    setExporting(false);
  }
}

// JSX, alongside existing toolbar buttons:
<button
  onClick={handleExportPptx}
  disabled={exporting || visibleCount === 0}
  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg hover:bg-surface-muted disabled:opacity-50"
>
  {exporting ? "Building…" : "Export → PowerPoint"}
</button>
```

Replace `activeStatus`, `searchQuery`, and `visibleCount` with whatever variables already exist on the page for filter state and the displayed PNM count. Do not add new filter state — wire the button to what the page already has.

- [ ] **Step 2: Smoke**

Run backend + frontend. Load `/pnms` as an admin, click the button. Expect a `.pptx` to download.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(dashboard)/pnms/page.tsx
git commit -m "feat(ui): PPTX export button on PNM list"
```

---

## Task 9: Frontend — Surface on /exports too

**Files:**
- Modify: `frontend/app/(dashboard)/exports/page.tsx`

- [ ] **Step 1: Add export card**

Wherever the existing export options live on the page, add a new card or row:

```tsx
"use client";

import { useState } from "react";
import { exportPnmsPptx, triggerBlobDownload } from "@/lib/api";
import { toast } from "sonner";

// inside the page component:
const [exporting, setExporting] = useState(false);

async function exportAll() {
  setExporting(true);
  const tid = toast.loading("Building your deck…");
  try {
    const { blob, filename } = await exportPnmsPptx({});
    triggerBlobDownload(blob, filename);
    toast.success("Deck ready", { id: tid });
  } catch (e: any) {
    toast.error(e?.message || "Export failed", { id: tid });
  } finally {
    setExporting(false);
  }
}

// in JSX:
<section className="rounded-2xl border border-border bg-surface p-6">
  <h3 className="font-serif text-xl text-fg">PNM Slideshow (PowerPoint)</h3>
  <p className="mt-1 text-sm text-muted">
    One slide per PNM with photo, info, votes, and the latest chapter note.
    Opens in PowerPoint, Keynote, or Google Slides.
  </p>
  <button
    onClick={exportAll}
    disabled={exporting}
    className="mt-4 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg disabled:opacity-50"
  >
    {exporting ? "Building…" : "Download .pptx"}
  </button>
</section>
```

- [ ] **Step 2: Smoke + commit**

```bash
git add frontend/app/(dashboard)/exports/page.tsx
git commit -m "feat(ui): PPTX export card on /exports page"
```

---

## Task 10: Performance + verification

- [ ] **Step 1: Backend full test pass**

Run: `cd python_server && pytest -v`
Expected: all PASS.

- [ ] **Step 2: Perf check with seed data**

Seed your local DB with 50 PNMs (each with a photo). Run:

```bash
time curl -X POST http://localhost:8000/api/v1/pnms/export/pptx \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"filters":{}}' -o /tmp/out.pptx
```

Expected: completes in <8s. File opens in Keynote/PowerPoint and renders the design.

If >30s, stop and flag for follow-up (background-job pattern per spec §6.6). Don't ship.

- [ ] **Step 3: Manual visual check**

Open `/tmp/out.pptx` in Keynote and PowerPoint Online. Confirm:
- Cover slide shows chapter name + date + count.
- PNM slides show photo on left, info on right, accent bar across top.
- With `theme.enabled = true` and accent `#0033A0`, the accent bar is navy.
- Missing photos render an initials avatar.
- Section dividers appear when PNMs span multiple statuses.

- [ ] **Step 4: Frontend full pass**

Run: `cd frontend && npm run typecheck && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: End-to-end**

Through the UI: filter PNMs on `/pnms`, click Export → PowerPoint, file downloads with filter respected.

- [ ] **Step 6: Final commit if cleanup needed**

```bash
git status
# commit pending cleanup
```

---

## Self-Review

- ✅ Spec § 6.1 Dependencies — Task 1.
- ✅ Spec § 6.2 New module structure — Task 2.
- ✅ Spec § 6.3 Endpoint (auth, body, response, rate limit, caps) — Task 6.
- ✅ Spec § 6.4 Deck design (cover, dividers, PNM slide layout, closing, accent) — Tasks 2, 3, 4.
- ✅ Spec § 6.5 Frontend wiring (button on /pnms and /exports) — Tasks 8, 9.
- ✅ Spec § 6.6 Performance target — Task 10.
- ✅ Spec § 6.7 Tests — covered across Tasks 2–6.

No placeholders. Types consistent (`PnmSlideData`, `SlideshowService.build_pnm_deck`, `exportPnmsPptx`, `triggerBlobDownload`). Filter shape consistent with backend `ExportPptxRequest`.
