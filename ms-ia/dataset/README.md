# Dataset del clasificador (CU04)

Las fotos **no se suben a git** (pesan mucho): cada integrante las guarda aquí localmente o en una carpeta
compartida (Drive). Solo se versiona este README.

## Productos (5)

Una carpeta por producto, con el nombre exacto de su `etiquetaModelo` del catálogo de ms-inventario. Se eligieron
productos de forma y color bien distintos para que el modelo los separe con pocas fotos.

| Carpeta | Producto | Código |
|---|---|---|
| `pacena_620/` | Cerveza Paceña 620 ml | CER-001 |
| `huari_620/` | Cerveza Huari 620 ml | CER-003 |
| `casareal_negra/` | Singani Casa Real Etiqueta Negra 750 ml | SIN-001 |
| `jw_red/` | Whisky Johnnie Walker Red Label 750 ml | WHI-001 |
| `absolut_750/` | Vodka Absolut 750 ml | VOD-001 |

## Cómo tomar las fotos (40 por producto)

- Distintos ángulos: frente (15), costados (10), inclinada (10), parcialmente tapada por la mano (5).
- Distinta luz: natural, foco blanco y luz cálida del mostrador.
- Distintos fondos, pero la botella ocupando al menos la mitad de la foto.
- Formato JPG, cualquier tamaño (el entrenamiento las redimensiona). Nombre libre.
- Además, 2 videos cortos (10 s) del mostrador con varios productos, para probar `/video/analizar` (semana 3).

## Entrenar

```sh
cd ms-ia
pip install -r entrenamiento/requirements.txt          # TensorFlow (solo para entrenar)
python entrenamiento/entrenar.py --dataset dataset --salida modelos
```

Sin Python local, con Docker (desde `ms-ia/`, en Git Bash):

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/ms-ia" -w /ms-ia python:3.12-slim sh -c \
  "pip install -q -r entrenamiento/requirements.txt && python entrenamiento/entrenar.py --dataset dataset --salida modelos"
```

El resultado queda en `modelos/<versión>/` y `modelos/latest.json`; ms-ia lo toma sin reiniciar.
Para probar el proceso antes de tener fotos: `python entrenamiento/dataset_sintetico.py --salida dataset-prueba`.
