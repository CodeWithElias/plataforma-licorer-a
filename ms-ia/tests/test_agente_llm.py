"""El agente de reabastecimiento decide con el LLM, pero sus reglas de seguridad tienen la última palabra (CU06 / R04)."""

import json

import pytest

from app.agentes import reabastecimiento, reportes
from app.mcp import servidor as srv_mod


class _Respuesta:
    def __init__(self, payload):
        self._bytes = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._bytes

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _servicios(cantidad=2, minimo=3):
    ordenes = []

    def urlopen(req, timeout=10):
        url = req.full_url
        if url.endswith("/stock"):
            return _Respuesta([{"productoCodigo": "RON-002", "cantidad": cantidad, "reservado": 0, "disponible": cantidad, "minimo": minimo}])
        if url.endswith("/productos/RON-002"):
            return _Respuesta({"codigo": "RON-002", "nombre": "Ron Abuelo", "marca": "Abuelo", "tipo": "RON", "precio": 100.0})
        if "/ventas?" in url:
            return _Respuesta([{"numero": 1, "fecha": "2026-10-28T15:00:00Z", "total": 1000.0, "items": [
                {"productoCodigo": "RON-002", "productoNombre": "Ron Abuelo", "cantidad": 10, "subtotal": 1000.0}]}])
        cuerpo = json.loads(req.data.decode("utf-8"))
        if "ProveedoresActivos" in cuerpo["query"]:
            return _Respuesta({"data": {"proveedores": [{"id": "p1", "nit": "1", "razonSocial": "Prov", "productos": ["RON-002"], "activo": True}]}})
        ordenes.append(cuerpo["variables"]["input"])
        return _Respuesta({"data": {"crearOrdenCompra": {"id": "o1", "numero": "OC-1", "total": 1.0, "estado": "BORRADOR"}}})

    return urlopen, ordenes


@pytest.fixture
def entorno(monkeypatch):
    monkeypatch.delenv("MCP_URL", raising=False)
    monkeypatch.setenv("INVENTARIO_URL", "http://inv")
    monkeypatch.setenv("VENTAS_URL", "http://ven")
    monkeypatch.setenv("GESTION_URL", "http://ges/graphql")
    monkeypatch.setattr(reabastecimiento, "llm_disponible", lambda: True)


def _llm_que_consulta_y_decide(decision, llamadas):
    def chat(mensajes, tools=None, formato_json=False, timeout=None):
        llamadas.append({"tools": [t["function"]["name"] for t in tools or []], "formato_json": formato_json})
        if formato_json:
            return {"content": json.dumps(decision)}
        if not any(m.get("role") == "tool" for m in mensajes):
            argumentos = {"desde": "2026-10-01T00:00:00Z", "hasta": "2026-11-01T00:00:00Z"}
            return {"role": "assistant", "content": "", "tool_calls": [{"function": {"name": "ventas_por_periodo", "arguments": argumentos}}]}
        return {"role": "assistant", "content": "Conviene reponer."}

    return chat


def _ejecutar(cantidad=2, minimo=3):
    return reabastecimiento.ejecutar_agente_reabastecimiento("RON-002", cantidad, minimo, token="t")


def test_el_llm_elige_la_tool_y_decide_la_cantidad(entorno, monkeypatch):
    urlopen, ordenes = _servicios()
    llamadas = []
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(reabastecimiento, "chat_ollama", _llm_que_consulta_y_decide({"crearOrden": True, "cantidad": 12, "motivo": "Se venden 10 al mes"}, llamadas))

    r = _ejecutar()

    assert r["decididoPor"] == "llm"
    assert r["herramientasUsadas"] == ["ventas_por_periodo"]
    assert r["motivo"] == "Se venden 10 al mes"
    assert ordenes[0]["lineas"][0]["cantidad"] == 12
    assert "crear_orden_compra" not in llamadas[0]["tools"]   # comprar no queda en manos del modelo


def test_el_llm_puede_decidir_no_pedir(entorno, monkeypatch):
    urlopen, ordenes = _servicios()
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(reabastecimiento, "chat_ollama", _llm_que_consulta_y_decide({"crearOrden": False, "cantidad": 0, "motivo": "Ya no se vende"}, []))

    r = _ejecutar()

    assert r["ordenCreada"] is False
    assert r["motivo"] == "Ya no se vende"
    assert ordenes == []


def test_con_stock_suficiente_no_se_compra_aunque_el_llm_quiera(entorno, monkeypatch):
    urlopen, ordenes = _servicios(cantidad=32)
    llamadas = []
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(reabastecimiento, "chat_ollama", _llm_que_consulta_y_decide({"crearOrden": True, "cantidad": 104, "motivo": "x"}, llamadas))

    r = _ejecutar()

    assert r["ordenCreada"] is False
    assert ordenes == []
    assert llamadas == []   # ni siquiera gasta tiempo de LLM


@pytest.mark.parametrize("pedida,esperada", [(1, 5), (99999, 5), ("muchas", 5)])
def test_una_cantidad_fuera_de_rango_se_corrige(entorno, monkeypatch, pedida, esperada):
    urlopen, ordenes = _servicios()
    # Sin historial: el tope queda en lo mínimo razonable (déficit 2 + mínimo 3)
    def sin_ventas(req, timeout=10):
        return _Respuesta([]) if "/ventas?" in req.full_url else urlopen(req, timeout)
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", sin_ventas)
    monkeypatch.setattr(reabastecimiento, "chat_ollama", _llm_que_consulta_y_decide({"crearOrden": True, "cantidad": pedida, "motivo": "x"}, []))

    _ejecutar()

    assert ordenes[0]["lineas"][0]["cantidad"] == esperada


def test_si_el_llm_falla_decide_el_plan_b(entorno, monkeypatch):
    urlopen, ordenes = _servicios()
    def falla(*a, **k):
        raise TimeoutError("sin respuesta")
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(reabastecimiento, "chat_ollama", falla)

    r = _ejecutar()

    assert r["decididoPor"] == "reglas"
    assert r["ordenCreada"] is True
    assert len(ordenes) == 1


def test_el_llm_interpreta_el_pedido_de_reporte(monkeypatch):
    monkeypatch.setattr(reportes, "consultar_json", lambda p, s: {
        "fuente": "stock", "agrupacion": "producto", "tipoFiltro": "NO_EXISTE", "soloBajoMinimo": True, "tipoGrafico": "torta", "periodo": "mes"})

    r = reportes._interpretar_con_llm("dime lo que se está por acabar")

    assert r["interpretadoPor"] == "llm"
    assert r["fuente"] == "stock" and r["soloBajoMinimo"] is True and r["tipoGrafico"] == "torta"
    assert "tipoFiltro" not in r   # lo inválido no se acepta


def test_una_fecha_escrita_no_la_cambia_el_llm(monkeypatch):
    monkeypatch.setattr(reportes, "consultar_json", lambda p, s: {"periodo": "mes"})
    assert "desde" not in reportes._interpretar_con_llm("Ventas del día 2026-11-01 por producto")


def test_sin_llm_no_interpreta(monkeypatch):
    monkeypatch.setattr(reportes, "consultar_json", lambda p, s: None)
    assert reportes._interpretar_con_llm("lo que sea") == {}
