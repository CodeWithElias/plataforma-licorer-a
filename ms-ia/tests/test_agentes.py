"""Pruebas de los agentes LangGraph (CU06 Reabastecimiento y CU07 Reportes por lenguaje natural)."""

import json
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app import seguridad
from app.main import app
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
def _entorno_agentes(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_ISSUER", EMISOR)
    monkeypatch.setenv("DESACTIVAR_OLLAMA", "1")
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


def test_agentes_exigen_rol_gerente():
    tok_cajero = token_jwt(roles=("CAJERO",), usuario="cajero01")
    headers = {"Authorization": f"Bearer {tok_cajero}"}

    r1 = cliente.post("/reportes", headers=headers, json={"consulta": "Ventas de esta semana"})
    assert r1.status_code == 403
    assert r1.json()["codigo"] == "SIN_PERMISO"

    r2 = cliente.post(
        "/agentes/reabastecimiento",
        headers=headers,
        json={"productoCodigo": "RON-002", "cantidad": 2, "minimo": 3},
    )
    assert r2.status_code == 403
    assert r2.json()["codigo"] == "SIN_PERMISO"


def test_cu06_agente_reabastecimiento_crea_orden(monkeypatch):
    def urlopen_mock(req, timeout=10):
        url = req.full_url
        if url.endswith("/stock"):
            return _RespuestaFalsa([
                {"productoCodigo": "RON-002", "cantidad": 2, "reservado": 0, "disponible": 2, "minimo": 3, "bajoMinimo": True}
            ])
        if url.endswith("/productos/RON-002"):
            return _RespuestaFalsa({
                "codigo": "RON-002",
                "nombre": "Ron Abuelo Añejo 750 ml",
                "marca": "Abuelo",
                "tipo": "RON",
                "precio": 100.0,
            })
        if "/ventas?" in url:
            return _RespuestaFalsa([
                {
                    "numero": 10,
                    "fecha": "2026-10-28T15:00:00Z",
                    "total": 1500.0,
                    "items": [
                        {"productoCodigo": "RON-002", "productoNombre": "Ron Abuelo Añejo 750 ml", "cantidad": 15, "subtotal": 1500.0}
                    ],
                }
            ])
        if url.endswith("/graphql"):
            cuerpo = json.loads(req.data.decode("utf-8"))
            if "ProveedoresActivos" in cuerpo["query"]:
                return _RespuestaFalsa({
                    "data": {
                        "proveedores": [
                            {"id": "prov-ron", "nit": "99887766", "razonSocial": "Importadora Ron", "productos": ["RON-002"], "activo": True}
                        ]
                    }
                })
            return _RespuestaFalsa({
                "data": {
                    "crearOrdenCompra": {
                        "id": "ord-99",
                        "numero": "OC-0042",
                        "total": 1050.0,
                        "estado": "BORRADOR",
                    }
                }
            })
        raise AssertionError(f"URL inesperada: {url}")

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_mock)

    r = cliente.post(
        "/agentes/reabastecimiento",
        headers={"Authorization": f"Bearer {token_jwt()}"},
        json={"productoCodigo": "RON-002", "nombre": "Ron Abuelo Añejo 750 ml", "cantidad": 2, "minimo": 3},
    )
    assert r.status_code == 200
    datos = r.json()
    assert datos["ordenCreada"] is True
    assert datos["numero"] == "OC-0042"
    assert len(datos["lineas"]) == 1
    assert datos["lineas"][0]["productoCodigo"] == "RON-002"
    assert datos["lineas"][0]["cantidad"] == 15  # demanda de 30 días (15) > déficit + mínimo (4)
    assert datos["lineas"][0]["precioUnitario"] == 70.0
    assert "Ron Abuelo" in datos["motivo"]


