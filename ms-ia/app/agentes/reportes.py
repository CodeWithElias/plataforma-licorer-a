"""Agente de Reportes Generativos por Lenguaje Natural (CU07) con LangGraph y Tools MCP.

Flujo de nodos (ver docs/tools-mcp.md, docs/openapi.yaml y n8n/workflows/cu07-reporte-diario.json):
1. interpretar_peticion -> identifica fuente (ventas vs stock), rango de fechas, filtro de producto/tipo y tipoGrafico.
2. ejecutar_tools_mcp -> invoca ventas_por_periodo, stock_actual y/o buscar_producto y construye {columnas, datos}.
3. generar_resumen_ejecutivo -> redacta el resumen en lenguaje natural con Ollama (o síntesis determinista Plan B).
"""

import datetime as dt
import re
from typing import Any, TypedDict

from app.agentes.llm import ConstructorGrafo, consultar_json, consultar_ollama
from app.mcp import usar_token_mcp
from app.mcp.cliente import buscar_producto, stock_actual, ventas_por_periodo


class EstadoReporte(TypedDict, total=False):
    consulta: str
    desde: str
    hasta: str
    fuente: str                  # "ventas" | "stock"
    agrupacion: str              # "producto" | "fecha"
    tipoFiltro: str | None       # CERVEZA, WHISKY, RON, SINGANI, VODKA, VINO
    soloBajoMinimo: bool
    tipoGrafico: str             # "barras" | "lineas" | "torta" | "tabla"
    columnas: list[str]
    datos: list[list[Any]]
    totalGeneral: float
    unidadesTotales: int
    resumen: str
    reporteId: str | None
    interpretadoPor: str         # "llm" | "reglas"


_MAPA_TIPOS = {
    "cerveza": "CERVEZA",
    "cervezas": "CERVEZA",
    "whisky": "WHISKY",
    "whiskies": "WHISKY",
    "ron": "RON",
    "rones": "RON",
    "singani": "SINGANI",
    "singanis": "SINGANI",
    "vodka": "VODKA",
    "vodkas": "VODKA",
    "vino": "VINO",
    "vinos": "VINO",
}


def _detectar_tipo_grafico(texto: str, agrupacion: str) -> str:
    q = texto.lower()
    if any(p in q for p in ("linea", "línea", "evolucion", "evolución", "tendencia", "serie")):
        return "lineas"
    if any(p in q for p in ("torta", "pastel", "circular", "pie", "proporcion", "proporción")):
        return "torta"
    if any(p in q for p in ("tabla", "listado", "detalle en tabla")):
        return "tabla"
    if "barra" in q:
        return "barras"
    return "lineas" if agrupacion == "fecha" else "barras"


def _detectar_rango_fechas(texto: str, desde_explicito: str | None, hasta_explicito: str | None) -> tuple[str, str]:
    if desde_explicito and hasta_explicito:
        return desde_explicito, hasta_explicito

    ahora = dt.datetime.now(dt.timezone.utc)
    q = texto.lower()

    # Si menciona una fecha explícita AAAA-MM-DD (como hace n8n: "Ventas del día 2026-11-01 por producto")
    m_fecha = re.search(r"(\d{4}-\d{2}-\d{2})", q)
    if m_fecha:
        dia_str = m_fecha.group(1)
        dia_dt = dt.datetime.fromisoformat(f"{dia_str}T00:00:00-04:00")
        sig_dt = dia_dt + dt.timedelta(days=1)
        return dia_dt.isoformat(), sig_dt.isoformat()

    if "hoy" in q or "día de hoy" in q or "dia de hoy" in q:
        bolivia = dt.timezone(dt.timedelta(hours=-4))
        inicio = ahora.astimezone(bolivia).replace(hour=0, minute=0, second=0, microsecond=0)
    elif "mes" in q or "30 d" in q or "treinta d" in q:
        inicio = ahora - dt.timedelta(days=30)
    elif "año" in q or "anio" in q or "anual" in q:
        inicio = ahora - dt.timedelta(days=365)
    else:
        # Por defecto: última semana (7 días)
        inicio = ahora - dt.timedelta(days=7)

    return (
        desde_explicito or inicio.isoformat(timespec="seconds"),
        hasta_explicito or ahora.isoformat(timespec="seconds"),
    )


