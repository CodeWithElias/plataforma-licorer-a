from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.agentes import ejecutar_agente_reabastecimiento, ejecutar_agente_reportes
from app.errores import ErrorApi
from app.seguridad import Usuario, requiere_roles

router = APIRouter(tags=["Agentes LangGraph (CU06 y CU07)"])


class PeticionReporte(BaseModel):
    consulta: str = Field(..., description="Consulta en lenguaje natural (ej. 'Ventas por producto de esta semana en barras')")
    desde: str | None = Field(default=None, description="Fecha inicial ISO 8601 opcional")
    hasta: str | None = Field(default=None, description="Fecha final ISO 8601 opcional")


class PeticionReabastecimiento(BaseModel):
    productoCodigo: str = Field(..., description="Código del producto con stock bajo (ej. RON-002)")
    nombre: str | None = Field(default=None, description="Nombre del producto opcional")
    cantidad: int = Field(default=0, description="Cantidad actual en stock")
    minimo: int = Field(default=1, description="Stock mínimo configurado")


@router.post("/reportes", summary="Agente de reportes por lenguaje natural (CU07)")
def generar_reporte(
    cuerpo: PeticionReporte,
    usuario: Usuario = Depends(requiere_roles("GERENTE")),
):
    consulta = (cuerpo.consulta or "").strip()
    if not consulta:
        raise ErrorApi(400, "DATOS_INVALIDOS", "La consulta del reporte no puede estar vacía")
    return ejecutar_agente_reportes(
        consulta=consulta,
        desde=cuerpo.desde,
        hasta=cuerpo.hasta,
        token=usuario.token,
    )


@router.post("/agentes/reabastecimiento", summary="Agente de reabastecimiento; lo llama n8n con el aviso de stock bajo (CU06)")
def reabastecer_stock(
    cuerpo: PeticionReabastecimiento,
    usuario: Usuario = Depends(requiere_roles("GERENTE")),
):
    codigo = (cuerpo.productoCodigo or "").strip()
    if not codigo:
        raise ErrorApi(400, "DATOS_INVALIDOS", "El campo productoCodigo es obligatorio")
    return ejecutar_agente_reabastecimiento(
        producto_codigo=codigo,
        cantidad=cuerpo.cantidad,
        minimo=cuerpo.minimo,
        nombre=cuerpo.nombre,
        token=usuario.token,
    )

