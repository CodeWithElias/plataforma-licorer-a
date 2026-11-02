"""Servidor MCP (FastMCP) de ms-ia con las 4 tools conectadas a ms-inventario, ms-ventas y ms-gestion.

Cada tool llama directamente por la red interna de Docker y reenvía el Bearer token del usuario/servicio
que invocó al agente o al endpoint MCP (ver docs/tools-mcp.md y docs/acuerdos-integracion.md).
"""

from contextlib import contextmanager
from contextvars import ContextVar
import json
import os
import re
from typing import Any, Callable
import urllib.error
import urllib.parse
import urllib.request

from app.errores import ErrorApi

_token_ctx: ContextVar[str] = ContextVar("token_mcp", default="")


class ErrorMcp(ErrorApi):
    """Error estructurado devuelto por un microservicio al ejecutar una tool MCP."""

    def __init__(self, status: int, codigo: str, mensaje: str):
        super().__init__(status, codigo, mensaje)


@contextmanager
def usar_token_mcp(token: str):
    """Establece el Bearer token en el contexto actual para las llamadas de las tools MCP."""
    reset_token = _token_ctx.set(token or "")
    try:
        yield
    finally:
        _token_ctx.reset(reset_token)


def obtener_token_actual(token_explicito: str | None = None) -> str:
    return token_explicito if token_explicito is not None else _token_ctx.get()


def _url_inventario() -> str:
    return os.getenv("INVENTARIO_URL", "http://localhost:8001").rstrip("/")


def _url_ventas() -> str:
    return os.getenv("VENTAS_URL", "http://localhost:8080").rstrip("/")


def _url_gestion() -> str:
    return os.getenv("GESTION_URL", "http://localhost:3000/graphql").rstrip("/")


