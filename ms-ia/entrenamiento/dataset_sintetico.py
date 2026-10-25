"""Genera un dataset de prueba con imágenes sintéticas (una forma y color distintos por producto).

Sirve para probar el proceso completo (entrenar → exportar → clasificar) antes de tener las fotos reales:
    python entrenamiento/dataset_sintetico.py --salida dataset-prueba
    python entrenamiento/entrenar.py --dataset dataset-prueba --salida modelos --epocas 3 --afinar 0 --tamano 128
"""

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

# Los 5 productos del dataset real (ver dataset/README.md), cada uno con un color y una forma
PRODUCTOS = {
    "pacena_620": ((200, 160, 40), "rect"),
    "huari_620": ((30, 90, 170), "ellipse"),
    "casareal_negra": ((25, 25, 25), "rect"),
    "jw_red": ((180, 30, 40), "triangle"),
    "absolut_750": ((140, 190, 220), "ellipse"),
}


def imagen(color, forma, tamano=224) -> Image.Image:
    fondo = tuple(random.randint(150, 255) for _ in range(3))
    img = Image.new("RGB", (tamano, tamano), fondo)
    d = ImageDraw.Draw(img)
    c = tuple(max(0, min(255, v + random.randint(-25, 25))) for v in color)
    x0, y0 = random.randint(10, 60), random.randint(10, 60)
    x1, y1 = random.randint(150, 214), random.randint(150, 214)
    if forma == "rect":
        d.rectangle([x0, y0, x1, y1], fill=c)
    elif forma == "ellipse":
        d.ellipse([x0, y0, x1, y1], fill=c)
    else:
        d.polygon([((x0 + x1) // 2, y0), (x0, y1), (x1, y1)], fill=c)
    return img.rotate(random.uniform(-20, 20), fillcolor=fondo).filter(ImageFilter.GaussianBlur(random.uniform(0, 1.2)))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--salida", type=Path, default=Path("dataset-prueba"))
    p.add_argument("--por-producto", type=int, default=40)
    a = p.parse_args()
    random.seed(7)
    for etiqueta, (color, forma) in PRODUCTOS.items():
        carpeta = a.salida / etiqueta
        carpeta.mkdir(parents=True, exist_ok=True)
        for i in range(a.por_producto):
            imagen(color, forma).save(carpeta / f"{etiqueta}_{i:03d}.jpg", quality=90)
    print(f"Dataset sintético: {len(PRODUCTOS)} productos × {a.por_producto} imágenes en {a.salida}")


if __name__ == "__main__":
    main()
