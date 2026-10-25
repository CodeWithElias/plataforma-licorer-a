"""Pruebas de ms-ia sin Keycloak: los tokens se firman con una clave RSA generada aquí."""

import io
import json
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from PIL import Image

from app import seguridad
from app.main import app
from app.servicios import inventario

EMISOR = "http://localhost/auth/realms/licoreria"
CLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(roles=("CAJERO",), emisor=EMISOR, vence_en=300, usuario="cajero01"):
    claims = {"sub": "id-" + usuario, "preferred_username": usuario, "iss": emisor,
              "exp": int(time.time()) + vence_en, "realm_access": {"roles": list(roles)}}
    return jwt.encode(claims, CLAVE, algorithm="RS256", headers={"kid": "prueba"})


def cabecera(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(autouse=True)
def entorno(monkeypatch, tmp_path):
    monkeypatch.setenv("KEYCLOAK_ISSUER", EMISOR)
    monkeypatch.setenv("MODELOS_DIR", str(tmp_path))
    jwks_falso = SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=CLAVE.public_key()))
    monkeypatch.setattr(seguridad, "_cliente_jwks", lambda: jwks_falso)
    monkeypatch.setattr(inventario, "catalogo_por_etiqueta",
                        lambda _t: {"pacena_620": {"codigo": "CER-001", "nombre": "Cerveza Paceña 620 ml"}})
    yield tmp_path


cliente = TestClient(app)


def test_health_no_exige_token():
    r = cliente.get("/health")
    assert r.status_code == 200
    assert r.json()["servicio"] == "ms-ia"


def test_yo_devuelve_usuario_y_roles():
    r = cliente.get("/yo", headers=cabecera(token(roles=("GERENTE",), usuario="gerente01")))
    assert r.status_code == 200
    assert r.json() == {"id": "id-gerente01", "usuario": "gerente01", "roles": ["GERENTE"]}


@pytest.mark.parametrize("encabezados", [{}, {"Authorization": "Bearer abc.def.ghi"}])
def test_sin_token_o_token_falso_401(encabezados):
    r = cliente.get("/yo", headers=encabezados)
    assert r.status_code == 401
    assert r.json()["codigo"] == "NO_AUTENTICADO"


def test_token_vencido_401():
    assert cliente.get("/yo", headers=cabecera(token(vence_en=-120))).status_code == 401


def test_emisor_distinto_401():
    assert cliente.get("/yo", headers=cabecera(token(emisor="http://otro/realms/x"))).status_code == 401


def imagen_jpg():
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), (200, 160, 40)).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_clasificar_exige_rol():
    r = cliente.post("/imagen/clasificar", headers=cabecera(token(roles=("ADMIN",))),
                     files={"imagen": ("foto.jpg", imagen_jpg(), "image/jpeg")})
    assert r.status_code == 403
    assert r.json()["codigo"] == "SIN_PERMISO"


def test_sin_modelo_entrenado_503():
    r = cliente.post("/imagen/clasificar", headers=cabecera(token()),
                     files={"imagen": ("foto.jpg", imagen_jpg(), "image/jpeg")})
    assert r.status_code == 503
    assert r.json()["codigo"] == "MODELO_NO_DISPONIBLE"
    assert cliente.get("/modelos/latest", headers=cabecera(token())).status_code == 503


def test_imagen_vacia_400(entorno):
    r = cliente.post("/imagen/clasificar", headers=cabecera(token()), files={"imagen": ("foto.jpg", b"", "image/jpeg")})
    assert r.status_code == 400


def test_descarga_no_sale_de_la_carpeta_del_modelo(entorno):
    (entorno / "v1").mkdir()
    (entorno / "secreto.txt").write_text("no")
    r = cliente.get("/modelos/v1/../secreto.txt", headers=cabecera(token()))
    assert r.status_code == 404


def test_latest_con_modelo(entorno):
    (entorno / "v1").mkdir()
    (entorno / "v1" / "modelo.tflite").write_bytes(b"x")
    (entorno / "latest.json").write_text(json.dumps({"version": "v1", "etiquetas": ["pacena_620"]}))
    r = cliente.get("/modelos/latest", headers=cabecera(token()))
    assert r.status_code == 200
    assert r.json()["version"] == "v1"
    assert r.json()["tflite"].endswith("/modelos/v1/modelo.tflite")
    assert cliente.get("/modelos/v1/modelo.tflite", headers=cabecera(token())).content == b"x"
