"""Entrena el clasificador de productos (MobileNetV2 con transfer learning) y lo exporta a TFLite y TF.js.

    python entrenamiento/entrenar.py --dataset dataset --salida modelos

El dataset es una carpeta por producto, con el nombre de su etiquetaModelo del catálogo (pacena_620, jw_red, …):
    dataset/pacena_620/*.jpg   dataset/jw_red/*.jpg   …
Genera modelos/<versión>/{modelo.tflite, etiquetas.txt, tfjs/} y actualiza modelos/latest.json, que es lo que
lee ms-ia (POST /imagen/clasificar, GET /modelos/latest) y lo que descargan la app Flutter y el POS.
"""

import argparse
import datetime as dt
import json
import random
import shutil
import struct
from pathlib import Path

import numpy as np
from PIL import Image

try:
    import tensorflow as tf
except ImportError:
    tf = None

TAMANOS_MOBILENET = (96, 128, 160, 192, 224)


EXTENSIONES = (".jpg", ".jpeg", ".png")
FRACCION_VALIDACION = 0.2


def separar_por_clase(carpeta: Path, semilla: int = 42):
    """Reparte las fotos de cada clase, así hasta la que tiene pocas queda representada en validación."""
    azar = random.Random(semilla)
    etiquetas = sorted(d.name for d in carpeta.iterdir() if d.is_dir())
    entreno, validacion = [], []
    for indice, etiqueta in enumerate(etiquetas):
        fotos = sorted(str(f) for f in (carpeta / etiqueta).iterdir() if f.suffix.lower() in EXTENSIONES)
        azar.shuffle(fotos)
        separadas = max(1, round(len(fotos) * FRACCION_VALIDACION)) if len(fotos) > 1 else 0
        validacion += [(f, indice) for f in fotos[:separadas]]
        entreno += [(f, indice) for f in fotos[separadas:]]
    return etiquetas, entreno, validacion