SISTEMA_INTERPRETE = """Eres el intérprete de pedidos de reportes de una licorería. Conviertes el pedido del gerente,
escrito o dictado con sus propias palabras, en un objeto JSON con exactamente estas claves:
- "fuente": "ventas" si pregunta por lo vendido, ingresos o recaudación; "stock" si pregunta por lo que hay, lo que queda, lo que se acaba o el inventario.
- "agrupacion": "fecha" solo si pide la evolución, la tendencia o el detalle por día; en cualquier otro caso, "producto".
- "tipoFiltro": "CERVEZA", "VINO", "SINGANI", "RON", "WHISKY", "VODKA" u "OTRO" si pide un tipo de bebida; si no, null.
- "soloBajoMinimo": true solo si pide lo que está por agotarse, bajo el mínimo o por reponer.
- "tipoGrafico": "barras", "lineas", "torta" o "tabla". Si no lo pide, elige el más adecuado.
- "periodo": "hoy", "ayer", "semana", "mes" o "anio". Si no lo dice, "semana".
Ejemplos:
"qué se está por acabar" -> {"fuente":"stock","agrupacion":"producto","tipoFiltro":null,"soloBajoMinimo":true,"tipoGrafico":"tabla","periodo":"semana"}
"cuánto queda de whisky" -> {"fuente":"stock","agrupacion":"producto","tipoFiltro":"WHISKY","soloBajoMinimo":false,"tipoGrafico":"barras","periodo":"semana"}
"ventas de ron de este mes" -> {"fuente":"ventas","agrupacion":"producto","tipoFiltro":"RON","soloBajoMinimo":false,"tipoGrafico":"barras","periodo":"mes"}
"cómo fueron las ventas día a día esta semana" -> {"fuente":"ventas","agrupacion":"fecha","tipoFiltro":null,"soloBajoMinimo":false,"tipoGrafico":"lineas","periodo":"semana"}
Responde solo con el objeto JSON."""


def _rango_de_periodo(periodo: str) -> tuple[str, str]:
    bolivia = dt.timezone(dt.timedelta(hours=-4))
    ahora = dt.datetime.now(bolivia)
    hoy = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    if periodo == "hoy":
        return hoy.isoformat(), ahora.isoformat(timespec="seconds")
    if periodo == "ayer":
        return (hoy - dt.timedelta(days=1)).isoformat(), hoy.isoformat()
    dias = {"mes": 30, "anio": 365}.get(periodo, 7)
    return (ahora - dt.timedelta(days=dias)).isoformat(timespec="seconds"), ahora.isoformat(timespec="seconds")


def _interpretar_con_llm(consulta: str) -> dict[str, Any]:
    """Los campos que el LLM devolvió bien; lo inválido se ignora y queda lo que resolvieron las reglas."""
    r = consultar_json(f'Pedido: "{consulta}"', SISTEMA_INTERPRETE)
    if not r:
        return {}
    valido: dict[str, Any] = {"interpretadoPor": "llm"}
    if r.get("fuente") in ("ventas", "stock"):
        valido["fuente"] = r["fuente"]
    if r.get("agrupacion") in ("producto", "fecha"):
        valido["agrupacion"] = r["agrupacion"]
    if r.get("tipoFiltro") is None or r.get("tipoFiltro") in ("CERVEZA", "VINO", "SINGANI", "RON", "WHISKY", "VODKA", "OTRO"):
        valido["tipoFiltro"] = r.get("tipoFiltro")
    if isinstance(r.get("soloBajoMinimo"), bool):
        valido["soloBajoMinimo"] = r["soloBajoMinimo"]
    if r.get("tipoGrafico") in ("barras", "lineas", "torta", "tabla"):
        valido["tipoGrafico"] = r["tipoGrafico"]
    # Una fecha escrita en el pedido la resuelven las reglas: es exacta y no depende del modelo
    if not re.search(r"\d{4}-\d{2}-\d{2}", consulta) and r.get("periodo") in ("hoy", "ayer", "semana", "mes", "anio"):
        valido["desde"], valido["hasta"] = _rango_de_periodo(r["periodo"])
    return valido


def _nodo_interpretar_peticion(estado: EstadoReporte) -> dict[str, Any]:
    consulta = estado.get("consulta", "").strip()
    q = consulta.lower()

    es_stock = any(p in q for p in ("stock", "inventario", "existencia", "almacén", "almacen", "bajo mínimo", "bajo minimo", "agotar"))
    solo_bajo = any(p in q for p in ("bajo", "mínimo", "minimo", "crítico", "critico", "faltante", "reponer"))

    agrupacion = "fecha" if any(p in q for p in ("por fecha", "por día", "por dia", "evolución", "evolucion", "tendencia")) else "producto"
    tipo_grafico = _detectar_tipo_grafico(q, agrupacion)

    tipo_filtro = None
    for palabra, codigo_tipo in _MAPA_TIPOS.items():
        if re.search(rf"\b{palabra}\b", q):
            tipo_filtro = codigo_tipo
            break

    desde, hasta = _detectar_rango_fechas(consulta, estado.get("desde"), estado.get("hasta"))
    interpretacion = {
        "fuente": "stock" if es_stock else "ventas",
        "agrupacion": agrupacion,
        "tipoFiltro": tipo_filtro,
        "soloBajoMinimo": solo_bajo,
        "tipoGrafico": tipo_grafico,
        "desde": desde,
        "hasta": hasta,
        "interpretadoPor": "reglas",
    }
    interpretacion.update(_interpretar_con_llm(consulta))
    if estado.get("desde") and estado.get("hasta"):   # fechas explícitas de quien llama
        interpretacion["desde"], interpretacion["hasta"] = estado["desde"], estado["hasta"]
    return interpretacion


