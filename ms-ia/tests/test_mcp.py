"""Pruebas de las 4 tools MCP (FastMCP) de ms-ia y su integración con ms-inventario, ms-ventas y ms-gestion."""

import io
import json
import time
from types import SimpleNamespace
import urllib.error

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import seguridad
from app.main import app
from app.mcp import (
    ErrorMcp,
    buscar_producto,
    consultar_proveedores_activos,
    crear_orden_compra,
    mcp_servidor,
    stock_actual,
    usar_token_mcp,
    ventas_por_periodo,
)
from app.mcp import servidor as srv_mod

EMISOR = "http://localhost/auth/realms/licoreria"
CLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token_jwt(roles=("GERENTE",), usuario="gerente01"):
    claims = {
        "sub": "id-" + usuario,
        "preferred_username": usuario,
        "iss": EMISOR,
        "exp": int(time.time()) + 300,
        "realm_access": {"roles": list(roles)},
    }
    return jwt.encode(claims, CLAVE, algorithm="RS256", headers={"kid": "prueba"})


@pytest.fixture(autouse=True)
def _entorno_jwt(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_ISSUER", EMISOR)
    monkeypatch.setenv("INVENTARIO_URL", "http://ms-inventario:8001")
    monkeypatch.setenv("VENTAS_URL", "http://ms-ventas:8080")
    monkeypatch.setenv("GESTION_URL", "http://ms-gestion:3000/graphql")
    jwks_falso = SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=CLAVE.public_key()))
    monkeypatch.setattr(seguridad, "_cliente_jwks", lambda: jwks_falso)


cliente = TestClient(app)


class _RespuestaFalsa:
    def __init__(self, payload):
        self._bytes = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._bytes

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_listar_las_4_tools_mcp():
    t = token_jwt()
    r = cliente.get("/mcp/tools", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 200
    nombres = [tool["name"] for tool in r.json()["tools"]]
    assert nombres == ["buscar_producto", "stock_actual", "ventas_por_periodo", "crear_orden_compra"]


def test_tool_buscar_producto_por_texto_y_por_codigo(monkeypatch):
    llamadas = []

    def urlopen_falso(req, timeout=10):
        llamadas.append((req.full_url, req.headers.get("Authorization")))
        if req.full_url.endswith("/productos/CER-001"):
            return _RespuestaFalsa({
                "codigo": "CER-001",
                "nombre": "Cerveza Paceña 620 ml",
                "marca": "Paceña",
                "tipo": "CERVEZA",
                "precio": 12.0,
                "etiquetaModelo": "pacena_620",
            })
        return _RespuestaFalsa([
            {"codigo": "CER-001", "nombre": "Cerveza Paceña 620 ml", "marca": "Paceña", "tipo": "CERVEZA", "precio": 12.0},
            {"codigo": "WHI-001", "nombre": "Whisky Johnnie Walker Red 750 ml", "marca": "Johnnie Walker", "tipo": "WHISKY", "precio": 165.0},
        ])

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_falso)

    with usar_token_mcp("tok-gerente"):
        por_codigo = buscar_producto("cer-001")
        assert len(por_codigo) == 1
        assert por_codigo[0]["codigo"] == "CER-001"
        assert llamadas[-1][0] == "http://ms-inventario:8001/productos/CER-001"
        assert llamadas[-1][1] == "Bearer tok-gerente"

        por_texto = buscar_producto("walker", tipo="whisky")
        assert len(por_texto) == 1
        assert por_texto[0]["codigo"] == "WHI-001"
        assert "tipo=WHISKY" in llamadas[-1][0]


def test_tool_stock_actual_filtra_codigos_y_bajo_minimo(monkeypatch):
    datos_stock = [
        {"productoCodigo": "CER-001", "cantidad": 48, "reservado": 2, "disponible": 46, "minimo": 12, "bajoMinimo": False},
        {"productoCodigo": "RON-002", "cantidad": 2, "reservado": 0, "disponible": 2, "minimo": 3, "bajoMinimo": True},
    ]
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", lambda req, timeout=10: _RespuestaFalsa(datos_stock))

    with usar_token_mcp("tok-gerente"):
        todos = stock_actual()
        assert len(todos) == 2

        bajos = stock_actual(solo_bajo_minimo=True)
        assert len(bajos) == 1
        assert bajos[0]["productoCodigo"] == "RON-002"
        assert bajos[0]["cantidad"] == 2
        assert bajos[0]["minimo"] == 3

        por_codigo = stock_actual(codigos=["cer-001"])
        assert len(por_codigo) == 1
        assert por_codigo[0]["disponible"] == 46


def test_tool_ventas_por_periodo(monkeypatch):
    ventas_mock = [
        {
            "numero": 15,
            "fecha": "2026-11-01T14:00:00Z",
            "total": 69.0,
            "items": [
                {"productoCodigo": "CER-001", "productoNombre": "Cerveza Paceña 620 ml", "cantidad": 2, "subtotal": 24.0},
                {"productoCodigo": "VIN-001", "productoNombre": "Vino Kohlberg", "cantidad": 1, "subtotal": 45.0},
            ],
        }
    ]
    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", lambda req, timeout=10: _RespuestaFalsa(ventas_mock))

    with usar_token_mcp("tok-gerente"):
        res = ventas_por_periodo("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")
        assert len(res) == 1
        assert res[0]["numero"] == 15
        assert res[0]["total"] == 69.0
        assert len(res[0]["items"]) == 2


def test_tool_crear_orden_compra_y_proveedores_graphql(monkeypatch):
    def urlopen_graphql(req, timeout=10):
        cuerpo = json.loads(req.data.decode("utf-8"))
        if "ProveedoresActivos" in cuerpo["query"]:
            return _RespuestaFalsa({
                "data": {
                    "proveedores": [
                        {"id": "prov-1", "nit": "1023456789", "razonSocial": "CBN", "productos": ["CER-001", "RON-002"], "activo": True}
                    ]
                }
            })
        assert cuerpo["variables"]["input"]["origen"] == "AGENTE"
        return _RespuestaFalsa({
            "data": {
                "crearOrdenCompra": {
                    "id": "ord-123",
                    "numero": "OC-0001",
                    "total": 600.0,
                    "estado": "BORRADOR",
                }
            }
        })

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_graphql)

    with usar_token_mcp("tok-gerente"):
        provs = consultar_proveedores_activos("ron-002")
        assert len(provs) == 1
        assert provs[0]["id"] == "prov-1"

        orden = crear_orden_compra("prov-1", [{"productoCodigo": "ron-002", "cantidad": 10, "precioUnitario": 60.0}])
        assert orden == {"id": "ord-123", "numero": "OC-0001", "total": 600.0, "estado": "BORRADOR"}


def test_error_http_y_graphql_se_traduce_a_error_mcp(monkeypatch):
    def urlopen_403(req, timeout=10):
        err_bytes = json.dumps({"codigo": "SIN_PERMISO", "mensaje": "Se requiere el rol GERENTE"}).encode("utf-8")
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", hdrs=None, fp=io.BytesIO(err_bytes))

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_403)

    t = token_jwt(roles=("CAJERO",), usuario="cajero01")
    r = cliente.post(
        "/mcp/tools/stock_actual",
        headers={"Authorization": f"Bearer {t}"},
        json={"solo_bajo_minimo": True},
    )
    assert r.status_code == 403
    assert r.json()["codigo"] == "SIN_PERMISO"

