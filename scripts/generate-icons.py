import os
from PIL import Image, ImageDraw, ImageFont

public_dir = os.path.join(os.getcwd(), 'public')
os.makedirs(public_dir, exist_ok=True)

def create_pwa_icon(size):
    img = Image.new('RGBA', (size, size), (15, 23, 42, 255)) # #0f172a navy-950
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background
    corner_radius = int(size * 0.18)
    # Background is already filled, but let's give a subtle border or inner glow
    pad = int(size * 0.04)
    draw.rounded_rectangle(
        [(pad, pad), (size - pad, size - pad)],
        radius=corner_radius,
        outline=(56, 189, 248, 80), # sky-400 subtle outline
        width=max(2, int(size * 0.015))
    )

    # Draw Shield
    cx = size // 2
    top = int(size * 0.20)
    w = int(size * 0.28) # half width
    mid_y = int(size * 0.52)
    bottom_y = int(size * 0.78)

    # Shield polygon: top-left, top-right, right-mid, bottom-center, left-mid
    shield_pts = [
        (cx - w, top),
        (cx + w, top),
        (cx + w, mid_y),
        (cx, bottom_y),
        (cx - w, mid_y)
    ]
    draw.polygon(shield_pts, fill=(29, 68, 110, 255), outline=(56, 189, 248, 255))
    # Thicker shield outline
    draw.line([(cx - w, top), (cx + w, top), (cx + w, mid_y), (cx, bottom_y), (cx - w, mid_y), (cx - w, top)],
              fill=(56, 189, 248, 255), width=max(2, int(size * 0.02)))

    # Draw Rupee / Checkmark emblem inside shield
    # Let's draw a crisp white and cyan checkmark
    chk_start = (int(cx - w * 0.45), int(mid_y * 0.85))
    chk_mid = (int(cx - w * 0.05), int(bottom_y * 0.78))
    chk_end = (int(cx + w * 0.55), int(top * 1.6))

    chk_w = max(3, int(size * 0.05))
    draw.line([chk_start, chk_mid, chk_end], fill=(255, 255, 255, 255), width=chk_w, joint='curve')

    return img

# Generate 512x512
icon512 = create_pwa_icon(512)
icon512.save(os.path.join(public_dir, 'pwa-512x512.png'), format='PNG')
print("Generated pwa-512x512.png")

# Generate 192x192
icon192 = create_pwa_icon(192)
icon192.save(os.path.join(public_dir, 'pwa-192x192.png'), format='PNG')
print("Generated pwa-192x192.png")

# Generate apple-touch-icon.png (180x180)
icon180 = create_pwa_icon(180)
icon180.save(os.path.join(public_dir, 'apple-touch-icon.png'), format='PNG')
print("Generated apple-touch-icon.png")

# Generate favicon.ico (multi-size: 16, 32, 48, 64)
icon64 = create_pwa_icon(64)
icon32 = create_pwa_icon(32)
icon16 = create_pwa_icon(16)
icon64.save(os.path.join(public_dir, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("Generated favicon.ico")

# Generate vite.svg / favicon.svg
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="20" fill="#0f172a"/>
  <rect x="2" y="2" width="96" height="96" rx="18" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.3"/>
  <path d="M22 22 H78 V52 L50 78 L22 52 Z" fill="#1d446e" stroke="#38bdf8" stroke-width="3"/>
  <path d="M36 50 L46 62 L66 38" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

with open(os.path.join(public_dir, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)
with open(os.path.join(public_dir, 'vite.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)
print("Generated favicon.svg & vite.svg")

# Generate robots.txt
robots_txt = "User-agent: *\nAllow: /\n"
with open(os.path.join(public_dir, 'robots.txt'), 'w', encoding='utf-8') as f:
    f.write(robots_txt)
print("Generated robots.txt")