def test_cu06_agente_reabastecimiento_sin_proveedor(monkeypatch):
    def urlopen_sin_prov(req, timeout=10):
        url = req.full_url
        if url.endswith("/stock"):
            return _RespuestaFalsa([{"productoCodigo": "SIN-003", "cantidad": 1, "reservado": 0, "disponible": 1, "minimo": 6}])
        if url.endswith("/productos/SIN-003"):
            return _RespuestaFalsa({"codigo": "SIN-003", "nombre": "Singani Los Parrales", "precio": 80.0})
        if "/ventas?" in url:
            return _RespuestaFalsa([])
        if url.endswith("/graphql"):
            return _RespuestaFalsa({"data": {"proveedores": []}})
        raise AssertionError(url)

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_sin_prov)

    r = cliente.post(
        "/agentes/reabastecimiento",
        headers={"Authorization": f"Bearer {token_jwt()}"},
        json={"productoCodigo": "SIN-003", "cantidad": 1, "minimo": 6},
    )
    assert r.status_code == 200
    datos = r.json()
    assert datos["ordenCreada"] is False
    assert "proveedor" in datos["motivo"].lower()


def test_cu07_agente_reportes_ventas_por_producto_en_barras(monkeypatch):
    def urlopen_ventas(req, timeout=10):
        return _RespuestaFalsa([
            {
                "numero": 1,
                "fecha": "2026-11-01T10:00:00Z",
                "total": 204.0,
                "items": [
                    {"productoCodigo": "CER-001", "productoNombre": "Cerveza Paceña 620 ml", "cantidad": 2, "subtotal": 24.0},
                    {"productoCodigo": "WHI-001", "productoNombre": "Whisky Johnnie Walker Red", "cantidad": 1, "subtotal": 180.0},
                ],
            },
            {
                "numero": 2,
                "fecha": "2026-11-01T12:00:00Z",
                "total": 36.0,
                "items": [
                    {"productoCodigo": "CER-001", "productoNombre": "Cerveza Paceña 620 ml", "cantidad": 3, "subtotal": 36.0},
                ],
            },
        ])

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_ventas)

    r = cliente.post(
        "/reportes",
        headers={"Authorization": f"Bearer {token_jwt()}"},
        json={"consulta": "Ventas por producto de esta semana en barras"},
    )
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["columnas"] == ["Producto", "Unidades", "Monto (Bs)"]
    assert cuerpo["tipoGrafico"] == "barras"
    assert len(cuerpo["datos"]) == 2
    # Ordenado de mayor a menor monto: WHI-001 (180.0) primero, CER-001 (60.0) segundo
    assert cuerpo["datos"][0] == ["Whisky Johnnie Walker Red (WHI-001)", 1, 180.0]
    assert cuerpo["datos"][1] == ["Cerveza Paceña 620 ml (CER-001)", 5, 60.0]
    assert "240.00" in cuerpo["resumen"]


def test_cu07_agente_reportes_stock_bajo_minimo_en_torta(monkeypatch):
    def urlopen_stock(req, timeout=10):
        if "/productos" in req.full_url:
            return _RespuestaFalsa([
                {"codigo": "RON-002", "nombre": "Ron Abuelo Añejo", "tipo": "RON", "precio": 95.0}
            ])
        return _RespuestaFalsa([
            {"productoCodigo": "CER-001", "cantidad": 40, "reservado": 0, "disponible": 40, "minimo": 12, "bajoMinimo": False},
            {"productoCodigo": "RON-002", "cantidad": 2, "reservado": 0, "disponible": 2, "minimo": 3, "bajoMinimo": True},
        ])

    monkeypatch.setattr(srv_mod.urllib.request, "urlopen", urlopen_stock)

    r = cliente.post(
        "/reportes",
        headers={"Authorization": f"Bearer {token_jwt()}"},
        json={"consulta": "Productos con stock bajo mínimo en gráfico de torta"},
    )
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["columnas"] == ["Producto", "Disponible", "Mínimo"]
    assert cuerpo["tipoGrafico"] == "torta"
    assert cuerpo["datos"] == [["Ron Abuelo Añejo (RON-002)", 2, 3]]

