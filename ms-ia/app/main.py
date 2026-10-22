import json
import os
import urllib.request

from fastapi import FastAPI

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

app = FastAPI(
    title="ms-ia",
    description="Inteligencia artificial de la Plataforma Licorería: clasificación de productos, agentes y MCP.",
    version="0.1.0",
    root_path=os.getenv("ROOT_PATH", ""),
)


class PrefijoDelGateway:
    """Usa el X-Forwarded-Prefix que envía Nginx (/api/ia) como root_path, así Swagger (/docs)
    funciona igual por el gateway que entrando directo al puerto del servicio."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            prefijo = dict(scope["headers"]).get(b"x-forwarded-prefix")
            if prefijo:
                scope = dict(scope, root_path=prefijo.decode())
        await self.app(scope, receive, send)


app.add_middleware(PrefijoDelGateway)


def _estado_ollama() -> dict:
    try:
        with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=2) as r:
            modelos = [m["name"] for m in json.load(r).get("models", [])]
        return {"status": "UP", "modelos": modelos}
    except Exception as e:  # Ollama es opcional mientras no se usen los agentes
        return {"status": "DOWN", "error": str(e)}


@app.get("/health")
def health():
    return {
        "status": "UP",
        "servicio": "ms-ia",
        "components": {"ollama": _estado_ollama()},
    }
