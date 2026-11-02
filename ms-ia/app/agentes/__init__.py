"""Agentes LangGraph (semana 3): reportes por lenguaje natural (CU07) y reabastecimiento (CU06).
Usan las tools MCP de app/mcp y el LLM local de Ollama (OLLAMA_URL)."""

from app.agentes.reabastecimiento import ejecutar_agente_reabastecimiento
from app.agentes.reportes import ejecutar_agente_reportes

__all__ = [
    "ejecutar_agente_reabastecimiento",
    "ejecutar_agente_reportes",
]
