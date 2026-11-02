"""Carga e inferencia del clasificador de productos TFLite."""

import io
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Tuple

import numpy as np
from PIL import Image

from app.errores import ErrorApi


@dataclass
class Prediccion:
    etiqueta: str
    confianza: float


def directorio_modelos() -> Path:
    return Path(os.getenv("MODELOS_DIR", "./modelos"))


def version_vigente() -> dict:
    archivo_latest = directorio_modelos() / "latest.json"
    if not archivo_latest.is_file():
        raise ErrorApi(503, "MODELO_NO_DISPONIBLE", "No hay ningún modelo entrenado disponible")

    try:
        data = json.loads(archivo_latest.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "version" not in data:
            raise ValueError("Estructura de latest.json inválida")
        return data
    except Exception:
        raise ErrorApi(503, "MODELO_NO_DISPONIBLE", "No hay ningún modelo entrenado disponible")


class _InterpreteNumpy:
    """Intérprete ligero en NumPy (GlobalAveragePooling2D + Dense Softmax) cuando el host no tiene LiteRT (p. ej. Python 3.14)."""

    def __init__(self, carpeta_modelo: Path, tamano: int = 224):
        ruta_pesos = carpeta_modelo / "pesos.npz"
        if ruta_pesos.is_file():
            datos = np.load(ruta_pesos)
            self._kernel = datos["kernel"].astype(np.float32)  # (3, N)
            self._bias = datos["bias"].astype(np.float32)      # (N,)
        else:
            raise FileNotFoundError("No hay runtime TFLite ni pesos.npz")
        self._tamano = tamano
        self._entrada: np.ndarray | None = None
        self._salida: np.ndarray | None = None

    def allocate_tensors(self):
        pass

    def get_input_details(self):
        return [{"index": 0, "shape": np.array([1, self._tamano, self._tamano, 3])}]

    def get_output_details(self):
        return [{"index": 1, "shape": np.array([1, self._bias.shape[0]])}]

    def set_tensor(self, _index: int, valor: np.ndarray):
        self._entrada = valor

    def invoke(self):
        # Características espaciales RGB (normalizadas a 0..1) -> capa densa -> softmax
        x = self._entrada.astype(np.float32) / 255.0
        if self._kernel.shape[0] == 9:
            h, w = x.shape[1], x.shape[2]
            c_h0, c_h1 = h // 3, (2 * h) // 3
            c_w0, c_w1 = w // 3, (2 * w) // 3
            media_global = x.mean(axis=(1, 2))
            media_centro = x[:, c_h0:c_h1, c_w0:c_w1, :].mean(axis=(1, 2))
            std_global = x.std(axis=(1, 2))
            feat = np.concatenate([media_global, media_centro, std_global], axis=-1)
        else:
            feat = x.mean(axis=(1, 2))
        logits = feat @ self._kernel + self._bias
        logits = logits - np.max(logits, axis=-1, keepdims=True)
        exp = np.exp(logits)
        self._salida = exp / np.sum(exp, axis=-1, keepdims=True)

    def get_tensor(self, _index: int) -> np.ndarray:
        return self._salida


class Clasificador:
    def __init__(self):
        self._interprete = None
        self._version_cargada = None

    def _cargar_interprete(self, version: str, ruta_modelo: Path, tamano: int = 224):
        if self._interprete is not None and self._version_cargada == version:
            return self._interprete

        Interpreter = None
        try:
            from ai_edge_litert.interpreter import Interpreter
        except ImportError:
            try:
                from tflite_runtime.interpreter import Interpreter
            except ImportError:
                try:
                    import tensorflow as tf
                    Interpreter = tf.lite.Interpreter
                except ImportError:
                    Interpreter = None

        try:
            interprete = None
            if Interpreter is not None:
                try:
                    interprete = Interpreter(model_path=str(ruta_modelo))
                    interprete.allocate_tensors()
                except Exception:
                    if (ruta_modelo.parent / "pesos.npz").is_file():
                        interprete = _InterpreteNumpy(ruta_modelo.parent, tamano=tamano)
                        interprete.allocate_tensors()
                    else:
                        raise
            elif (ruta_modelo.parent / "pesos.npz").is_file():
                interprete = _InterpreteNumpy(ruta_modelo.parent, tamano=tamano)
                interprete.allocate_tensors()
            else:
                raise ErrorApi(500, "ERROR_INTERNO", "No hay runtime de TFLite disponible")
            self._interprete = interprete
            self._version_cargada = version
            return self._interprete
        except ErrorApi:
            raise
        except Exception as e:
            raise ErrorApi(500, "ERROR_INTERNO", f"Error al inicializar el modelo: {e}")

    def clasificar(self, contenido: bytes) -> Tuple[Prediccion, str]:
        info = version_vigente()
        version = info["version"]
        ruta_modelo = directorio_modelos() / version / "modelo.tflite"

        if not ruta_modelo.is_file():
            raise ErrorApi(503, "MODELO_NO_DISPONIBLE", f"El archivo del modelo {version} no existe")

        try:
            img = Image.open(io.BytesIO(contenido)).convert("RGB")
        except Exception as e:
            raise ErrorApi(400, "DATOS_INVALIDOS", f"No se pudo procesar la imagen: {e}")

        interprete = self._cargar_interprete(version, ruta_modelo, tamano=info.get("tamano", 224))
        detalles_in = interprete.get_input_details()
        detalles_out = interprete.get_output_details()

        forma_esperada = detalles_in[0]["shape"]
        tamano = forma_esperada[1] if len(forma_esperada) >= 3 else info.get("tamano", 224)
        img = img.resize((tamano, tamano))

        entrada = np.array(img, dtype=np.float32)
        if len(entrada.shape) == 3:
            entrada = np.expand_dims(entrada, axis=0)

        interprete.set_tensor(detalles_in[0]["index"], entrada)
        interprete.invoke()

        probabilidades = interprete.get_tensor(detalles_out[0]["index"])[0]
        idx = int(np.argmax(probabilidades))
        etiquetas = info.get("etiquetas", [])
        etiqueta = etiquetas[idx] if 0 <= idx < len(etiquetas) else f"clase_{idx}"
        confianza = float(probabilidades[idx])

        return Prediccion(etiqueta=etiqueta, confianza=confianza), version


clasificador = Clasificador()
