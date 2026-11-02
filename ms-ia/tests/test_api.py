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
from app.api import sistema
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
    monkeypatch.setattr(sistema, "_estado_ollama", lambda: {"status": "DOWN", "error": "sin ollama en test"})
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


def test_video_analizar_exige_rol():
    r = cliente.post("/video/analizar", headers=cabecera(token(roles=("ADMIN",))),
                     files={"video": ("clip.mp4", b"datos", "video/mp4")})
    assert r.status_code == 403
    assert r.json()["codigo"] == "SIN_PERMISO"


def test_video_vacio_400():
    r = cliente.post("/video/analizar", headers=cabecera(token()),
                     files={"video": ("clip.mp4", b"", "video/mp4")})
    assert r.status_code == 400
    assert r.json()["codigo"] == "DATOS_INVALIDOS"


def test_video_sin_modelo_503():
    r = cliente.post("/video/analizar", headers=cabecera(token()),
                     files={"video": ("clip.mp4", b"no-es-video", "video/mp4")})
    assert r.status_code == 503
    assert r.json()["codigo"] == "MODELO_NO_DISPONIBLE"


def test_video_invalido_400(entorno):
    (entorno / "v1").mkdir()
    (entorno / "v1" / "modelo.tflite").write_bytes(b"x")
    (entorno / "latest.json").write_text(json.dumps({"version": "v1", "etiquetas": ["pacena_620"]}))
    r = cliente.post("/video/analizar", headers=cabecera(token()),
                     files={"video": ("clip.mp4", b"no-es-un-video-valido", "video/mp4")})
    assert r.status_code == 400
    assert r.json()["codigo"] == "DATOS_INVALIDOS"


def test_video_analizar_extrae_un_frame_por_segundo(entorno, monkeypatch):
    import cv2
    import numpy as np
    from app.modelos.clasificador import Prediccion, clasificador

    (entorno / "v1").mkdir()
    (entorno / "v1" / "modelo.tflite").write_bytes(b"x")
    (entorno / "latest.json").write_text(json.dumps({"version": "v1", "etiquetas": ["pacena_620"]}))

    # Genera un video real de 2 segundos a 5 fps (10 frames en total -> debe extraer 2 frames: seg 0 y seg 1)
    ruta_video = entorno / "mostrador.avi"
    fourcc = cv2.VideoWriter_fourcc(*"MJPG")
    writer = cv2.VideoWriter(str(ruta_video), fourcc, 5.0, (64, 64))
    for _ in range(10):
        frame = np.full((64, 64, 3), (40, 160, 200), dtype=np.uint8)
        writer.write(frame)
    writer.release()

    monkeypatch.setattr(clasificador, "clasificar", lambda _bytes: (Prediccion("pacena_620", 0.965), "v1"))

    r = cliente.post("/video/analizar", headers=cabecera(token()),
                     files={"video": ("mostrador.avi", ruta_video.read_bytes(), "video/x-msvideo")})
    assert r.status_code == 200
    datos = r.json()
    assert len(datos) == 2
    assert datos[0]["segundo"] == 0
    assert datos[0]["productoCodigo"] == "CER-001"
    assert datos[0]["nombre"] == "Cerveza Paceña 620 ml"
    assert datos[0]["etiqueta"] == "pacena_620"
    assert datos[0]["confianza"] == 0.965
    assert datos[0]["modelo"] == "v1"
    assert datos[1]["segundo"] == 1


def test_clasificar_imagen_con_modelo_real(entorno):
    import random
    from entrenamiento.dataset_sintetico import PRODUCTOS, imagen
    from entrenamiento.entrenar import entrenar_sin_tf, exportar_tfjs_directo

    random.seed(7)
    carpeta_ds = entorno / "ds"
    for etiqueta, (color, forma) in PRODUCTOS.items():
        sub = carpeta_ds / etiqueta
        sub.mkdir(parents=True, exist_ok=True)
        for i in range(10):
            imagen(color, forma, tamano=224).save(sub / f"{etiqueta}_{i}.jpg")

    etiquetas, precision, tflite, kernel, bias = entrenar_sin_tf(carpeta_ds, 64, 5)
    assert precision >= 0.8

    import numpy as np
    v_dir = entorno / "v-real"
    v_dir.mkdir()
    (v_dir / "modelo.tflite").write_bytes(tflite)
    np.savez(v_dir / "pesos.npz", kernel=kernel, bias=bias)
    exportar_tfjs_directo(kernel, bias, 64, v_dir / "tfjs")
    (entorno / "latest.json").write_text(json.dumps({
        "version": "v-real",
        "etiquetas": etiquetas,
        "tamano": 64,
        "precisionValidacion": precision,
        "tfjs": True,
    }))

    # Verifica que /modelos/latest exponga también la ruta tfjs
    r_latest = cliente.get("/modelos/latest", headers=cabecera(token()))
    assert r_latest.status_code == 200
    assert r_latest.json()["tfjs"].endswith("/modelos/v-real/tfjs/model.json")

    # Prueba imagen de Paceña como en guion-pruebas.md
    from PIL import ImageDraw
    img_pacena = Image.new("RGB", (224, 224), (230, 225, 215))
    ImageDraw.Draw(img_pacena).rectangle([40, 30, 190, 200], fill=(200, 160, 40))
    buf = io.BytesIO()
    img_pacena.save(buf, format="JPEG")

    r = cliente.post("/imagen/clasificar", headers=cabecera(token()),
                     files={"imagen": ("pacena.jpg", buf.getvalue(), "image/jpeg")})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["etiqueta"] == "pacena_620"
    assert cuerpo["productoCodigo"] == "CER-001"
    assert cuerpo["confianza"] >= 0.8


