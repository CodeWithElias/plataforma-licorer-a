"""Agente de Reabastecimiento Automático (CU06) implementado como Grafo de Estados (LangGraph).

Flujo de nodos (ver docs/tools-mcp.md y docs/acuerdos-integracion.md):
1. consultar_contexto_mcp -> stock_actual, buscar_producto y ventas_por_periodo (últimos 30 días).
2. calcular_pedido_y_justificar -> calcula cantidad óptima a reponer y redacta justificación (Ollama / Plan B).
3. buscar_proveedor -> consulta proveedores activos en ms-gestion para el producto.
4. emitir_orden_compra -> invoca la tool MCP crear_orden_compra (origen: AGENTE).
"""

import datetime as dt
import json
import logging
import time
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agentes.llm import ConstructorGrafo, chat_ollama, consultar_ollama, llm_disponible
from app.mcp import ErrorMcp, consultar_proveedores_activos, usar_token_mcp
from app.mcp.cliente import buscar_producto, crear_orden_compra, listar_tools, llamar_tool, stock_actual, ventas_por_periodo

log = logging.getLogger(__name__)


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
    # Solo el agente con LLM
    mensajes: list[dict[str, Any]]
    vueltas: int
    limite: float
    crearOrden: bool
    herramientasUsadas: list[str]


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


# ---------- Agente con LLM: decide qué consultar y si conviene pedir ----------
MAX_VUELTAS = 2
TIEMPO_MAXIMO_AGENTE = 240   # segundos; n8n espera 300. Si se pasa, el aviso sigue por el plan B
TOOLS_DE_CONSULTA = ("buscar_producto", "stock_actual", "ventas_por_periodo")
LARGO_MAXIMO_RESULTADO = 2500

SISTEMA_AGENTE = """Eres el agente de reabastecimiento de una licorería en Bolivia. Recibes un aviso de stock bajo y decides
si conviene pedir mercadería y cuánto. Antes de decidir revisa con la herramienta ventas_por_periodo cuánto se vendió en
los últimos 30 días, y usa otras herramientas si necesitas algo más. No inventes datos. Cuando ya sepas lo suficiente, deja
de usar herramientas y da tu conclusión en una frase."""

INSTRUCCION_DECISION = """Con lo que revisaste, responde solo con este objeto JSON:
{"crearOrden": true o false, "cantidad": unidades a pedir (entero, suficiente para volver a superar el mínimo y cubrir las ventas que esperas; 0 si no conviene pedir), "motivo": "una frase en español que explique la decisión con los datos"}"""


def _tools_para_el_llm() -> list[dict[str, Any]]:
    return [
        {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["inputSchema"]}}
        for t in listar_tools()
        if t["name"] in TOOLS_DE_CONSULTA
    ]


def _tiempo_restante(estado: EstadoReabastecimiento) -> float:
    restante = estado["limite"] - time.monotonic()
    if restante <= 0:
        raise TimeoutError("El agente se quedó sin tiempo")
    return restante


def _resumir_resultado(nombre: str, resultado: Any, codigo: str) -> Any:
    """El LLM en CPU se vuelve muy lento con textos largos: del historial solo recibe lo de este producto."""
    if nombre != "ventas_por_periodo":
        return resultado
    lineas = [i for v in resultado or [] for i in v.get("items", []) if str(i.get("productoCodigo", "")).upper() == codigo]
    return {"productoCodigo": codigo, "ventasConEsteProducto": len(lineas), "unidadesVendidas": sum(int(i.get("cantidad", 0)) for i in lineas)}


def _nodo_contexto_llm(estado: EstadoReabastecimiento) -> dict[str, Any]:
    """Los datos que el agente no debe adivinar salen de las tools: stock real y precio de compra."""
    contexto = _nodo_consultar_contexto_mcp(estado)
    ahora = dt.datetime.now(dt.timezone.utc)
    aviso = (
        f"Aviso de stock bajo: {contexto['nombre']} ({contexto['productoCodigo']}). "
        f"Quedan {contexto['cantidad']} unidades y el mínimo es {contexto['minimo']}. "
        f"Últimos 30 días: desde {(ahora - dt.timedelta(days=30)).isoformat(timespec='seconds')} "
        f"hasta {ahora.isoformat(timespec='seconds')}."
    )
    contexto.update({
        "mensajes": [{"role": "system", "content": SISTEMA_AGENTE}, {"role": "user", "content": aviso}],
        "vueltas": 0,
        "limite": time.monotonic() + TIEMPO_MAXIMO_AGENTE,
        "herramientasUsadas": [],
    })
    return contexto


def _nodo_pensar(estado: EstadoReabastecimiento) -> dict[str, Any]:
    mensaje = chat_ollama(estado["mensajes"], tools=_tools_para_el_llm(), timeout=_tiempo_restante(estado))
    return {"mensajes": [*estado["mensajes"], mensaje], "vueltas": estado["vueltas"] + 1}


def _siguiente_tras_pensar(estado: EstadoReabastecimiento) -> str:
    quiere_tools = bool(estado["mensajes"][-1].get("tool_calls"))
    return "usar_tools" if quiere_tools and estado["vueltas"] < MAX_VUELTAS else "decidir"


