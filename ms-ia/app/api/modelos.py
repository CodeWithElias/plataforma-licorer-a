from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse

from app.errores import ErrorApi
from app.modelos.clasificador import directorio_modelos, version_vigente
from app.seguridad import Usuario, usuario_actual

router = APIRouter(prefix="/modelos", tags=["Modelos"])


@router.get("/latest", summary="Versión vigente del clasificador y URLs para descargarlo")
def latest(request: Request, _: Usuario = Depends(usuario_actual)):
    info = version_vigente()
    base = str(request.url_for("descargar", version=info["version"], archivo="X")).removesuffix("/X")
    return {
        "version": info["version"],
        "entrenadoEn": info.get("entrenadoEn"),
        "etiquetas": info.get("etiquetas", []),
        "precisionValidacion": info.get("precisionValidacion"),
        "tflite": f"{base}/modelo.tflite",
        "tfjs": f"{base}/tfjs/model.json" if (directorio_modelos() / info["version"] / "tfjs" / "model.json").exists() else None,
    }


@router.get("/{version}/{archivo:path}", name="descargar", summary="Descarga un archivo del modelo (TFLite, TF.js, etiquetas)")
def descargar(version: str, archivo: str, _: Usuario = Depends(usuario_actual)):
    carpeta = (directorio_modelos() / version).resolve()
    ruta = (carpeta / archivo).resolve()
    if carpeta not in ruta.parents or not ruta.is_file():
        raise ErrorApi(404, "NO_ENCONTRADO", f"No existe {version}/{archivo}")
    return FileResponse(ruta)
