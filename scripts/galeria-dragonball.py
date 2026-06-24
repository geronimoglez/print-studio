# Galería visual de Dragon Ball para revisar/palomear: (a) carpeta plana con 1 imagen por personaje,
# (b) 4 hojas de contacto (por tier de tamaño/precio) para escanear los ~195 de un vistazo.
# Lee las imágenes extraídas en pack-dragonball-img/_stage/ + tamaños de pack-mallas/_dragonball.tsv.
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join("..", "pack-dragonball-img")
STAGE = os.path.join(BASE, "_stage", "DRAGON BALL")
FLAT = os.path.join(BASE, "imagenes")
TSV = os.path.join("..", "pack-mallas", "_dragonball.tsv")
EXT = (".jpg", ".jpeg", ".png", ".webp")

size = {}
for ln in open(TSV, encoding="utf-8"):
    parts = ln.rstrip("\n").split("\t")
    if len(parts) == 2:
        size[parts[1].strip()] = int(parts[0] or 0)

def tier(mb):
    return "XL" if mb > 500 else "G" if mb >= 200 else "M" if mb >= 50 else "C"

def first_img(d):
    for f in sorted(os.listdir(d)):
        if f.lower().endswith(EXT):
            return os.path.join(d, f)
    return None

try:
    font = ImageFont.truetype("arial.ttf", 13)
except Exception:
    font = ImageFont.load_default()

# 1) recolectar 1 imagen por personaje
chars = {}
for name in sorted(os.listdir(STAGE)):
    d = os.path.join(STAGE, name)
    if os.path.isdir(d):
        img = first_img(d)
        if img:
            chars[name] = img
print(f"personajes con imagen: {len(chars)}")

# 2) carpeta plana nombrada (para que Blas la explore en su PC)
os.makedirs(FLAT, exist_ok=True)
for name, img in chars.items():
    try:
        im = Image.open(img).convert("RGB")
        im.thumbnail((500, 500))
        im.save(os.path.join(FLAT, name.replace("/", "-") + ".jpg"), "JPEG", quality=86)
    except Exception:
        pass

# 3) hojas de contacto por tier
TIERS = [("XL", "XL · gigantes (~$1.5-3.5k)"), ("G", "Grande (~$700-1.5k)"),
         ("M", "Mediano (~$350-700)"), ("C", "Chico/busto (~$150-350)")]
cols, cell, pad = 6, 195, 26
hechas = []
for key, label in TIERS:
    items = sorted([n for n in chars if tier(size.get(n, 0)) == key], key=lambda n: -size.get(n, 0))
    if not items:
        continue
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + pad) + 34
    canvas = Image.new("RGB", (W, H), (245, 245, 248))
    d = ImageDraw.Draw(canvas)
    d.text((8, 8), f"DRAGON BALL — {label}  ·  {len(items)} modelos", fill=(15, 15, 15), font=font)
    for i, n in enumerate(items):
        try:
            im = Image.open(chars[n]).convert("RGB")
            im.thumbnail((cell - 10, cell - 10))
            x, y = (i % cols) * cell, 34 + (i // cols) * (cell + pad)
            canvas.paste(im, (x + 5, y + 5))
            d.text((x + 5, y + cell - 1), f"{n[:26]} ({size.get(n,0)}MB)", fill=(20, 20, 20), font=font)
        except Exception:
            pass
    out = os.path.join(BASE, f"contacto-{key}.jpg")
    canvas.save(out, "JPEG", quality=84)
    hechas.append(out)
    print(f"  ok hoja {key}: {len(items)} modelos -> {out}")

print(f"\n>>> carpeta: {FLAT} ({len(os.listdir(FLAT))} imgs) | hojas: {len(hechas)}")
