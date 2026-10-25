import json
import os
import urllib.request

from fastapi import APIRouter, Depends

from app.seguridad import Usuario, usuario_actual

router = APIRouter(tags=["Sistema"])


def _estado_ollama() -> dict:
    url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    try:
        with urllib.request.urlopen(f"{url}/api/tags", timeout=2) as r:
            modelos = [m["name"] for m in json.load(r).get("models", [])]
        return {"status": "UP", "modelos": modelos}
    except Exception as e:  # Ollama es opcional hasta que se usen los agentes (semana 3)
        return {"status": "DOWN", "error": str(e)}


@router.get("/health", summary="Estado del servicio y de Ollama")
def health():
    return {"status": "UP", "servicio": "ms-ia", "components": {"ollama": _estado_ollama()}}


@router.get("/yo", summary="Usuario del token (id, usuario y roles)")
def yo(usuario: Usuario = Depends(usuario_actual)):
    return {"id": usuario.id, "usuario": usuario.usuario, "roles": usuario.roles}
