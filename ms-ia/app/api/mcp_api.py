from typing import Any

from fastapi import APIRouter, Body, Depends

from app.mcp import mcp_servidor
from app.seguridad import Usuario, usuario_actual

router = APIRouter(prefix="/mcp", tags=["Servidor MCP (R14)"])


@router.get("/tools", summary="Lista las 4 tools expuestas por el servidor MCP de ms-ia")
def listar_tools(_: Usuario = Depends(usuario_actual)):
    return {"servidor": mcp_servidor.nombre, "tools": mcp_servidor.listar_tools()}


@router.post("/tools/{nombre}", summary="Ejecuta una tool del servidor MCP reenviando el token del usuario")
def ejecutar_tool(
    nombre: str,
    argumentos: dict[str, Any] = Body(default_factory=dict),
    usuario: Usuario = Depends(usuario_actual),
):
    resultado = mcp_servidor.ejecutar(nombre, argumentos, token=usuario.token)
    return {"tool": nombre, "resultado": resultado}

