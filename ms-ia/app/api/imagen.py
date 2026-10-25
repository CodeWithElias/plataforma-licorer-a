from fastapi import APIRouter, Depends, File, UploadFile

from app.errores import ErrorApi
from app.modelos.clasificador import clasificador
from app.seguridad import Usuario, requiere_roles
from app.servicios.inventario import catalogo_por_etiqueta

router = APIRouter(prefix="/imagen", tags=["Reconocimiento (CU04)"])

_TAMANO_MAXIMO = 8 * 1024 * 1024


@router.post("/clasificar", summary="Clasifica la foto de un producto")
async def clasificar(imagen: UploadFile = File(...), usuario: Usuario = Depends(requiere_roles("CAJERO", "ALMACEN", "GERENTE"))):
    contenido = await imagen.read()
    if not contenido:
        raise ErrorApi(400, "DATOS_INVALIDOS", "La imagen está vacía")
    if len(contenido) > _TAMANO_MAXIMO:
        raise ErrorApi(400, "DATOS_INVALIDOS", "La imagen supera 8 MB")

    prediccion, version = clasificador.clasificar(contenido)
    producto = catalogo_por_etiqueta(usuario.token).get(prediccion.etiqueta)
    return {
        "productoCodigo": producto["codigo"] if producto else None,
        "nombre": producto["nombre"] if producto else None,
        "etiqueta": prediccion.etiqueta,
        "confianza": round(prediccion.confianza, 4),
        "modelo": version,
    }
