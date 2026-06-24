# Prueba de fondo blanco con rembg: recorta el producto y lo compone sobre blanco puro,
# centrado y cuadrado (estilo Mercado Libre). Guarda en materiales/blanco-test/.
import os
from rembg import remove
from PIL import Image

PACK = os.path.join("public", "pack")
OUT = os.path.join("..", "materiales", "blanco-test")
os.makedirs(OUT, exist_ok=True)

# 2-3 modelos de prueba (slug, archivo)
PRUEBAS = [
    ("ajolote-flex", "1.webp"),
    ("soporte-de-vino-dragon", "1.webp"),
    ("alcancia-pulpo", "1.jpg"),
]

SIZE = 1200  # ML recomienda 1200x1200


def procesar(src_path, dst_path):
    src = Image.open(src_path).convert("RGBA")
    cut = remove(src)  # RGBA con fondo transparente
    # bounding box del producto (recorta el transparente sobrante)
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    # escalar para que el producto ocupe ~92% del lienzo
    target = int(SIZE * 0.92)
    cut.thumbnail((target, target), Image.LANCZOS)
    # lienzo blanco cuadrado y pegar centrado
    canvas = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    x = (SIZE - cut.width) // 2
    y = (SIZE - cut.height) // 2
    canvas.paste(cut, (x, y), cut)
    canvas.convert("RGB").save(dst_path, "JPEG", quality=92)


for slug, fname in PRUEBAS:
    src = os.path.join(PACK, slug, fname)
    if not os.path.exists(src):
        print("no existe:", src)
        continue
    dst = os.path.join(OUT, f"{slug}-blanco.jpg")
    try:
        procesar(src, dst)
        print("OK ->", dst)
    except Exception as e:
        print("ERROR", slug, e)

print("listo")
