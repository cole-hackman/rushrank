"""
Pillow-based composition utilities for RushRank PNM share cards

Instagram portrait spec: 1080x1350 (4:5 ratio)
Template C Layout:
  - Top Header Strip (170px): Name bar with dark overlay
  - Middle Photo Zone: Full-bleed photo with center crop
  - Bottom Footer Strip (170px): Details, fun fact, tags
"""
from __future__ import annotations

from io import BytesIO
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import httpx

# Canvas dimensions (Instagram portrait 4:5)
W, H = 1080, 1350

# Template C zone heights
HEADER_H = 170
FOOTER_H = 170  # Same as header
PHOTO_H = H - HEADER_H - FOOTER_H  # 1010px

# Safe margins
SAFE_LEFT = 64
SAFE_RIGHT = 64
SAFE_TOP = 48
SAFE_BOTTOM = 48

# Colors
OVERLAY_COLOR = (1, 48, 104)  # Beta navy #013068
OVERLAY_ALPHA = int(255 * 0.65)  # 65% opacity
WHITE = (255, 255, 255)
WHITE_SUBTLE = (255, 255, 255, int(255 * 0.5))  # 50% for branding
CHIP_FILL_ALPHA = int(255 * 0.12)  # 12% white fill for chips
CHIP_BORDER_ALPHA = int(255 * 0.18)  # 18% white border


def _try_load_font(path: str, size: int) -> Optional[ImageFont.FreeTypeFont]:
    """Try to load a TrueType font from the given path."""
    try:
        return ImageFont.truetype(path, size=size)
    except Exception:
        return None


def _load_fonts() -> Tuple[
    ImageFont.FreeTypeFont,  # name_font (72px bold)
    ImageFont.FreeTypeFont,  # major_year_font (36px semibold)
    ImageFont.FreeTypeFont,  # hometown_font (32px regular)
    ImageFont.FreeTypeFont,  # fun_fact_font (30px italic or regular)
    ImageFont.FreeTypeFont,  # tag_font (24px)
    ImageFont.FreeTypeFont,  # brand_font (24px)
]:
    """Load fonts with graceful fallbacks."""
    
    # Font search paths
    bold_paths = [
        "python_server/assets/fonts/Inter-Bold.ttf",
        "assets/fonts/Inter-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    semibold_paths = [
        "python_server/assets/fonts/Inter-SemiBold.ttf",
        "assets/fonts/Inter-SemiBold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    regular_paths = [
        "python_server/assets/fonts/Inter-Regular.ttf",
        "assets/fonts/Inter-Regular.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    italic_paths = [
        "python_server/assets/fonts/Inter-Italic.ttf",
        "assets/fonts/Inter-Italic.ttf",
        "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        "/Library/Fonts/Arial Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    ]
    
    def first_available(paths: List[str], size: int) -> ImageFont.FreeTypeFont:
        for p in paths:
            f = _try_load_font(p, size)
            if f is not None:
                return f
        return ImageFont.load_default()
    
    name_font = first_available(bold_paths, 72)
    major_year_font = first_available(semibold_paths, 36)
    hometown_font = first_available(regular_paths, 32)
    fun_fact_font = first_available(italic_paths, 30)
    tag_font = first_available(semibold_paths, 24)
    brand_font = first_available(semibold_paths, 24)
    
    return name_font, major_year_font, hometown_font, fun_fact_font, tag_font, brand_font