def _peticion_json(
    url: str,
    *,
    metodo: str = "GET",
    cuerpo: dict[str, Any] | None = None,
    token: str | None = None,
    servicio: str = "servicio remoto",
) -> Any:
    """Realiza una llamada HTTP JSON reenviando el token Bearer y traduciendo errores {codigo, mensaje}."""
    bearer = obtener_token_actual(token)
    headers: dict[str, str] = {"Accept": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    datos = None
    if cuerpo is not None:
        headers["Content-Type"] = "application/json"
        datos = json.dumps(cuerpo).encode("utf-8")

    req = urllib.request.Request(url, data=datos, headers=headers, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except Exception:
            err_body = {}
        codigo = err_body.get("codigo") or (
            "NO_AUTENTICADO" if e.code == 401 else
            "SIN_PERMISO" if e.code == 403 else
            "NO_ENCONTRADO" if e.code == 404 else
            "ERROR_REMOTO"
        )
        mensaje = err_body.get("mensaje") or f"{servicio} respondió HTTP {e.code}"
        raise ErrorMcp(e.code, codigo, mensaje) from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise ErrorMcp(502, "ERROR_INTERNO", f"{servicio} no respondió: {e}") from e


def _peticion_graphql(query: str, variables: dict[str, Any] | None = None, token: str | None = None) -> dict[str, Any]:
    """Ejecuta una query o mutation en ms-gestion y verifica errores GraphQL."""
    respuesta = _peticion_json(
        _url_gestion(),
        metodo="POST",
        cuerpo={"query": query, "variables": variables or {}},
        token=token,
        servicio="ms-gestion",
    )
    if not isinstance(respuesta, dict):
        raise ErrorMcp(502, "ERROR_INTERNO", "Respuesta inválida de ms-gestion")

    errores = respuesta.get("errors")
    if errores and isinstance(errores, list):
        primero = errores[0] if isinstance(errores[0], dict) else {}
        ext = primero.get("extensions") or {}
        codigo = ext.get("code") or "ERROR_GRAPHQL"
        mensaje = primero.get("message") or "Error en operación GraphQL de ms-gestion"
        status = 403 if codigo in ("FORBIDDEN", "SIN_PERMISO") else 401 if codigo == "UNAUTHENTICATED" else 400
        raise ErrorMcp(status, codigo, mensaje)

    return respuesta.get("data") or {}


class _RegistroMcp:
    """Envoltorio que registra las tools tanto en FastMCP (si está instalado) como en un catálogo local."""

    def __init__(self, nombre: str):
        self.nombre = nombre
        self._tools: dict[str, tuple[Callable, dict[str, Any]]] = {}
        self._fastmcp = None
        try:
            from fastmcp import FastMCP  # type: ignore
            self._fastmcp = FastMCP(nombre)
        except ImportError:
            self._fastmcp = None

    def registrar(self, nombre: str, descripcion: str, parametros: dict[str, Any]):
        def decorador(fn: Callable):
            esquema = {
                "name": nombre,
                "description": descripcion,
                "inputSchema": {
                    "type": "object",
                    "properties": parametros.get("properties", {}),
                    "required": parametros.get("required", []),
                },
            }
            self._tools[nombre] = (fn, esquema)
            if self._fastmcp is not None:
                try:
                    self._fastmcp.tool(name=nombre, description=descripcion)(fn)
                except Exception:
                    pass
            return fn

        return decorador

    def listar_tools(self) -> list[dict[str, Any]]:
        return [esquema for _, esquema in self._tools.values()]

    def ejecutar(self, nombre: str, argumentos: dict[str, Any] | None = None, token: str | None = None) -> Any:
        if nombre not in self._tools:
            raise ErrorMcp(404, "TOOL_NO_ENCONTRADA", f"No existe la tool MCP '{nombre}'")
        fn, _ = self._tools[nombre]
        args = argumentos or {}
        with usar_token_mcp(token if token is not None else obtener_token_actual()):
            return fn(**args)


mcp_servidor = _RegistroMcp("ms-ia")


def _formatear_producto(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "codigo": p["codigo"],
        "nombre": p["nombre"],
        "marca": p.get("marca"),
        "tipo": p.get("tipo"),
        "precio": float(p["precio"]),
    }


_PATRON_CODIGO = re.compile(r"^[A-Za-z]{3}-\d{3}$")


@mcp_servidor.registrar(
    nombre="buscar_producto",
    descripcion="Busca productos en ms-inventario por código, nombre, marca o tipo.",
    parametros={
        "properties": {
            "consulta": {"type": "string", "description": "Código (ej. CER-001), nombre o marca del producto"},
            "tipo": {"type": ["string", "null"], "description": "Filtro opcional por tipo (CERVEZA, WHISKY, RON, SINGANI, VODKA, VINO, OTRO)"},
        },
        "required": [],
    },
)
def buscar_producto(consulta: str = "", tipo: str | None = None) -> list[dict[str, Any]]:
    texto = (consulta or "").strip()
    # Si es un código exacto (ej. CER-001) y no pide filtro de tipo, consulta GET /productos/{codigo}
    if texto and _PATRON_CODIGO.match(texto) and not tipo:
        codigo = texto.upper()
        try:
            prod = _peticion_json(f"{_url_inventario()}/productos/{codigo}", servicio="ms-inventario")
            return [_formatear_producto(prod)] if isinstance(prod, dict) else []
        except ErrorMcp as e:
            if e.status == 404 or e.codigo in ("PRODUCTO_NO_ENCONTRADO", "NO_ENCONTRADO"):
                return []
            raise

    url = f"{_url_inventario()}/productos"
    if tipo:
        url += f"?tipo={urllib.parse.quote(tipo.strip().upper())}"
    productos = _peticion_json(url, servicio="ms-inventario") or []
    if not isinstance(productos, list):
        return []

    if texto:
        busq = texto.lower()
        productos = [
            p for p in productos
            if busq in f"{p.get('codigo', '')} {p.get('nombre', '')} {p.get('marca', '')} {p.get('tipo', '')}".lower()
        ]
    return [_formatear_producto(p) for p in productos]


@mcp_servidor.registrar(
    nombre="stock_actual",
    descripcion="Consulta el stock actual de productos en ms-inventario (permite filtrar por códigos o solo bajo mínimo).",
    parametros={
        "properties": {
            "codigos": {
                "type": ["array", "null"],
                "items": {"type": "string"},
                "description": "Lista opcional de códigos de producto (vacío = todos)",
            },
            "solo_bajo_minimo": {
                "type": "boolean",
                "description": "Si es True, devuelve únicamente los productos con stock bajo el mínimo",
            },
        },
        "required": [],
    },
)
def stock_actual(codigos: list[str] | None = None, solo_bajo_minimo: bool = False) -> list[dict[str, Any]]:
    registros = _peticion_json(f"{_url_inventario()}/stock", servicio="ms-inventario") or []
    if not isinstance(registros, list):
        return []

    filtro_codigos = {c.strip().upper() for c in codigos if c and c.strip()} if codigos else set()
    salida: list[dict[str, Any]] = []
    for s in registros:
        codigo = str(s.get("productoCodigo", "")).upper()
        if filtro_codigos and codigo not in filtro_codigos:
            continue
        cantidad = int(s.get("cantidad", 0))
        reservado = int(s.get("reservado", 0))
        disponible = int(s.get("disponible", cantidad - reservado))
        minimo = int(s.get("minimo", 0))
        bajo_min = bool(s.get("bajoMinimo", cantidad < minimo))
        if solo_bajo_minimo and not bajo_min:
            continue
        salida.append({
            "productoCodigo": codigo,
            "cantidad": cantidad,
            "reservado": reservado,
            "disponible": disponible,
            "minimo": minimo,
        })
    return salida


@mcp_servidor.registrar(
    nombre="ventas_por_periodo",
    descripcion="Consulta en ms-ventas las ventas COMPLETADAS dentro del rango ISO 8601 [desde, hasta).",
    parametros={
        "properties": {
            "desde": {"type": "string", "description": "Fecha/hora inicial en formato ISO 8601"},
            "hasta": {"type": "string", "description": "Fecha/hora final (exclusivo) en formato ISO 8601"},
        },
        "required": ["desde", "hasta"],
    },
)
def ventas_por_periodo(desde: str, hasta: str) -> list[dict[str, Any]]:
    if not desde or not hasta:
        raise ErrorMcp(400, "DATOS_INVALIDOS", "Los parámetros 'desde' y 'hasta' son obligatorios")
    qs = urllib.parse.urlencode({"desde": desde, "hasta": hasta})
    ventas = _peticion_json(f"{_url_ventas()}/ventas?{qs}", servicio="ms-ventas") or []
    if not isinstance(ventas, list):
        return []

    resultado: list[dict[str, Any]] = []
    for v in ventas:
        items = [
            {
                "productoCodigo": i["productoCodigo"],
                "productoNombre": i.get("productoNombre", i["productoCodigo"]),
                "cantidad": int(i["cantidad"]),
                "subtotal": float(i["subtotal"]),
            }
            for i in v.get("items", [])
        ]
        resultado.append({
            "numero": v["numero"],
            "fecha": v["fecha"],
            "total": float(v["total"]),
            "items": items,
        })
    return resultado


@mcp_servidor.registrar(
    nombre="crear_orden_compra",
    descripcion="Crea una orden de compra en ms-gestion mediante la mutation GraphQL crearOrdenCompra (origen: AGENTE).",
    parametros={
        "properties": {
            "proveedorId": {"type": "string", "description": "ID del proveedor en ms-gestion"},
            "lineas": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "productoCodigo": {"type": "string"},
                        "cantidad": {"type": "integer"},
                        "precioUnitario": {"type": "number"},
                    },
                    "required": ["productoCodigo", "cantidad", "precioUnitario"],
                },
            },
        },
        "required": ["proveedorId", "lineas"],
    },
)
def crear_orden_compra(proveedorId: str, lineas: list[dict[str, Any]]) -> dict[str, Any]:
    if not proveedorId or not lineas:
        raise ErrorMcp(400, "DATOS_INVALIDOS", "proveedorId y lineas son obligatorios")

    lineas_limpias = [
        {
            "productoCodigo": str(l["productoCodigo"]).upper(),
            "cantidad": int(l["cantidad"]),
            "precioUnitario": float(l["precioUnitario"]),
        }
        for l in lineas
    ]
    mutation = """
    mutation CrearOrdenCompra($input: OrdenCompraInput!) {
      crearOrdenCompra(input: $input) {
        id
        numero
        total
        estado
      }
    }
    """
    variables = {
        "input": {
            "proveedorId": proveedorId,
            "origen": "AGENTE",
            "lineas": lineas_limpias,
        }
    }
    data = _peticion_graphql(mutation, variables)
    orden = data.get("crearOrdenCompra")
    if not isinstance(orden, dict):
        raise ErrorMcp(502, "ERROR_INTERNO", "ms-gestion no devolvió la orden de compra creada")
    return {
        "id": orden["id"],
        "numero": orden["numero"],
        "total": float(orden["total"]),
        "estado": orden["estado"],
    }


def consultar_proveedores_activos(producto_codigo: str | None = None) -> list[dict[str, Any]]:
    """Consulta en ms-gestion los proveedores activos (y filtra opcionalmente los que suministran producto_codigo)."""
    query = """
    query ProveedoresActivos {
      proveedores(activo: true) {
        id
        nit
        razonSocial
        productos
        activo
      }
    }
    """
    data = _peticion_graphql(query)
    proveedores = data.get("proveedores") or []
    if not isinstance(proveedores, list):
        return []
    if producto_codigo:
        cod = producto_codigo.strip().upper()
        filtrados = [p for p in proveedores if cod in [str(x).upper() for x in (p.get("productos") or [])]]
        if filtrados:
            return filtrados
    return proveedores

