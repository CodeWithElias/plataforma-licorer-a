"""Agente de Reabastecimiento Automático (CU06) implementado como Grafo de Estados (LangGraph).

Flujo de nodos (ver docs/tools-mcp.md y docs/acuerdos-integracion.md):
1. consultar_contexto_mcp -> stock_actual, buscar_producto y ventas_por_periodo (últimos 30 días).
2. calcular_pedido_y_justificar -> calcula cantidad óptima a reponer y redacta justificación (Ollama / Plan B).
3. buscar_proveedor -> consulta proveedores activos en ms-gestion para el producto.
4. emitir_orden_compra -> invoca la tool MCP crear_orden_compra (origen: AGENTE).
"""

import datetime as dt
from typing import Any, TypedDict

from app.agentes.llm import ConstructorGrafo, consultar_ollama
from app.mcp import (
    ErrorMcp,
    buscar_producto,
    consultar_proveedores_activos,
    crear_orden_compra,
    stock_actual,
    usar_token_mcp,
    ventas_por_periodo,
)


class EstadoReabastecimiento(TypedDict, total=False):
    productoCodigo: str
    nombre: str
    cantidad: int
    minimo: int
    precioCatalogo: float
    precioUnitarioCompra: float
    unidadesVendidas30d: int
    cantidadSugerida: int
    proveedorId: str | None
    proveedorNombre: str | None
    ordenCreada: bool
    numero: str | None
    lineas: list[dict[str, Any]]
    motivo: str


def _nodo_consultar_contexto_mcp(estado: EstadoReabastecimiento) -> dict[str, Any]:
    codigo = estado["productoCodigo"].strip().upper()
    nombre = estado.get("nombre") or codigo
    cantidad = int(estado.get("cantidad", 0))
    minimo = int(estado.get("minimo", 1))
    precio_catalogo = 30.0

    # 1. Consultar stock actual real por tool MCP
    try:
        stocks = stock_actual(codigos=[codigo])
        if stocks:
            cantidad = int(stocks[0].get("cantidad", cantidad))
            minimo = int(stocks[0].get("minimo", minimo))
    except ErrorMcp:
        pass

    # 2. Consultar datos del producto (nombre y precio de referencia) por tool MCP
    try:
        prods = buscar_producto(codigo)
        if prods:
            nombre = prods[0].get("nombre") or nombre
            precio_catalogo = float(prods[0].get("precio", precio_catalogo))
    except ErrorMcp:
        pass

    # 3. Consultar historial de ventas de los últimos 30 días por tool MCP
    ahora = dt.datetime.now(dt.timezone.utc)
    hace_30d = ahora - dt.timedelta(days=30)
    vendidas_30d = 0
    try:
        ventas = ventas_por_periodo(
            desde=hace_30d.isoformat(timespec="seconds"),
            hasta=ahora.isoformat(timespec="seconds"),
        )
        for v in ventas:
            for item in v.get("items", []):
                if str(item.get("productoCodigo", "")).upper() == codigo:
                    vendidas_30d += int(item.get("cantidad", 0))
    except ErrorMcp:
        vendidas_30d = 0

    costo_compra = round(max(1.0, precio_catalogo * 0.70), 2)
    return {
        "productoCodigo": codigo,
        "nombre": nombre,
        "cantidad": cantidad,
        "minimo": minimo,
        "precioCatalogo": precio_catalogo,
        "precioUnitarioCompra": costo_compra,
        "unidadesVendidas30d": vendidas_30d,
    }


def _nodo_calcular_pedido_y_justificar(estado: EstadoReabastecimiento) -> dict[str, Any]:
    codigo = estado["productoCodigo"]
    nombre = estado["nombre"]
    cantidad = estado["cantidad"]
    minimo = estado["minimo"]
    vendidas = estado.get("unidadesVendidas30d", 0)

    if cantidad >= minimo:
        return {
            "cantidadSugerida": 0,
            "motivo": f"El stock actual de {nombre} ({cantidad}) ya es igual o mayor al mínimo ({minimo}); no requiere reposición.",
        }

    deficit = max(1, minimo - cantidad)
    # Sugiere reponer el déficit más un colchón igual al mínimo o la demanda de 30 días
    sugerida = max(deficit + minimo, vendidas, 6)

    prompt = (
        f"Producto: {nombre} ({codigo}). Stock actual: {cantidad}, mínimo: {minimo}. "
        f"Ventas últimos 30 días: {vendidas} unidades. Cantidad sugerida a pedir: {sugerida} unidades. "
        "Redacta en una sola oración breve en español el motivo de esta orden de reabastecimiento."
    )
    justificacion_llm = consultar_ollama(
        prompt,
        sistema="Eres el agente de reabastecimiento de una licorería. Responde en 1 oración concisa en español.",
    )
    motivo = justificacion_llm or (
        f"Stock crítico de {nombre} ({cantidad}/{minimo}); se sugieren {sugerida} unidades "
        f"considerando {vendidas} unidades vendidas en los últimos 30 días."
    )
    return {
        "cantidadSugerida": sugerida,
        "motivo": motivo,
    }


