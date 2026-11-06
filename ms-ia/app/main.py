import os

from fastapi import FastAPI

from app.api import agentes_api, imagen, mcp_api, modelos, sistema, video
from app.errores import registrar_manejadores
from app.mcp import mcp_servidor

# Protocolo MCP en /mcp-server/mcp: lo usan los agentes y cualquier cliente MCP (con token)
servidor_mcp = mcp_servidor.app_http()

app = FastAPI(
    lifespan=servidor_mcp.lifespan,
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
app.include_router(video.router)
app.include_router(modelos.router)
app.include_router(mcp_api.router)
app.include_router(agentes_api.router)
app.mount("/mcp-server", servidor_mcp)
