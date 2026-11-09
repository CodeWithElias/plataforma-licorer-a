"""Cliente MCP de los agentes: descubre y ejecuta las tools por el protocolo MCP (Streamable HTTP), con el token
de quien pidió el trabajo. Sin MCP_URL (pruebas o desarrollo sin servidor) las ejecuta en el mismo proceso."""

import asyncio
import json
import os
from typing import Any

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from fastmcp.exceptions import ToolError

from app.mcp.servidor import ErrorMcp, mcp_servidor, obtener_token_actual


TIEMPO_MAXIMO_TOOL = 30   # segundos


def _url_mcp() -> str:
    return os.getenv("MCP_URL", "").strip()


def _cliente(url: str) -> Client:
    transporte = StreamableHttpTransport(url, headers={"Authorization": f"Bearer {obtener_token_actual()}"})
    return Client(transporte, timeout=TIEMPO_MAXIMO_TOOL)


async def _llamar(url: str, nombre: str, argumentos: dict[str, Any]) -> Any:
    async with _cliente(url) as cliente:
        return (await cliente.call_tool(nombre, argumentos)).data


async def _listar(url: str) -> list[dict[str, Any]]:
    async with _cliente(url) as cliente:
        return [
            {"name": t.name, "description": t.description, "inputSchema": t.input_schema}
            for t in await cliente.list_tools()
        ]


def llamar_tool(nombre: str, argumentos: dict[str, Any] | None = None) -> Any:
    args = {k: v for k, v in (argumentos or {}).items() if v is not None}
    url = _url_mcp()
    if not url:
        return mcp_servidor.ejecutar(nombre, args)
    try:
        return asyncio.run(_llamar(url, nombre, args))
    except ToolError as e:
        try:
            detalle = json.loads(str(e))
            raise ErrorMcp(int(detalle["status"]), detalle["codigo"], detalle["mensaje"]) from e
        except (ValueError, KeyError):
            raise ErrorMcp(502, "ERROR_MCP", str(e)) from e
    except Exception as e:   # sin conexión, token vencido, error del protocolo: los agentes lo manejan como ErrorMcp
        raise ErrorMcp(502, "ERROR_MCP", f"El servidor MCP no respondió: {e}") from e


def listar_tools() -> list[dict[str, Any]]:
    """Las tools que ofrece el servidor; así el agente las descubre en lugar de tenerlas escritas en su código."""
    url = _url_mcp()
    if not url:
        return mcp_servidor.listar_tools()
    try:
        return asyncio.run(_listar(url))
    except Exception as e:
        raise ErrorMcp(502, "ERROR_MCP", f"El servidor MCP no respondió: {e}") from e


def buscar_producto(consulta: str = "", tipo: str | None = None) -> list[dict[str, Any]]:
    return llamar_tool("buscar_producto", {"consulta": consulta, "tipo": tipo}) or []


def stock_actual(codigos: list[str] | None = None, solo_bajo_minimo: bool = False) -> list[dict[str, Any]]:
    return llamar_tool("stock_actual", {"codigos": codigos, "solo_bajo_minimo": solo_bajo_minimo}) or []


def ventas_por_periodo(desde: str, hasta: str) -> list[dict[str, Any]]:
    return llamar_tool("ventas_por_periodo", {"desde": desde, "hasta": hasta}) or []


def crear_orden_compra(proveedorId: str, lineas: list[dict[str, Any]]) -> dict[str, Any]:
    return llamar_tool("crear_orden_compra", {"proveedorId": proveedorId, "lineas": lineas})
