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
import shutil
from pathlib import Path

import tensorflow as tf

TAMANOS_MOBILENET = (96, 128, 160, 192, 224)


def cargar_dataset(carpeta: Path, tamano: int, lote: int):
    comunes = dict(validation_split=0.2, seed=42, image_size=(tamano, tamano), batch_size=lote, label_mode="int")
    entreno = tf.keras.utils.image_dataset_from_directory(carpeta, subset="training", **comunes)
    validacion = tf.keras.utils.image_dataset_from_directory(carpeta, subset="validation", **comunes)
    etiquetas = entreno.class_names

    # Aumento de datos solo al entrenar (distintos ángulos y luz, como pide la guía de fotos)
    aumento = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomRotation(0.08),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomBrightness(0.2, value_range=(0, 255)),
        tf.keras.layers.RandomContrast(0.2),
    ])
    entreno = entreno.map(lambda x, y: (aumento(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    return entreno.prefetch(tf.data.AUTOTUNE), validacion.prefetch(tf.data.AUTOTUNE), etiquetas


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


def exportar_tfjs(modelo, destino: Path) -> bool:
    try:
        import tensorflowjs as tfjs
    except ImportError:
        print("tensorflowjs no está instalado: se omite la exportación a TF.js (pip install tensorflowjs)")
        return False
    tfjs.converters.save_keras_model(modelo, str(destino))
    return True


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

    entreno, validacion, etiquetas = cargar_dataset(a.dataset, a.tamano, a.lote)
    print(f"Clases ({len(etiquetas)}): {etiquetas}")

    modelo, base = construir_modelo(a.tamano, len(etiquetas))
    modelo.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    parar = tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=4, restore_best_weights=True)
    modelo.fit(entreno, validation_data=validacion, epochs=a.epocas, callbacks=[parar])

    if a.afinar > 0:
        base.trainable = True
        for capa in base.layers[:-30]:   # solo se reentrenan las últimas 30 capas
            capa.trainable = False
        modelo.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
        modelo.fit(entreno, validation_data=validacion, epochs=a.afinar, callbacks=[parar])

    _, precision = modelo.evaluate(validacion, verbose=0)
    version = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    destino = a.salida / version
    destino.mkdir(parents=True, exist_ok=True)

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
        "tfjs": con_tfjs,
    }
    (destino / "info.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    (a.salida / "latest.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Modelo {version}: precisión de validación {precision:.1%} → {destino}")
    if precision < 0.8:
        print("Aviso: la precisión es menor al 80 % que pide la prueba de CU04 (más fotos, fondo neutro o menos productos)")


if __name__ == "__main__":
    main()