def _nodo_buscar_proveedor(estado: EstadoReabastecimiento) -> dict[str, Any]:
    if estado.get("cantidadSugerida", 0) <= 0:
        return {"proveedorId": None, "proveedorNombre": None}

    codigo = estado["productoCodigo"]
    try:
        proveedores = consultar_proveedores_activos(codigo)
    except ErrorMcp as e:
        return {
            "proveedorId": None,
            "proveedorNombre": None,
            "motivo": f"No se pudo consultar proveedores en ms-gestion ({e.codigo}): {e.mensaje}",
        }

    if not proveedores:
        return {
            "proveedorId": None,
            "proveedorNombre": None,
            "motivo": f"No existe ningún proveedor activo en ms-gestion para abastecer {estado['nombre']} ({codigo}).",
        }

    elegido = proveedores[0]
    return {
        "proveedorId": str(elegido["id"]),
        "proveedorNombre": elegido.get("razonSocial", str(elegido["id"])),
    }


def _nodo_emitir_orden_compra(estado: EstadoReabastecimiento) -> dict[str, Any]:
    sugerida = int(estado.get("cantidadSugerida", 0))
    proveedor_id = estado.get("proveedorId")

    if sugerida <= 0 or not proveedor_id:
        return {
            "ordenCreada": False,
            "numero": None,
            "lineas": [],
        }

    linea = {
        "productoCodigo": estado["productoCodigo"],
        "cantidad": sugerida,
        "precioUnitario": float(estado["precioUnitarioCompra"]),
    }
    try:
        orden = crear_orden_compra(proveedorId=proveedor_id, lineas=[linea])
        return {
            "ordenCreada": True,
            "numero": orden["numero"],
            "lineas": [linea],
            "motivo": estado.get("motivo", ""),
        }
    except ErrorMcp as e:
        return {
            "ordenCreada": False,
            "numero": None,
            "lineas": [],
            "motivo": f"No se pudo crear la orden de compra en ms-gestion ({e.codigo}): {e.mensaje}",
        }


def _construir_grafo_reabastecimiento():
    constructor = ConstructorGrafo(EstadoReabastecimiento)
    constructor.agregar_nodo("consultar_contexto_mcp", _nodo_consultar_contexto_mcp)
    constructor.agregar_nodo("calcular_pedido_y_justificar", _nodo_calcular_pedido_y_justificar)
    constructor.agregar_nodo("buscar_proveedor", _nodo_buscar_proveedor)
    constructor.agregar_nodo("emitir_orden_compra", _nodo_emitir_orden_compra)
    return constructor.compilar()


_grafo_reabastecimiento = _construir_grafo_reabastecimiento()


def ejecutar_agente_reabastecimiento(
    producto_codigo: str,
    cantidad: int,
    minimo: int,
    nombre: str | None = None,
    token: str = "",
) -> dict[str, Any]:
    """Ejecuta el grafo LangGraph de CU06 reenviando el token Bearer a las tools MCP."""
    estado_inicial: EstadoReabastecimiento = {
        "productoCodigo": producto_codigo.strip().upper(),
        "nombre": nombre or producto_codigo.strip().upper(),
        "cantidad": int(cantidad),
        "minimo": int(minimo),
    }
    with usar_token_mcp(token):
        final = _grafo_reabastecimiento.invoke(estado_inicial)

    respuesta: dict[str, Any] = {
        "ordenCreada": bool(final.get("ordenCreada", False)),
        "motivo": final.get("motivo", ""),
    }
    if final.get("ordenCreada"):
        respuesta["numero"] = final.get("numero")
        respuesta["lineas"] = final.get("lineas", [])
    else:
        respuesta["lineas"] = []
    return respuesta

