import io
import os
import tempfile
from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, UploadFile
from PIL import Image

from app.errores import ErrorApi
from app.modelos.clasificador import clasificador, version_vigente
from app.seguridad import Usuario, requiere_roles
from app.servicios import inventario

router = APIRouter(prefix="/video", tags=["Reconocimiento (CU04)"])

_TAMANO_MAXIMO = 32 * 1024 * 1024


def extraer_frames_por_segundo(contenido: bytes) -> list[tuple[int, bytes]]:
    """Extrae 1 fotograma por segundo del video usando OpenCV y devuelve [(segundo, jpeg_bytes), ...]."""
    sufijo = ".mp4"
    fd, ruta_str = tempfile.mkstemp(suffix=sufijo)
    ruta_tmp = Path(ruta_str)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(contenido)

        cap = cv2.VideoCapture(str(ruta_tmp))
        if not cap.isOpened():
            raise ErrorApi(400, "DATOS_INVALIDOS", "No se pudo abrir el archivo de video")

        try:
            fps = cap.get(cv2.CAP_PROP_FPS)
            if not fps or fps <= 0 or fps != fps:  # NaN check
                fps = 30.0
            paso = max(1, int(round(fps)))

            frames: list[tuple[int, bytes]] = []
            idx = 0
            while True:
                ok, frame_bgr = cap.read()
                if not ok or frame_bgr is None:
                    break
                if idx % paso == 0:
                    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                    buffer = io.BytesIO()
                    Image.fromarray(frame_rgb).save(buffer, format="JPEG", quality=90)
                    frames.append((idx // paso, buffer.getvalue()))
                idx += 1
        finally:
            cap.release()
    finally:
        ruta_tmp.unlink(missing_ok=True)

    if not frames:
        raise ErrorApi(400, "DATOS_INVALIDOS", "No se pudieron extraer fotogramas del video")
    return frames


@router.post("/analizar", summary="Extrae 1 frame por segundo y clasifica cada uno (CU04)")
async def analizar(
    video: UploadFile = File(...),
    usuario: Usuario = Depends(requiere_roles("CAJERO", "ALMACEN", "GERENTE")),
):
    contenido = await video.read()
    if not contenido:
        raise ErrorApi(400, "DATOS_INVALIDOS", "El video está vacío")
    if len(contenido) > _TAMANO_MAXIMO:
        raise ErrorApi(400, "DATOS_INVALIDOS", "El video supera 32 MB")

    # Verifica primero que exista un modelo entrenado (503 MODELO_NO_DISPONIBLE si no hay)
    version_vigente()

    frames = extraer_frames_por_segundo(contenido)
    catalogo = inventario.catalogo_por_etiqueta(usuario.token)

    resultados = []
    for segundo, frame_jpg in frames:
        prediccion, version = clasificador.clasificar(frame_jpg)
        producto = catalogo.get(prediccion.etiqueta)
        resultados.append({
            "segundo": segundo,
            "productoCodigo": producto["codigo"] if producto else None,
            "nombre": producto["nombre"] if producto else None,
            "etiqueta": prediccion.etiqueta,
            "confianza": round(prediccion.confianza, 4),
            "modelo": version,
        })

    return resultados
