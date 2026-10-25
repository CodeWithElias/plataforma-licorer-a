"""Errores de la API con el formato común de la plataforma: { "codigo": ..., "mensaje": ... }."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorApi(Exception):
    def __init__(self, estado: int, codigo: str, mensaje: str):
        super().__init__(mensaje)
        self.estado = estado
        self.codigo = codigo
        self.mensaje = mensaje


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(ErrorApi)
    async def _error_api(_: Request, e: ErrorApi):
        return JSONResponse(status_code=e.estado, content={"codigo": e.codigo, "mensaje": e.mensaje})

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, e: RequestValidationError):
        detalle = "; ".join(f"{'.'.join(str(x) for x in err['loc'][1:])}: {err['msg']}" for err in e.errors())
        return JSONResponse(status_code=400, content={"codigo": "DATOS_INVALIDOS", "mensaje": detalle})

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        codigo = "NO_ENCONTRADO" if e.status_code == 404 else "ERROR"
        return JSONResponse(status_code=e.status_code, content={"codigo": codigo, "mensaje": str(e.detail)})