def _nodo_usar_tools(estado: EstadoReabastecimiento) -> dict[str, Any]:
    mensajes = list(estado["mensajes"])
    usadas = list(estado["herramientasUsadas"])
    for llamada in mensajes[-1].get("tool_calls", []):
        nombre = llamada["function"]["name"]
        try:
            if nombre not in TOOLS_DE_CONSULTA:
                raise ErrorMcp(403, "TOOL_NO_PERMITIDA", f"El agente no puede usar {nombre} en este paso")
            datos = llamar_tool(nombre, llamada["function"].get("arguments") or {})
            resultado = json.dumps(_resumir_resultado(nombre, datos, estado["productoCodigo"]), ensure_ascii=False)
            usadas.append(nombre)
        except ErrorMcp as e:
            resultado = json.dumps({"error": e.codigo, "mensaje": e.mensaje}, ensure_ascii=False)
        mensajes.append({"role": "tool", "tool_name": nombre, "content": resultado[:LARGO_MAXIMO_RESULTADO]})
    return {"mensajes": mensajes, "herramientasUsadas": usadas}


def _nodo_decidir(estado: EstadoReabastecimiento) -> dict[str, Any]:
    mensaje = chat_ollama(
        [*estado["mensajes"], {"role": "user", "content": INSTRUCCION_DECISION}], formato_json=True, timeout=_tiempo_restante(estado)
    )
    decision = json.loads(mensaje.get("content") or "{}")
    crear = decision.get("crearOrden") is True
    cantidad = decision.get("cantidad")
    # Lo que decide el modelo no pasa sin validar: debe volver a superar el mínimo y sin exceder el doble de lo vendido
    minimo = int(estado["minimo"])
    deficit = max(1, minimo - int(estado["cantidad"]) + 1)
    por_defecto = deficit + minimo
    tope = max(por_defecto, 2 * int(estado.get("unidadesVendidas30d", 0)))
    sugerida = cantidad if isinstance(cantidad, int) and not isinstance(cantidad, bool) and deficit <= cantidad <= tope else por_defecto
    motivo = str(decision.get("motivo") or "").strip() or f"Stock de {estado['nombre']} bajo el mínimo."
    return {"crearOrden": crear, "cantidadSugerida": sugerida if crear else 0, "motivo": motivo}


def _siguiente_tras_contexto(estado: EstadoReabastecimiento) -> str:
    # Regla de seguridad: un aviso viejo no compra nada. Si el stock real no está bajo el mínimo, ni se consulta al LLM
    return "sin_necesidad" if int(estado["cantidad"]) >= int(estado["minimo"]) else "pensar"


def _nodo_sin_necesidad(estado: EstadoReabastecimiento) -> dict[str, Any]:
    return {
        "crearOrden": False,
        "motivo": f"El stock actual de {estado['nombre']} ({estado['cantidad']}) ya es igual o mayor al mínimo ({estado['minimo']}); no requiere reposición.",
    }


def _siguiente_tras_decidir(estado: EstadoReabastecimiento) -> str:
    return "buscar_proveedor" if estado.get("crearOrden") else END


def _construir_grafo_agente():
    g = StateGraph(EstadoReabastecimiento)
    g.add_node("contexto", _nodo_contexto_llm)
    g.add_node("pensar", _nodo_pensar)
    g.add_node("usar_tools", _nodo_usar_tools)
    g.add_node("decidir", _nodo_decidir)
    g.add_node("buscar_proveedor", _nodo_buscar_proveedor)
    g.add_node("emitir_orden_compra", _nodo_emitir_orden_compra)
    g.add_edge(START, "contexto")
    g.add_node("sin_necesidad", _nodo_sin_necesidad)
    g.add_conditional_edges("contexto", _siguiente_tras_contexto, ["pensar", "sin_necesidad"])
    g.add_edge("sin_necesidad", END)
    g.add_conditional_edges("pensar", _siguiente_tras_pensar, ["usar_tools", "decidir"])
    g.add_edge("usar_tools", "pensar")
    g.add_conditional_edges("decidir", _siguiente_tras_decidir, ["buscar_proveedor", END])
    g.add_edge("buscar_proveedor", "emitir_orden_compra")
    g.add_edge("emitir_orden_compra", END)
    return g.compile()


_grafo_agente = _construir_grafo_agente()


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
    decidido_por = "reglas"
    with usar_token_mcp(token):
        final = None
        if llm_disponible():
            try:
                final = _grafo_agente.invoke(estado_inicial)
                decidido_por = "llm"
            except Exception as e:   # Ollama lento o caído, JSON inválido: el aviso no se puede perder
                log.warning("El agente con LLM falló (%s); se usa el plan B por reglas", e)
        if final is None:
            final = _grafo_reabastecimiento.invoke(estado_inicial)

    respuesta: dict[str, Any] = {
        "ordenCreada": bool(final.get("ordenCreada", False)),
        "motivo": final.get("motivo", ""),
        "decididoPor": decidido_por,
        "herramientasUsadas": final.get("herramientasUsadas", []),
    }
    if final.get("ordenCreada"):
        respuesta["numero"] = final.get("numero")
        respuesta["lineas"] = final.get("lineas", [])
    else:
        respuesta["lineas"] = []
    return respuesta

