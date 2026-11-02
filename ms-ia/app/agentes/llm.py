"""Motor de Grafo de Estados (LangGraph) y cliente LLM para Ollama con fallback determinista (Plan B ICONIX)."""

import json
import os
from typing import Any, Callable
import urllib.error
import urllib.request


def consultar_ollama(prompt: str, sistema: str = "", timeout: float | None = None) -> str | None:
    """Envía un prompt al servidor local de Ollama (OLLAMA_URL).
    Si Ollama está apagado, no tiene modelo descargado o tarda más de OLLAMA_TIMEOUT segundos, devuelve None para
    activar el Plan B determinista. La primera respuesta tarda más porque Ollama carga el modelo en memoria."""
    if timeout is None:
        timeout = float(os.getenv("OLLAMA_TIMEOUT", "60"))
    if os.getenv("DESACTIVAR_OLLAMA") == "1":
        return None

    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    modelo = os.getenv("OLLAMA_MODEL", "").strip()

    try:
        if not modelo:
            with urllib.request.urlopen(f"{base_url}/api/tags", timeout=1.5) as r:
                modelos = [m.get("name", "") for m in json.load(r).get("models", []) if m.get("name")]
            if not modelos:
                return None
            modelo = modelos[0]

        payload = {
            "model": modelo,
            "prompt": prompt,
            "system": sistema,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        req = urllib.request.Request(
            f"{base_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            datos = json.load(r)
            texto = (datos.get("response") or "").strip()
            return texto if texto else None
    except Exception:
        return None


def motor_de_grafos() -> str:
    """'langgraph' si la librería está instalada (requirements.txt); si no, el motor secuencial de este módulo."""
    try:
        import langgraph.graph  # noqa: F401  # type: ignore

        return "langgraph"
    except ImportError:
        return "secuencial (sin langgraph)"


class _GrafoCompiladoFallback:
    """Ejecutor secuencial de nodos de estado compatible con la interfaz compile().invoke(state) de LangGraph."""

    def __init__(self, nodos: dict[str, Callable[[dict[str, Any]], dict[str, Any]]], orden: list[str]):
        self._nodos = nodos
        self._orden = orden

    def invoke(self, estado_inicial: dict[str, Any]) -> dict[str, Any]:
        estado = dict(estado_inicial)
        for nombre in self._orden:
            fn = self._nodos[nombre]
            actualizacion = fn(estado)
            if isinstance(actualizacion, dict):
                estado.update(actualizacion)
        return estado


class ConstructorGrafo:
    """Construye un grafo de estados usando LangGraph (si está instalado) o el motor compatible en memoria."""

    def __init__(self, tipo_estado: Any = dict):
        self._tipo_estado = tipo_estado
        self._nodos: dict[str, Callable] = {}
        self._orden: list[str] = []

    def agregar_nodo(self, nombre: str, fn: Callable[[dict[str, Any]], dict[str, Any]]):
        self._nodos[nombre] = fn
        if nombre not in self._orden:
            self._orden.append(nombre)

    def compilar(self):
        try:
            from langgraph.graph import END, START, StateGraph  # type: ignore

            g = StateGraph(self._tipo_estado)
            for nombre, fn in self._nodos.items():
                g.add_node(nombre, fn)
            if self._orden:
                g.add_edge(START, self._orden[0])
                for a, b in zip(self._orden, self._orden[1:]):
                    g.add_edge(a, b)
                g.add_edge(self._orden[-1], END)
            return g.compile()
        except Exception:
            return _GrafoCompiladoFallback(self._nodos, list(self._orden))

