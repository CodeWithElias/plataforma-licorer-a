"""Cliente de ms-inventario: catálogo para traducir la etiqueta del modelo al código de producto."""

import json
import os
import time
import urllib.error
import urllib.request

from app.errores import ErrorApi

_CACHE_SEGUNDOS = 300
_cache: tuple[float, dict[str, dict]] | None = None


def catalogo_por_etiqueta(token: str) -> dict[str, dict]:
    """{etiquetaModelo: producto} según GET /productos de ms-inventario (en caché 5 minutos)."""
    global _cache
    if _cache and time.monotonic() - _cache[0] < _CACHE_SEGUNDOS:
        return _cache[1]
    url = os.getenv("INVENTARIO_URL", "http://localhost/api/inventario").rstrip("/") + "/productos"
    pedido = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(pedido, timeout=5) as r:
            productos = json.load(r)
    except (urllib.error.URLError, TimeoutError) as e:
        raise ErrorApi(502, "ERROR_INTERNO", f"ms-inventario no respondió: {e}") from e
    _cache = (time.monotonic(), {p["etiquetaModelo"]: p for p in productos})
    return _cache[1]
