"""Motor de Grafo de Estados (LangGraph) y cliente LLM para Ollama con fallback determinista (Plan B ICONIX)."""

import json
import os
from typing import Any, Callable
import urllib.error
import urllib.request


def _timeout_ollama() -> float:
    return float(os.getenv("OLLAMA_TIMEOUT", "120"))


def _modelo_ollama(base_url: str) -> str | None:
    modelo = os.getenv("OLLAMA_MODEL", "").strip()
    if modelo:
        return modelo
    with urllib.request.urlopen(f"{base_url}/api/tags", timeout=1.5) as r:
        modelos = [m.get("name", "") for m in json.load(r).get("models", []) if m.get("name")]
    return modelos[0] if modelos else None


def llm_disponible() -> bool:
    """¿Responde Ollama y tiene el modelo descargado? Si no, los agentes usan su plan B por reglas."""
    if os.getenv("DESACTIVAR_OLLAMA") == "1":
        return False
    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    try:
        with urllib.request.urlopen(f"{base_url}/api/tags", timeout=2) as r:
            modelos = [m.get("name", "") for m in json.load(r).get("models", [])]
        modelo = os.getenv("OLLAMA_MODEL", "").strip()
        return modelo in modelos if modelo else bool(modelos)
    except Exception:
        return False


def chat_ollama(
    mensajes: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    formato_json: bool = False,
    timeout: float | None = None,
) -> dict[str, Any]:
    """Una vuelta de conversación con el LLM. Devuelve su mensaje, que puede traer tool_calls.

    @raises Exception si Ollama falla o se pasa de OLLAMA_TIMEOUT: el agente pasa a su plan B."""
    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    payload: dict[str, Any] = {
        "model": _modelo_ollama(base_url),
        "messages": mensajes,
        "stream": False,
        "options": {"temperature": 0.1},
    }
    if tools:
        payload["tools"] = tools
    if formato_json:
        payload["format"] = "json"
    req = urllib.request.Request(
        f"{base_url}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout if timeout is not None else _timeout_ollama()) as r:
        return json.load(r)["message"]


def consultar_json(prompt: str, sistema: str) -> dict[str, Any] | None:
    """Pide al LLM una respuesta JSON. None si no está disponible o no responde con un objeto válido."""
    if not llm_disponible():
        return None
    try:
        mensaje = chat_ollama([{"role": "system", "content": sistema}, {"role": "user", "content": prompt}], formato_json=True)
        datos = json.loads(mensaje.get("content") or "")
        return datos if isinstance(datos, dict) else None
    except Exception:
        return None


def consultar_ollama(prompt: str, sistema: str = "", timeout: float | None = None) -> str | None:
    """Envía un prompt al servidor local de Ollama (OLLAMA_URL).
    Si Ollama está apagado, no tiene modelo descargado o tarda más de OLLAMA_TIMEOUT segundos, devuelve None para
    activar el Plan B determinista. La primera respuesta tarda más porque Ollama carga el modelo en memoria."""
    if timeout is None:
        timeout = _timeout_ollama()
    if os.getenv("DESACTIVAR_OLLAMA") == "1":
        return None

    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")

    try:
        modelo = _modelo_ollama(base_url)
        if not modelo:
            return None

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

