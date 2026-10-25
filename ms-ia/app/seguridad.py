"""Validación del token de Keycloak: firma (claves del JWKS en caché), vencimiento y emisor.

Uso en una ruta:
    @router.get("/algo")
    def algo(usuario: Usuario = Depends(requiere_roles("GERENTE"))): ...
"""

import os
from dataclasses import dataclass, field
from functools import lru_cache

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.errores import ErrorApi

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Usuario:
    id: str
    usuario: str
    roles: list[str] = field(default_factory=list)
    token: str = ""   # se reenvía a los otros servicios (tools MCP, catálogo)


@lru_cache
def _cliente_jwks() -> jwt.PyJWKClient:
    url = os.getenv("KEYCLOAK_JWKS", "http://localhost/auth/realms/licoreria/protocol/openid-connect/certs")
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=600, timeout=5)


def _emisor() -> str:
    return os.getenv("KEYCLOAK_ISSUER", "http://localhost/auth/realms/licoreria")


def validar_token(token: str) -> Usuario:
    try:
        clave = _cliente_jwks().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token, clave.key, algorithms=["RS256"], issuer=_emisor(), leeway=30,
            options={"verify_aud": False, "require": ["exp", "iss", "sub"]},
        )
    except (jwt.PyJWTError, jwt.PyJWKClientError) as e:
        raise ErrorApi(401, "NO_AUTENTICADO", f"Token inválido: {e}") from e
    return Usuario(
        id=claims["sub"],
        usuario=claims.get("preferred_username", claims["sub"]),
        roles=claims.get("realm_access", {}).get("roles", []),
        token=token,
    )


def usuario_actual(credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Usuario:
    if credenciales is None or credenciales.scheme.lower() != "bearer":
        raise ErrorApi(401, "NO_AUTENTICADO", "Falta el token (Authorization: Bearer ...)")
    return validar_token(credenciales.credentials)


def requiere_roles(*roles: str):
    """Dependencia que exige alguno de estos roles de Keycloak."""

    def _verificar(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if roles and not set(roles) & set(usuario.roles):
            raise ErrorApi(403, "SIN_PERMISO", f"Se requiere el rol {' o '.join(roles)}")
        return usuario

    return _verificar
