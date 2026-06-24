# Estándar: limpia watermarks de creador EN ESQUINA sobre la portada blanco.jpg.
# rembg pone fondo blanco pero NO quita el logo del creador. Para logos en una esquina
# (sobre fondo ya blanco), un parche blanco los elimina sin tocar el producto.
# Idempotente: re-correr es seguro. Se encadena DESPUÉS de fondos-blancos.py.
#
# NO sirve para marcas en el centro de la foto (ej. botella Kahlúa) → esas requieren
# reshoot de Blas (foto propia del print) o inpainting con IA.
#
# Correr: python scripts/limpiar-watermark.py
import os
from PIL import Image, ImageDraw

PACK = os.path.join("public", "pack")

# slug -> (x0, y0, x1, y1) en FRACCIONES del tamaño. Región blanca que cubre el logo.
# Mantener y0 por DEBAJO del producto para no taparlo.
WATERMARKS = {
    "alcancia-pulpo": (0.63, 0.77, 1.00, 1.00),   # logo BODY3D, esquina inferior derecha
    "huevo-de-dragon": (0.79, 0.63, 1.00, 1.00),  # logo NUKDDD.COM, esquina inferior derecha
}


def main():
    hechos = 0
    for slug, (fx0, fy0, fx1, fy1) in WATERMARKS.items():
        path = os.path.join(PACK, slug, "blanco.jpg")
        if not os.path.exists(path):
            print(f"  skip {slug}: no hay blanco.jpg")
            continue
        im = Image.open(path).convert("RGB")
        w, h = im.size
        d = ImageDraw.Draw(im)
        d.rectangle([int(w * fx0), int(h * fy0), int(w * fx1), int(h * fy1)], fill=(255, 255, 255))
        im.save(path, "JPEG", quality=92)
        hechos += 1
        print(f"  ok {slug}: watermark esquina cubierto")
    print(f"\n>>> watermarks limpiados: {hechos}")


if __name__ == "__main__":
    main()
