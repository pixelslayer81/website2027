# Page 06: turns the full-size composition renders (3840/5504 px PNGs, up to
# 18 MB each) in this folder into web JPGs under comps/: a 1920 px large and a
# 640 px thumb per image, named by colour column (the render's background):
#   royal / navy / teal / white / gray  ->  comps/<column>-NN.jpg, -NN-thumb.jpg
# and prints the JS manifest for sketch.js (COMP.images).
# Run from the repo root:  python -I pages/06-azure-retexture/assets/make-comps.py
import os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "comps")
# column background colours (the grid's column fills), matched by nearest RGB
COLUMNS = {
    "royal": (0x0b, 0x0c, 0xc6),
    "navy": (0x0c, 0x03, 0x5c),
    "teal": (0x1c, 0x3e, 0x3c),
    "white": (0xf8, 0xf8, 0xfa),
    "gray": (0xd8, 0xda, 0xdb),
}

def edge_colour(im):
    sm = im.convert("RGB").resize((32, 32))
    px = [sm.getpixel((x, 0)) for x in range(32)] + [sm.getpixel((0, y)) for y in range(32)]
    return tuple(sum(c[k] for c in px) / len(px) for k in range(3))

def column_for(rgb):
    return min(COLUMNS, key=lambda k: sum((a - b) ** 2 for a, b in zip(rgb, COLUMNS[k])))

def label_for(name):
    m = re.search(r"material_in__+([A-Za-z0-9]+)", name)
    if m:
        return m.group(1)
    return "Base render"

os.makedirs(OUT, exist_ok=True)
files = sorted(f for f in os.listdir(HERE) if f.lower().endswith(".png"))
counts = {k: 0 for k in COLUMNS}
manifest = {k: [] for k in COLUMNS}
for f in files:
    im = Image.open(os.path.join(HERE, f)).convert("RGB")
    col = column_for(edge_colour(im))
    counts[col] += 1
    stem = f"{col}-{counts[col]:02d}"
    im.resize((1920, round(1920 * im.height / im.width)), Image.LANCZOS).save(os.path.join(OUT, stem + ".jpg"), quality=85, optimize=True, progressive=True)
    im.resize((640, round(640 * im.height / im.width)), Image.LANCZOS).save(os.path.join(OUT, stem + "-thumb.jpg"), quality=82, optimize=True, progressive=True)
    manifest[col].append((stem, label_for(f), f))
    print(f"{stem:10s} <- {f}", file=sys.stderr)

print("  images: {")
for col, items in manifest.items():
    print(f"    {col}: [")
    for stem, label, _ in items:
        print(f'      {{ id: "{stem}", label: "{label}" }},')
    print("    ],")
print("  },")
