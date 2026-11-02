"""Servidor MCP (FastMCP, semana 3). Tools: buscar_producto, stock_actual, ventas_por_periodo y
crear_orden_compra; cada una llama a la API del servicio dueño reenviando el token (ver docs/tools-mcp.md)."""

from app.mcp.servidor import (
    ErrorMcp,
    buscar_producto,
    consultar_proveedores_activos,
    crear_orden_compra,
    mcp_servidor,
    obtener_token_actual,
    stock_actual,
    usar_token_mcp,
    ventas_por_periodo,
)

__all__ = [
    "ErrorMcp",
    "buscar_producto",
    "consultar_proveedores_activos",
    "crear_orden_compra",
    "mcp_servidor",
    "obtener_token_actual",
    "stock_actual",
    "usar_token_mcp",
    "ventas_por_periodo",
]
