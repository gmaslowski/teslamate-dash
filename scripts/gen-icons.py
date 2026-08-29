#!/usr/bin/env python3
"""Generate PWA icons for TeslaMate Dash: dark bg + map pin."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "web", "public")
os.makedirs(OUT, exist_ok=True)

BG = (17, 19, 24)        # #111318 (dash bg)
PIN = (79, 107, 192)     # #4f6bc0 (drive blue)
PIN_DARK = (125, 155, 240)  # #7d9bf0
DOT = (233, 234, 238)    # #e9eaee (text)


def draw_pin(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    # safety zone for maskable: content within 80%
    content = size * (0.72 if maskable else 0.9)
    cx, cy = size / 2, size * (0.48 if maskable else 0.5)
    r = content / 2
    # pin head (circle)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PIN)
    # pin tip (triangle)
    tip = min(size * (0.62 if maskable else 0.8), cy + r * 0.7)
    d.polygon([(cx - r * 0.55, cy + r * 0.45), (cx + r * 0.55, cy + r * 0.45), (cx, tip)], fill=PIN)
    # inner dot
    dr = r * 0.42
    d.ellipse([cx - dr, cy - dr, cx + dr, cy + dr], fill=DOT)
    return img


sizes = {"icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180}
for name, s in sizes.items():
    draw_pin(s).save(os.path.join(OUT, name), "PNG")
    print(f"{name}: {s}x{s}")

draw_pin(512, maskable=True).save(os.path.join(OUT, "maskable-512.png"), "PNG")
print("maskable-512.png: 512x512 (maskable)")
