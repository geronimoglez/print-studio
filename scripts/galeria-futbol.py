# Galería visual de FUTBOL agrupada por TIPO (llaveros, marcos de camiseta, chops, mundial, otros)
# para que Blas escanee y palomee. Imágenes en pack-futbol-img/_stage/, tamaños en pack-mallas/_futbol.tsv.
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join("..", "pack-futbol-img")
STAGE = os.path.join(BASE, "_stage", "FUTBOL")
FLAT = os.path.join(BASE, "imagenes")
TSV = os.path.join("..", "pack-mallas", "_futbol.tsv")
EXT = (".jpg", ".jpeg", ".png", ".webp")

size = {}
for ln in open(TSV, encoding="utf-8"):
    p = ln.rstrip("\n").split("\t")
    if len(p) == 2:
        size[p[1].strip()] = int(p[0] or 0)

def tipo(n):
    s = n.lower()
    if "llavero" in s: return ("1-Llaveros", "Llaveros (~$60-150)")
    if "marco" in s: return ("2-Marcos", "Marcos de camiseta (~$200-500)")
    if "chop" in s: return ("3-Chops", "Chops / tablas (~$150-350)")
    if "copa" in s or "mundial" in s: return ("4-Mundial", "Copa del Mundo (~$150-600)")
    return ("5-Otros", "Otros (figuras/varios)")

def first_img(d):
    for f in sorted(os.listdir(d)):
        if f.lower().endswith(EXT): return os.path.join(d, f)
    return None

try: font = ImageFont.truetype("arial.ttf", 13)
except Exception: font = ImageFont.load_default()

chars = {}
for name in sorted(os.listdir(STAGE)):
    d = os.path.join(STAGE, name)
    if os.path.isdir(d):
        img = first_img(d)
        if img: chars[name] = img
print(f"con imagen: {len(chars)}")

os.makedirs(FLAT, exist_ok=True)
for name, img in chars.items():
    try:
        im = Image.open(img).convert("RGB"); im.thumbnail((500, 500))
        im.save(os.path.join(FLAT, name.replace("/", "-") + ".jpg"), "JPEG", quality=86)
    except Exception: pass

grupos = {}
for n in chars:
    k, label = tipo(n)
    grupos.setdefault((k, label), []).append(n)

cols, cell, pad = 6, 195, 26
for (k, label), items in sorted(grupos.items()):
    items = sorted(items)
    rows = (len(items) + cols - 1) // cols
    W, H = cols * cell, rows * (cell + pad) + 34
    canvas = Image.new("RGB", (W, H), (245, 245, 248)); d = ImageDraw.Draw(canvas)
    d.text((8, 8), f"FUTBOL — {label}  ·  {len(items)} modelos", fill=(15, 15, 15), font=font)
    for i, n in enumerate(items):
        try:
            im = Image.open(chars[n]).convert("RGB"); im.thumbnail((cell - 10, cell - 10))
            x, y = (i % cols) * cell, 34 + (i // cols) * (cell + pad)
            canvas.paste(im, (x + 5, y + 5))
            d.text((x + 5, y + cell - 1), n[:26], fill=(20, 20, 20), font=font)
        except Exception: pass
    out = os.path.join(BASE, f"contacto-{k}.jpg")
    canvas.save(out, "JPEG", quality=84)
    print(f"  ok {label}: {len(items)} -> {out}")
