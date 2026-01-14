"""
Pillow-based composition utilities for RushRank PNM share cards

Instagram portrait spec: 1080x1350 (4:5 ratio)
Modern IG Card Layout:
  - Full-bleed photo background (or gradient + initials if no photo)
  - Bottom gradient overlay (black 70% → transparent)
  - Bottom-left text block: Name + info chips + fun fact
  - Bottom-right branding watermark
"""
from __future__ import annotations

from io import BytesIO
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageOps
import httpx

# Canvas dimensions (Instagram portrait 4:5)
W, H = 1080, 1350

# Safe margins
SAFE_LEFT = 64
SAFE_RIGHT = 64
SAFE_BOTTOM = 64

# Colors
WHITE = (255, 255, 255)
WHITE_DIM = (255, 255, 255, int(255 * 0.25))  # 25% for branding
CHIP_BG = (0, 0, 0, int(255 * 0.35))  # 35% black for chips


def _try_load_font(path: str, size: int) -> Optional[ImageFont.FreeTypeFont]:
    """Try to load a TrueType font from the given path."""
    try:
        return ImageFont.truetype(path, size=size)
    except Exception:
        return None


def _load_fonts() -> Tuple[
    ImageFont.FreeTypeFont,  # name_font (72px bold)
    ImageFont.FreeTypeFont,  # chip_font (32px semibold)
    ImageFont.FreeTypeFont,  # fun_fact_font (28px regular)
    ImageFont.FreeTypeFont,  # brand_font (24px semibold)
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
    
    def first_available(paths: List[str], size: int) -> ImageFont.FreeTypeFont:
        for p in paths:
            f = _try_load_font(p, size)
            if f is not None:
                return f
        return ImageFont.load_default()
    
    name_font = first_available(bold_paths, 72)
    chip_font = first_available(semibold_paths, 32)
    fun_fact_font = first_available(regular_paths, 28)
    brand_font = first_available(semibold_paths, 24)
    
    return name_font, chip_font, fun_fact_font, brand_font


def _cover_crop(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Crop image to fill target dimensions (cover behavior, top-center crop to preserve faces)."""
    return ImageOps.fit(image, (target_w, target_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.3))


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


def _draw_gradient_overlay(canvas: Image.Image, start_opacity: float = 0.70, 
                           gradient_height_ratio: float = 0.45) -> Image.Image:
    """Draw a bottom-to-top gradient overlay for text readability.
    
    Args:
        canvas: The image to overlay
        start_opacity: Opacity at the bottom (0-1)
        gradient_height_ratio: What fraction of the image height the gradient covers
    """
    gradient = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    
    gradient_start_y = int(H * (1 - gradient_height_ratio))  # Where gradient begins (top of gradient zone)
    
    for y in range(gradient_start_y, H):
        # Progress from 0 (top of gradient) to 1 (bottom)
        progress = (y - gradient_start_y) / (H - gradient_start_y)
        # Ease in - start subtle, get darker faster
        alpha = int(255 * start_opacity * (progress ** 1.5))
        gradient_draw.line([(0, y), (W, y)], fill=(0, 0, 0, alpha))
    
    # Composite gradient onto canvas
    if canvas.mode != "RGBA":
        canvas = canvas.convert("RGBA")
    return Image.alpha_composite(canvas, gradient)


def _draw_chip(img: Image.Image, draw: ImageDraw.ImageDraw, text: str, 
               font: ImageFont.FreeTypeFont, x: int, y: int) -> Tuple[int, int]:
    """Draw an info chip (pill) and return (width, height).
    
    Args:
        img: Image to draw on (RGBA mode)
        draw: ImageDraw object
        text: Text to display in chip
        font: Font to use
        x: X position
        y: Y position
    
    Returns:
        Tuple of (chip_width, chip_height)
    """
    padding_h = 18
    padding_v = 10
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    chip_w = text_w + padding_h * 2
    chip_h = text_h + padding_v * 2
    radius = chip_h // 2  # Fully rounded
    
    # Create chip with alpha
    chip_img = Image.new("RGBA", (chip_w, chip_h), (0, 0, 0, 0))
    chip_draw = ImageDraw.Draw(chip_img)
    
    # Draw rounded rectangle
    chip_draw.rounded_rectangle(
        [(0, 0), (chip_w - 1, chip_h - 1)],
        radius=radius,
        fill=CHIP_BG,
    )
    
    # Draw text (centered in chip)
    text_x = padding_h
    text_y = padding_v - 2  # Small adjustment for visual centering
    chip_draw.text((text_x, text_y), text, font=font, fill=WHITE)
    
    # Composite onto main image
    img.paste(chip_img, (x, y), chip_img)
    
    return chip_w, chip_h


def _truncate_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, 
                   max_width: int) -> str:
    """Truncate text with ellipsis if it exceeds max_width."""
    bbox = draw.textbbox((0, 0), text, font=font)
    if bbox[2] - bbox[0] <= max_width:
        return text
    
    while len(text) > 1:
        text = text[:-1]
        test_text = text.rstrip() + "…"
        bbox = draw.textbbox((0, 0), test_text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return test_text
    
    return "…"


async def compose_pnm_card(
    name: str,
    hometown: Optional[str],
    major: Optional[str],
    year: Optional[str],
    fun_fact: Optional[str],
    photo_url: Optional[str],
    tags: Optional[List[str]] = None,
    brand_text: str = "RushApp",
) -> bytes:
    """Generate a 4:5 ratio PNM card image (Modern IG Card layout).
    
    Layout:
      - Full-bleed photo background (or gradient + initials if no photo)
      - Bottom gradient overlay for text readability
      - Bottom-left: Name (large) + info chips + fun fact
      - Bottom-right: Brand watermark
    
    Args:
        name: PNM full name
        hometown: Hometown (optional)
        major: Major (optional)
        year: Year (optional)
        fun_fact: Fun fact text (optional)
        photo_url: URL to PNM photo (optional)
        tags: List of tag labels (optional, not displayed in this layout)
        brand_text: Brand text for watermark (default: "RushApp")
    
    Returns:
        PNG image bytes
    """
    # Load fonts
    name_font, chip_font, fun_fact_font, brand_font = _load_fonts()
    
    # Create base canvas
    canvas = Image.new("RGBA", (W, H), (30, 30, 30, 255))
    
    # =========================================================================
    # 1) BACKGROUND - Load photo or create fallback
    # =========================================================================
    photo: Optional[Image.Image] = None
    if photo_url:
        photo = await _load_remote_image(photo_url)
    
    if photo is not None:
        # Cover crop to fill entire canvas (top-center to preserve faces)
        photo_cropped = _cover_crop(photo, W, H)
        canvas.paste(photo_cropped, (0, 0))
    else:
        # Fallback: tasteful dark gradient background with initials
        for y_pos in range(H):
            ratio = y_pos / H
            # Slate gradient (dark blue-gray tones)
            r = int(30 + (45 - 30) * ratio)
            g = int(35 + (50 - 35) * ratio)
            b = int(45 + (60 - 45) * ratio)
            for x_pos in range(W):
                canvas.putpixel((x_pos, y_pos), (r, g, b, 255))
        
        # Draw large initials in center
        initials = "".join(word[0].upper() for word in name.split()[:2]) if name else "?"
        # Create a larger font for initials (150px)
        init_font = name_font
        font_path = getattr(name_font, 'path', None)
        if font_path:
            try:
                init_font = ImageFont.truetype(font_path, 150)
            except Exception:
                pass
        
        temp_draw = ImageDraw.Draw(canvas)
        init_bbox = temp_draw.textbbox((0, 0), initials, font=init_font)
        init_w = init_bbox[2] - init_bbox[0]
        init_h = init_bbox[3] - init_bbox[1]
        init_x = (W - init_w) // 2
        init_y = (H - init_h) // 2 - 100  # Slightly above center to make room for text
        temp_draw.text((init_x, init_y), initials, font=init_font, fill=(80, 85, 95, 255))
    
    # =========================================================================
    # 2) BOTTOM GRADIENT OVERLAY
    # =========================================================================
    canvas = _draw_gradient_overlay(canvas, start_opacity=0.75, gradient_height_ratio=0.50)
    
    # =========================================================================
    # 3) TEXT BLOCK - Bottom left
    # =========================================================================
    draw = ImageDraw.Draw(canvas)
    
    # Calculate content area
    content_x = SAFE_LEFT
    max_content_width = W - SAFE_LEFT - SAFE_RIGHT - 100  # Leave room for branding
    
    # Start from bottom and work up
    current_y = H - SAFE_BOTTOM
    
    # Fun fact (if present) - draw first (bottommost)
    if fun_fact and fun_fact.strip():
        # Truncate if too long
        display_fact = _truncate_text(draw, fun_fact, fun_fact_font, max_content_width)
        bbox = draw.textbbox((0, 0), display_fact, font=fun_fact_font)
        fact_h = bbox[3] - bbox[1]
        current_y -= fact_h
        draw.text((content_x, current_y), display_fact, font=fun_fact_font, fill=WHITE)
        current_y -= 16  # Gap above fun fact
    
    # Info chips row (Major, Year, Hometown)
    chips_data = []
    if major and major.strip():
        chips_data.append(major.strip())
    if year and year.strip():
        chips_data.append(year.strip())
    if hometown and hometown.strip():
        chips_data.append(hometown.strip())
    
    if chips_data:
        # Calculate chip layout (may need to wrap)
        chip_gap = 12
        chip_rows: List[List[Tuple[str, int]]] = []  # List of rows, each containing (text, width)
        current_row: List[Tuple[str, int]] = []
        current_row_width = 0
        
        for chip_text in chips_data:
            bbox = draw.textbbox((0, 0), chip_text, font=chip_font)
            chip_w = (bbox[2] - bbox[0]) + 36  # +36 for padding
            
            if current_row and (current_row_width + chip_gap + chip_w > max_content_width):
                # Start new row
                chip_rows.append(current_row)
                current_row = [(chip_text, chip_w)]
                current_row_width = chip_w
            else:
                if current_row:
                    current_row_width += chip_gap
                current_row.append((chip_text, chip_w))
                current_row_width += chip_w
        
        if current_row:
            chip_rows.append(current_row)
        
        # Draw chips from bottom to top
        chip_height = 52  # Approximate chip height
        for row in reversed(chip_rows):
            current_y -= chip_height
            chip_x = content_x
            for chip_text, chip_w in row:
                _draw_chip(canvas, draw, chip_text, chip_font, chip_x, current_y)
                chip_x += chip_w + chip_gap
            current_y -= 8  # Gap between rows
        
        # Recreate draw after chip compositing
        draw = ImageDraw.Draw(canvas)
        current_y -= 8  # Extra gap above chips
    
    # Name (large, bold) - topmost text element
    display_name, adjusted_name_font = _fit_text_to_width(
        draw, name, name_font, max_content_width, min_size=48
    )
    name_bbox = draw.textbbox((0, 0), display_name, font=adjusted_name_font)
    name_h = name_bbox[3] - name_bbox[1]
    current_y -= name_h
    draw.text((content_x, current_y), display_name, font=adjusted_name_font, fill=WHITE)
    
    # =========================================================================
    # 4) BRANDING WATERMARK - Bottom right
    # =========================================================================
    if brand_text:
        # Create semi-transparent text
        brand_bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
        brand_w = brand_bbox[2] - brand_bbox[0]
        brand_h = brand_bbox[3] - brand_bbox[1]
        brand_x = W - SAFE_RIGHT - brand_w
        brand_y = H - SAFE_BOTTOM - brand_h
        
        # Draw with low opacity
        brand_layer = Image.new("RGBA", (brand_w + 10, brand_h + 10), (0, 0, 0, 0))
        brand_draw = ImageDraw.Draw(brand_layer)
        brand_draw.text((0, 0), brand_text, font=brand_font, fill=WHITE_DIM)
        canvas.paste(brand_layer, (brand_x, brand_y), brand_layer)
    
    # =========================================================================
    # 5) EXPORT AS PNG
    # =========================================================================
    # Ensure RGB mode for PNG export (remove alpha channel)
    if canvas.mode == "RGBA":
        # Create white background and composite
        rgb_canvas = Image.new("RGB", canvas.size, (0, 0, 0))
        rgb_canvas.paste(canvas, mask=canvas.split()[3] if len(canvas.split()) == 4 else None)
        canvas = rgb_canvas
    
    out = BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue()