def _cover_crop(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Crop image to fill target dimensions (cover behavior, center crop)."""
    return ImageOps.fit(image, (target_w, target_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.4))


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int, max_lines: int = 2) -> List[str]:
    """Wrap text to fit within max_width, limiting to max_lines with ellipsis if needed."""
    if not text:
        return []
    
    words = text.split()
    if not words:
        return []
    
    lines: List[str] = []
    current_line = ""
    
    for word in words:
        test_line = f"{current_line} {word}".strip() if current_line else word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        line_width = bbox[2] - bbox[0]
        
        if line_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
            
            # Check if we've hit max lines
            if len(lines) >= max_lines:
                break
    
    if current_line and len(lines) < max_lines:
        lines.append(current_line)
    
    # Add ellipsis if we truncated
    if len(lines) == max_lines:
        # Check if there's more content
        joined = " ".join(lines)
        if len(joined) < len(text):
            # Truncate last line and add ellipsis
            last_line = lines[-1]
            while last_line:
                test = last_line + "…"
                bbox = draw.textbbox((0, 0), test, font=font)
                if bbox[2] - bbox[0] <= max_width:
                    lines[-1] = test
                    break
                last_line = last_line[:-1].rstrip()
                if not last_line:
                    lines[-1] = "…"
                    break
    
    return lines


def _fit_text_to_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, 
                       max_width: int, min_size: int = 48) -> Tuple[str, ImageFont.FreeTypeFont]:
    """Scale down font size to fit text in max_width, or truncate if still too large."""
    current_size = getattr(font, 'size', 72) if hasattr(font, 'size') else 72
    current_font = font
    
    # Try to get font path for resizing
    font_path = getattr(font, 'path', None)
    
    while current_size >= min_size:
        bbox = draw.textbbox((0, 0), text, font=current_font)
        text_width = bbox[2] - bbox[0]
        
        if text_width <= max_width:
            return text, current_font
        
        # Reduce font size
        current_size -= 4
        if font_path:
            try:
                current_font = ImageFont.truetype(font_path, current_size)
            except Exception:
                break
        else:
            break
    
    # If still too wide, truncate with ellipsis
    while len(text) > 1:
        text = text[:-1]
        test_text = text.rstrip() + "…"
        bbox = draw.textbbox((0, 0), test_text, font=current_font)
        if bbox[2] - bbox[0] <= max_width:
            return test_text, current_font
    
    return "…", current_font


async def _load_remote_image(url: str) -> Optional[Image.Image]:
    """Load an image from a remote URL."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            img = Image.open(BytesIO(resp.content)).convert("RGB")
            return img
    except Exception:
        return None


def _draw_rounded_rect(draw: ImageDraw.ImageDraw, xy: Tuple[int, int, int, int], 
                       radius: int, fill: Optional[Tuple] = None, 
                       outline: Optional[Tuple] = None, width: int = 1):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def _draw_chip(img: Image.Image, text: str, font: ImageFont.FreeTypeFont, 
               x: int, y: int, padding_h: int = 16, padding_v: int = 10) -> int:
    """Draw a tag chip and return its width."""
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    chip_w = text_w + padding_h * 2
    chip_h = text_h + padding_v * 2
    radius = chip_h // 2  # Fully rounded
    
    # Create chip with alpha
    chip_img = Image.new("RGBA", (chip_w, chip_h), (0, 0, 0, 0))
    chip_draw = ImageDraw.Draw(chip_img)
    
    # Fill with subtle white
    fill_color = (255, 255, 255, CHIP_FILL_ALPHA)
    border_color = (255, 255, 255, CHIP_BORDER_ALPHA)
    
    chip_draw.rounded_rectangle(
        [(0, 0), (chip_w - 1, chip_h - 1)],
        radius=radius,
        fill=fill_color,
        outline=border_color,
        width=1
    )
    
    # Draw text
    text_x = padding_h
    text_y = padding_v - 2  # Small adjustment for visual centering
    chip_draw.text((text_x, text_y), text, font=font, fill=WHITE)
    
    # Composite onto main image
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    img.paste(chip_img, (x, y), chip_img)
    
    return chip_w


async def compose_pnm_card(
    name: str,
    hometown: Optional[str],
    major: Optional[str],
    year: Optional[str],
    fun_fact: Optional[str],
    photo_url: Optional[str],
    tags: Optional[List[str]] = None,
    brand_text: str = "RushRank",
) -> bytes:
    """Generate a 4:5 ratio PNM card image (Template C layout).
    
    Layout:
      - Top Header (170px): Name with dark overlay
      - Middle Photo Zone: Full-bleed photo
      - Bottom Footer (320px): Details, fun fact, tags, branding
    
    Args:
        name: PNM full name
        hometown: Hometown (optional)
        major: Major (optional)
        year: Year (optional)
        fun_fact: Fun fact text (optional)
        photo_url: URL to PNM photo (optional)
        tags: List of tag labels (optional)
        brand_text: Brand text for footer (default: "RushRank")
    
    Returns:
        JPEG image bytes
    """
    # Load fonts
    name_font, major_year_font, hometown_font, fun_fact_font, tag_font, brand_font = _load_fonts()
    
    # Create base canvas
    canvas = Image.new("RGBA", (W, H), (30, 30, 30, 255))
    
    # =========================================================================
    # B) MIDDLE PHOTO ZONE - Load and place photo first
    # =========================================================================
    photo: Optional[Image.Image] = None
    if photo_url:
        photo = await _load_remote_image(photo_url)
    
    if photo is not None:
        # Cover crop to fill entire canvas
        photo_cropped = _cover_crop(photo, W, H)
        canvas.paste(photo_cropped, (0, 0))
    else:
        # Placeholder gradient
        for y_pos in range(H):
            ratio = y_pos / H
            gray = int(40 + (80 - 40) * ratio)
            for x_pos in range(W):
                canvas.putpixel((x_pos, y_pos), (gray, gray, gray, 255))
        
        # Draw initials in center
        initials = "".join(word[0].upper() for word in name.split()[:2]) if name else "?"
        temp_draw = ImageDraw.Draw(canvas)
        init_bbox = temp_draw.textbbox((0, 0), initials, font=name_font)
        init_w = init_bbox[2] - init_bbox[0]
        init_h = init_bbox[3] - init_bbox[1]
        init_x = (W - init_w) // 2
        init_y = (H - init_h) // 2
        temp_draw.text((init_x, init_y), initials, font=name_font, fill=(100, 100, 100, 255))
    
    # =========================================================================
    # A) TOP HEADER STRIP - Dark overlay with name
    # =========================================================================
    header_overlay = Image.new("RGBA", (W, HEADER_H), (*OVERLAY_COLOR, OVERLAY_ALPHA))
    canvas.paste(header_overlay, (0, 0), header_overlay)
    
    draw = ImageDraw.Draw(canvas)
    
    # Draw name (left-aligned, with safe margins)
    max_name_width = W - SAFE_LEFT - SAFE_RIGHT
    display_name, adjusted_font = _fit_text_to_width(draw, name, name_font, max_name_width, min_size=48)
    
    # Vertical centering in header
    name_bbox = draw.textbbox((0, 0), display_name, font=adjusted_font)
    name_h = name_bbox[3] - name_bbox[1]
    name_y = (HEADER_H - name_h) // 2
    
    draw.text((SAFE_LEFT, name_y), display_name, font=adjusted_font, fill=WHITE)
    
    # =========================================================================
    # C) BOTTOM FOOTER STRIP - Details, fun fact, tags, branding
    # =========================================================================
    footer_top = H - FOOTER_H
    footer_overlay = Image.new("RGBA", (W, FOOTER_H), (*OVERLAY_COLOR, OVERLAY_ALPHA))
    canvas.paste(footer_overlay, (0, footer_top), footer_overlay)
    
    # Recreate draw after paste
    draw = ImageDraw.Draw(canvas)
    
    # Content positioning within footer
    content_x = SAFE_LEFT
    content_y = footer_top + 20  # Reduced from SAFE_TOP (48) to fit in 170px height
    max_content_width = W - SAFE_LEFT - SAFE_RIGHT
    line_spacing = 8  # Reduced from 12
    
    # Line 1: Major • Year
    major_year_parts = []
    if major:
        major_year_parts.append(major)
    if year:
        major_year_parts.append(year)
    
    if major_year_parts:
        major_year_text = " • ".join(major_year_parts)
        draw.text((content_x, content_y), major_year_text, font=major_year_font, fill=WHITE)
        bbox = draw.textbbox((0, 0), major_year_text, font=major_year_font)
        content_y += (bbox[3] - bbox[1]) + line_spacing
    
    # Line 2: Hometown
    if hometown:
        draw.text((content_x, content_y), hometown, font=hometown_font, fill=WHITE)
        bbox = draw.textbbox((0, 0), hometown, font=hometown_font)
        content_y += (bbox[3] - bbox[1]) + line_spacing
    
    # Line 3-4: Fun fact (max 2 lines with quote marks)
    if fun_fact:
        # Add quote styling
        quoted_fact = f'"{fun_fact}"'
        fun_fact_lines = _wrap_text(draw, quoted_fact, fun_fact_font, max_content_width, max_lines=2)
        
        for line in fun_fact_lines:
            draw.text((content_x, content_y), line, font=fun_fact_font, fill=WHITE)
            bbox = draw.textbbox((0, 0), line, font=fun_fact_font)
            content_y += (bbox[3] - bbox[1]) + 6
        
        content_y += line_spacing - 6
    
    # Tags row - chips with wrapping (max 2 rows)
    if tags and len(tags) > 0:
        content_y += 8  # Extra spacing before tags
        chip_gap = 10
        chip_x = content_x
        chip_y = content_y
        row_height = 44  # Approximate chip height
        tags_shown = 0
        max_tags_per_row = 4
        rows_used = 0
        max_rows = 2
        remaining_tags = 0
        
        for i, tag in enumerate(tags):
            if rows_used >= max_rows:
                remaining_tags = len(tags) - i
                break
            
            # Measure chip
            bbox = draw.textbbox((0, 0), tag, font=tag_font)
            chip_w = (bbox[2] - bbox[0]) + 32  # padding
            
            # Check if we need to wrap
            if chip_x + chip_w > W - SAFE_RIGHT:
                rows_used += 1
                if rows_used >= max_rows:
                    remaining_tags = len(tags) - i
                    break
                chip_x = content_x
                chip_y += row_height + chip_gap
            
            # Convert canvas to RGBA for chip compositing
            if canvas.mode != "RGBA":
                canvas = canvas.convert("RGBA")
            
            chip_w = _draw_chip(canvas, tag, tag_font, chip_x, chip_y)
            chip_x += chip_w + chip_gap
            tags_shown += 1
        
        # Show "+N" chip if there are more tags
        if remaining_tags > 0:
            plus_text = f"+{remaining_tags}"
            if chip_x + 60 > W - SAFE_RIGHT:
                # Would overflow, skip
                pass
            else:
                _draw_chip(canvas, plus_text, tag_font, chip_x, chip_y)
    
    # Recreate draw after potential mode changes
    draw = ImageDraw.Draw(canvas)
    
    # =========================================================================
    # Export as JPEG
    # =========================================================================
    # Convert to RGB for JPEG
    if canvas.mode == "RGBA":
        # Create white background
        rgb_canvas = Image.new("RGB", canvas.size, (0, 0, 0))
        rgb_canvas.paste(canvas, mask=canvas.split()[3] if len(canvas.split()) == 4 else None)
        canvas = rgb_canvas
    
    out = BytesIO()
    canvas.save(out, format="JPEG", quality=90, optimize=True)
    return out.getvalue()