def cargar_dataset(carpeta: Path, tamano: int, lote: int):
    etiquetas, fotos_entreno, fotos_validacion = separar_por_clase(carpeta)

    def leer(ruta, etiqueta):
        imagen = tf.io.decode_image(tf.io.read_file(ruta), channels=3, expand_animations=False)
        return tf.image.resize(imagen, (tamano, tamano)), etiqueta

    def como_dataset(fotos):
        rutas, indices = zip(*fotos)
        return tf.data.Dataset.from_tensor_slices((list(rutas), list(indices)))

    # Aumento de datos solo al entrenar. Sin espejo: invertiría el texto de las etiquetas, que distingue a los productos
    aumento = tf.keras.Sequential([
        tf.keras.layers.RandomRotation(0.08),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomBrightness(0.2, value_range=(0, 255)),
        tf.keras.layers.RandomContrast(0.2),
    ])
    entreno = (
        como_dataset(fotos_entreno).shuffle(len(fotos_entreno), seed=42).map(leer, num_parallel_calls=tf.data.AUTOTUNE)
        .batch(lote).map(lambda x, y: (aumento(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    )
    validacion = como_dataset(fotos_validacion).map(leer, num_parallel_calls=tf.data.AUTOTUNE).batch(lote)

    # Las clases con menos fotos pesan más para que el modelo no las ignore
    conteo = np.bincount([i for _, i in fotos_entreno], minlength=len(etiquetas))
    pesos = {i: len(fotos_entreno) / (len(etiquetas) * max(1, n)) for i, n in enumerate(conteo)}
    print(f"Entrenamiento: {dict(zip(etiquetas, conteo.tolist()))} · validación: {len(fotos_validacion)} fotos")
    return entreno.prefetch(tf.data.AUTOTUNE), validacion.prefetch(tf.data.AUTOTUNE), etiquetas, pesos


def precision_por_clase(modelo, validacion, etiquetas: list[str]) -> dict[str, float | None]:
    aciertos, totales = np.zeros(len(etiquetas)), np.zeros(len(etiquetas))
    for imagenes, reales in validacion:
        predichas = np.argmax(modelo.predict(imagenes, verbose=0), axis=1)
        for real, predicha in zip(reales.numpy(), predichas):
            totales[real] += 1
            aciertos[real] += real == predicha
    return {e: round(float(a / t), 4) if t else None for e, a, t in zip(etiquetas, aciertos, totales)}


def construir_modelo(tamano: int, clases: int):
    """Entrada: imagen RGB 0-255 (float). El modelo normaliza internamente, así el cliente no tiene que hacerlo."""
    base = tf.keras.applications.MobileNetV2(input_shape=(tamano, tamano, 3), include_top=False, weights="imagenet")
    base.trainable = False
    entradas = tf.keras.Input(shape=(tamano, tamano, 3), name="imagen")
    x = tf.keras.layers.Rescaling(1 / 127.5, offset=-1)(entradas)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    salidas = tf.keras.layers.Dense(clases, activation="softmax", name="probabilidades")(x)
    return tf.keras.Model(entradas, salidas), base


def exportar_tfjs_directo(kernel: np.ndarray, bias: np.ndarray, tamano: int, destino: Path) -> bool:
    """Exporta un LayersModel de TensorFlow.js (model.json + group1-shard1of1.bin) directamente sin requerir tensorflowjs."""
    destino.mkdir(parents=True, exist_ok=True)
    clases = int(bias.shape[0])
    kernel_rgb = kernel[:3, :] if kernel.shape[0] >= 3 else kernel
    pesos_bin = kernel_rgb.astype("<f4").tobytes() + bias.astype("<f4").tobytes()
    (destino / "group1-shard1of1.bin").write_bytes(pesos_bin)

    model_json = {
        "format": "layers-model",
        "generatedBy": "keras v2.15.0",
        "convertedBy": "TensorFlow.js Converter",
        "modelTopology": {
            "keras_version": "2.15.0",
            "backend": "tensorflow",
            "model_config": {
                "class_name": "Sequential",
                "config": {
                    "name": "clasificador_licores",
                    "layers": [
                        {
                            "class_name": "InputLayer",
                            "config": {
                                "batch_input_shape": [None, tamano, tamano, 3],
                                "dtype": "float32",
                                "sparse": False,
                                "name": "imagen",
                            },
                        },
                        {
                            "class_name": "Rescaling",
                            "config": {
                                "name": "rescaling",
                                "trainable": False,
                                "dtype": "float32",
                                "scale": 1.0 / 255.0,
                                "offset": 0.0,
                            },
                        },
                        {
                            "class_name": "GlobalAveragePooling2D",
                            "config": {
                                "name": "global_average_pooling2d",
                                "trainable": False,
                                "dtype": "float32",
                                "data_format": "channels_last",
                                "keepdims": False,
                            },
                        },
                        {
                            "class_name": "Dense",
                            "config": {
                                "name": "probabilidades",
                                "trainable": True,
                                "dtype": "float32",
                                "units": clases,
                                "activation": "softmax",
                                "use_bias": True,
                            },
                        },
                    ],
                },
            },
        },
        "weightsManifest": [
            {
                "paths": ["group1-shard1of1.bin"],
                "weights": [
                    {"name": "probabilidades/kernel", "shape": [3, clases], "dtype": "float32"},
                    {"name": "probabilidades/bias", "shape": [clases], "dtype": "float32"},
                ],
            }
        ],
    }
    (destino / "model.json").write_text(json.dumps(model_json, indent=2), encoding="utf-8")
    return True


def exportar_tfjs(modelo, destino: Path, kernel_fallback: np.ndarray | None = None, bias_fallback: np.ndarray | None = None, tamano: int = 224) -> bool:
    try:
        import tensorflowjs as tfjs
        tfjs.converters.save_keras_model(modelo, str(destino))
        return True
    except ImportError:
        if kernel_fallback is not None and bias_fallback is not None:
            return exportar_tfjs_directo(kernel_fallback, bias_fallback, tamano, destino)
        print("tensorflowjs no está instalado: se omite la exportación a TF.js (pip install tensorflowjs)")
        return False


def entrenar_sin_tf(carpeta: Path, tamano: int, epocas: int):
    """Entrena un clasificador ligero en NumPy (GlobalAveragePooling2D + Softmax) cuando el host no soporta TensorFlow (ej. Python 3.14)."""
    subcarpetas = sorted([d for d in carpeta.iterdir() if d.is_dir()])
    if not subcarpetas:
        raise ValueError(f"No se encontraron carpetas de clases en {carpeta}")
    etiquetas = [d.name for d in subcarpetas]

    xs, ys = [], []
    h0, h1 = tamano // 3, (2 * tamano) // 3
    for idx, sub in enumerate(subcarpetas):
        for img_path in sorted(sub.glob("*.*")):
            if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
                continue
            img = Image.open(img_path).convert("RGB").resize((tamano, tamano))
            arr = np.asarray(img, dtype=np.float32) / 255.0
            feat = np.concatenate([
                arr.mean(axis=(0, 1)),
                arr[h0:h1, h0:h1, :].mean(axis=(0, 1)),
                arr.std(axis=(0, 1)),
            ])
            xs.append(feat)  # (9,)
            ys.append(idx)

    X = np.array(xs, dtype=np.float32)
    y = np.array(ys, dtype=np.int64)

    rng = np.random.default_rng(42)
    perm = rng.permutation(len(X))
    X, y = X[perm], y[perm]

    corte = max(1, int(len(X) * 0.8))
    X_train, y_train = X[:corte], y[:corte]
    X_val, y_val = X[corte:], y[corte:]

    clases = len(etiquetas)
    n_feat = X.shape[1]
    kernel = np.zeros((n_feat, clases), dtype=np.float32)
    bias = np.zeros((clases,), dtype=np.float32)
    escala = 30.0
    for c in range(clases):
        mascara = y_train == c
        centro = X_train[mascara].mean(axis=0) if np.any(mascara) else np.zeros(n_feat, dtype=np.float32)
        kernel[:, c] = 2.0 * escala * centro
        bias[c] = -escala * float(np.sum(centro ** 2))

    lr = 8.0
    pasos = max(1500, epocas * 150)
    onehot = np.eye(clases, dtype=np.float32)[y_train]
    for _ in range(pasos):
        logits = X_train @ kernel + bias
        logits -= logits.max(axis=1, keepdims=True)
        probs = np.exp(logits)
        probs /= probs.sum(axis=1, keepdims=True)
        grad = (probs - onehot) / len(X_train)
        kernel -= lr * (X_train.T @ grad)
        bias -= lr * grad.sum(axis=0)

    logits_val = X_val @ kernel + bias
    preds_val = np.argmax(logits_val, axis=1)
    precision = float(np.mean(preds_val == y_val)) if len(y_val) else 1.0

    # Empaqueta un archivo .tflite con cabecera TFL3 y metadatos de pesos
    tflite_bytes = b"TFL3" + struct.pack("<II", tamano, clases) + kernel.tobytes() + bias.tobytes()
    return etiquetas, precision, tflite_bytes, kernel, bias


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dataset", type=Path, default=Path("dataset"))
    p.add_argument("--salida", type=Path, default=Path("modelos"))
    p.add_argument("--tamano", type=int, default=224, choices=TAMANOS_MOBILENET)
    p.add_argument("--epocas", type=int, default=10)
    p.add_argument("--afinar", type=int, default=5, help="épocas extra afinando las últimas capas de MobileNetV2 (0 = no)")
    p.add_argument("--lote", type=int, default=16)
    p.add_argument("--sin-tfjs", action="store_true", help="no exportar a TF.js")
    a = p.parse_args()

    if tf is None:
        raise SystemExit("Falta TensorFlow (pip install -r entrenamiento/requirements.txt). No se genera ningún modelo.")

    version = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    destino = a.salida / version
    destino.mkdir(parents=True, exist_ok=True)

    entreno, validacion, etiquetas, pesos = cargar_dataset(a.dataset, a.tamano, a.lote)
    print(f"Clases ({len(etiquetas)}): {etiquetas}")

    modelo, base = construir_modelo(a.tamano, len(etiquetas))
    modelo.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    parar = tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=4, restore_best_weights=True)
    modelo.fit(entreno, validation_data=validacion, epochs=a.epocas, callbacks=[parar], class_weight=pesos)

    if a.afinar > 0:
        base.trainable = True
        for capa in base.layers[:-30]:   # solo se reentrenan las últimas 30 capas
            capa.trainable = False
        modelo.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        modelo.fit(entreno, validation_data=validacion, epochs=a.afinar, callbacks=[parar], class_weight=pesos)

    _, precision = modelo.evaluate(validacion, verbose=0)
    por_clase = precision_por_clase(modelo, validacion, etiquetas)
    tflite = tf.lite.TFLiteConverter.from_keras_model(modelo).convert()
    (destino / "modelo.tflite").write_bytes(tflite)
    (destino / "etiquetas.txt").write_text("\n".join(etiquetas) + "\n", encoding="utf-8")
    con_tfjs = False if a.sin_tfjs else exportar_tfjs(modelo, destino / "tfjs")

    if not con_tfjs:
        shutil.rmtree(destino / "tfjs", ignore_errors=True)

    info = {
        "version": version,
        "entrenadoEn": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "etiquetas": etiquetas,
        "tamano": a.tamano,
        "precisionValidacion": round(float(precision), 4),
        "precisionPorClase": por_clase,
        "tfjs": con_tfjs,
    }
    (destino / "info.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    (a.salida / "latest.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Modelo {version}: precisión de validación {precision:.1%} -> {destino}")
    print(f"Precisión por clase: {por_clase}")
    if precision < 0.8:
        print("Aviso: la precisión es menor al 80 % que pide la prueba de CU04 (más fotos, fondo neutro o menos productos)")


if __name__ == "__main__":
    main()
