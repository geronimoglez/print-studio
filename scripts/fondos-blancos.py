# Estándar de fotos: fondo BLANCO para todo el catálogo (rembg).
# Para cada modelo en public/pack/<slug>/ toma la foto de portada, recorta el producto y lo
# compone sobre blanco puro 1200x1200 (estilo Mercado Libre) → guarda <slug>/blanco.jpg.
# Idempotente: si ya existe blanco.jpg, se omite (usar --force para rehacer).
# Escribe un manifiesto JSON (slug → ruta /pack/<slug>/blanco.jpg) que consume aplicar-fondos.ts.
#
# Correr: python scripts/fondos-blancos.py   (rembg + pillow ya instalados)
import os
import sys
import json
from rembg import remove
from PIL import Image

PACK = os.path.join("public", "pack")
SIZE = 1200
FORCE = "--force" in sys.argv
MANIFEST = os.path.join("public", "pack", "_blancos.json")

IMG_EXT = (".webp", ".jpg", ".jpeg", ".png")


def portada(slug_dir):
    files = sorted(f for f in os.listdir(slug_dir) if f.lower().endswith(IMG_EXT) and f.lower() != "blanco.jpg")
    if not files:
        return None
    # preferir "1.*" si existe
    for f in files:
        if f.lower().startswith("1."):
            return os.path.join(slug_dir, f)
    return os.path.join(slug_dir, files[0])


def procesar(src_path, dst_path):
    src = Image.open(src_path).convert("RGBA")
    cut = remove(src)
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    target = int(SIZE * 0.92)
    cut.thumbnail((target, target), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    canvas.paste(cut, ((SIZE - cut.width) // 2, (SIZE - cut.height) // 2), cut)
    canvas.convert("RGB").save(dst_path, "JPEG", quality=92)


def main():
    manifest = {}
    hechos = omitidos = errores = 0
    for slug in sorted(os.listdir(PACK)):
        slug_dir = os.path.join(PACK, slug)
        if not os.path.isdir(slug_dir):
            continue
        dst = os.path.join(slug_dir, "blanco.jpg")
        rel = f"/pack/{slug}/blanco.jpg"
        if os.path.exists(dst) and not FORCE:
            manifest[slug] = rel
            omitidos += 1
            continue
        src = portada(slug_dir)
        if not src:
            continue
        try:
            procesar(src, dst)
            manifest[slug] = rel
            hechos += 1
            print(f"  ok {slug}")
        except Exception as e:
            errores += 1
            print(f"  ERR {slug}: {e}")
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=0)
    print(f"\n>>> blancos: {hechos} nuevos, {omitidos} ya existían, {errores} errores. Manifiesto: {MANIFEST}")


if __name__ == "__main__":
    main()