def _nodo_ejecutar_tools_mcp(estado: EstadoReporte) -> dict[str, Any]:
    fuente = estado.get("fuente", "ventas")
    tipo_filtro = estado.get("tipoFiltro")

    # Catálogo opcional para enriquecer nombres o filtrar por tipo de bebida
    mapa_catalogo: dict[str, dict[str, Any]] = {}
    codigos_permitidos: set[str] | None = None
    if tipo_filtro or fuente == "stock":
        prods = buscar_producto("", tipo=tipo_filtro)
        mapa_catalogo = {str(p["codigo"]).upper(): p for p in prods}
        if tipo_filtro:
            codigos_permitidos = set(mapa_catalogo.keys())

    if fuente == "stock":
        registros = stock_actual(
            codigos=list(codigos_permitidos) if codigos_permitidos is not None else None,
            solo_bajo_minimo=bool(estado.get("soloBajoMinimo", False)),
        )
        filas: list[list[Any]] = []
        unidades_totales = 0
        for s in sorted(registros, key=lambda x: int(x.get("disponible", 0))):
            cod = s["productoCodigo"]
            nombre_prod = mapa_catalogo.get(cod, {}).get("nombre")
            etiqueta = f"{nombre_prod} ({cod})" if nombre_prod else cod
            disp = int(s.get("disponible", 0))
            minimo = int(s.get("minimo", 0))
            unidades_totales += disp
            filas.append([etiqueta, disp, minimo])

        return {
            "columnas": ["Producto", "Disponible", "Mínimo"],
            "datos": filas,
            "totalGeneral": 0.0,
            "unidadesTotales": unidades_totales,
        }

    # Fuente: ventas_por_periodo
    ventas = ventas_por_periodo(desde=estado["desde"], hasta=estado["hasta"])
    if estado.get("agrupacion") == "fecha":
        por_dia: dict[str, list[ float | int ]] = {}
        total_general = 0.0
        unidades_totales = 0
        for v in ventas:
            fecha_dia = str(v.get("fecha", ""))[:10] or "Sin fecha"
            subtotal_venta = 0.0
            unidades_venta = 0
            for item in v.get("items", []):
                cod = str(item.get("productoCodigo", "")).upper()
                if codigos_permitidos is not None and cod not in codigos_permitidos:
                    continue
                unidades_venta += int(item.get("cantidad", 0))
                subtotal_venta += float(item.get("subtotal", 0.0))
            if unidades_venta > 0 or codigos_permitidos is None:
                acum = por_dia.setdefault(fecha_dia, [0, 0.0])
                acum[0] = int(acum[0]) + max(1, unidades_venta)
                acum[1] = round(float(acum[1]) + (subtotal_venta if codigos_permitidos is not None else float(v.get("total", 0.0))), 2)
                total_general += subtotal_venta if codigos_permitidos is not None else float(v.get("total", 0.0))
                unidades_totales += unidades_venta

        filas_fecha = [[dia, vals[0], round(float(vals[1]), 2)] for dia, vals in sorted(por_dia.items())]
        return {
            "columnas": ["Fecha", "Unidades", "Monto (Bs)"],
            "datos": filas_fecha,
            "totalGeneral": round(total_general, 2),
            "unidadesTotales": unidades_totales,
        }

    # Agrupación por producto (estándar para CU07 y reporte diario de n8n)
    por_producto: dict[str, dict[str, Any]] = {}
    total_general = 0.0
    unidades_totales = 0
    for v in ventas:
        for item in v.get("items", []):
            cod = str(item.get("productoCodigo", "")).upper()
            if codigos_permitidos is not None and cod not in codigos_permitidos:
                continue
            nombre = item.get("productoNombre") or mapa_catalogo.get(cod, {}).get("nombre") or cod
            cant = int(item.get("cantidad", 0))
            sub = float(item.get("subtotal", 0.0))
            reg = por_producto.setdefault(cod, {"nombre": nombre, "cantidad": 0, "monto": 0.0})
            reg["cantidad"] += cant
            reg["monto"] = round(reg["monto"] + sub, 2)
            total_general += sub
            unidades_totales += cant

    ordenados = sorted(por_producto.items(), key=lambda par: par[1]["monto"], reverse=True)
    filas_prod = [
        [f"{info['nombre']} ({cod})", int(info["cantidad"]), round(float(info["monto"]), 2)]
        for cod, info in ordenados
    ]
    return {
        "columnas": ["Producto", "Unidades", "Monto (Bs)"],
        "datos": filas_prod,
        "totalGeneral": round(total_general, 2),
        "unidadesTotales": unidades_totales,
    }


