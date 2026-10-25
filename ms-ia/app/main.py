import os

from fastapi import FastAPI

from app.api import imagen, modelos, sistema
from app.errores import registrar_manejadores

app = FastAPI(
    title="ms-ia",
    description="Inteligencia artificial de la Plataforma Licorería: clasificación de productos, agentes y MCP.",
    version="0.2.0",
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
registrar_manejadores(app)
app.include_router(sistema.router)
app.include_router(imagen.router)
app.include_router(modelos.router)