def _nodo_generar_resumen_ejecutivo(estado: EstadoReporte) -> dict[str, Any]:
    datos = estado.get("datos", [])
    fuente = estado.get("fuente", "ventas")
    consulta = estado.get("consulta", "")

    if not datos:
        resumen_vacio = (
            "No se encontraron productos con stock para el criterio solicitado."
            if fuente == "stock"
            else "No se registraron ventas completadas en el periodo consultado."
        )
        return {"resumen": resumen_vacio, "reporteId": None}

    if fuente == "stock":
        bajos = sum(1 for fila in datos if len(fila) >= 3 and int(fila[1]) < int(fila[2]))
        resumen_base = (
            f"Se consultaron {len(datos)} productos en inventario ({estado.get('unidadesTotales', 0)} unidades disponibles en total). "
            f"Productos bajo el stock mínimo: {bajos}."
        )
    else:
        lider = datos[0]
        total_bs = estado.get("totalGeneral", 0.0)
        unidades = estado.get("unidadesTotales", 0)
        resumen_base = (
            f"Total vendido en el periodo: Bs {total_bs:.2f} ({unidades} unidades en {len(datos)} categorías/productos). "
            f"Mayor recaudación: {lider[0]} con Bs {float(lider[2]):.2f} ({lider[1]} unidades)."
        )

    prompt = (
        f"Consulta del gerente: '{consulta}'. "
        f"Datos calculados: total Bs {estado.get('totalGeneral', 0.0):.2f}, "
        f"{estado.get('unidadesTotales', 0)} unidades, líder '{datos[0][0] if fuente != 'stock' else ''}'. "
        f"Resumen base: {resumen_base}. "
        "Redacta un resumen ejecutivo breve, claro y profesional, sin cambiar ninguna cifra, "
        "nombre, unidad ni dato del resumen base."
    )
    resumen_llm = consultar_ollama(
        prompt,
        sistema="Eres el analista de inteligencia de negocios de una licorería. Responde en español en máximo 2 oraciones.",
    )

    total_texto = f"{estado.get('totalGeneral', 0.0):.2f}"
    unidades_texto = str(estado.get("unidadesTotales", 0))
    llm_valido = (
        bool(resumen_llm)
        and total_texto in resumen_llm
        and unidades_texto in resumen_llm
        and (fuente == "stock" or str(datos[0][0]) in resumen_llm)
    )
    return {
        "resumen": resumen_llm if llm_valido else resumen_base,
        "reporteId": None,
    }


def _construir_grafo_reportes():
    constructor = ConstructorGrafo(EstadoReporte)
    constructor.agregar_nodo("interpretar_peticion", _nodo_interpretar_peticion)
    constructor.agregar_nodo("ejecutar_tools_mcp", _nodo_ejecutar_tools_mcp)
    constructor.agregar_nodo("generar_resumen_ejecutivo", _nodo_generar_resumen_ejecutivo)
    return constructor.compilar()


_grafo_reportes = _construir_grafo_reportes()


def ejecutar_agente_reportes(
    consulta: str,
    desde: str | None = None,
    hasta: str | None = None,
    token: str = "",
) -> dict[str, Any]:
    """Ejecuta el grafo LangGraph de CU07 reenviando el token Bearer a las tools MCP."""
    estado_inicial: EstadoReporte = {
        "consulta": consulta,
    }
    if desde:
        estado_inicial["desde"] = desde
    if hasta:
        estado_inicial["hasta"] = hasta

    with usar_token_mcp(token):
        final = _grafo_reportes.invoke(estado_inicial)

    return {
        "columnas": final.get("columnas", ["Producto", "Unidades", "Monto (Bs)"]),
        "datos": final.get("datos", []),
        "tipoGrafico": final.get("tipoGrafico", "barras"),
        "resumen": final.get("resumen", ""),
        "reporteId": final.get("reporteId"),
        "interpretadoPor": final.get("interpretadoPor", "reglas"),
    }
