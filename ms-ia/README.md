# ms-ia

Microservicio de inteligencia artificial de la Plataforma Licorería: clasificador de productos (MobileNetV2) para imágenes y video, agentes LangGraph (reportes y reabastecimiento) con Ollama y el servidor MCP (FastMCP) cuyas tools llaman a los otros servicios.

| | |
|---|---|
| Dueño | Dev 3 |
| Tecnología | FastAPI (Python 3.12), TensorFlow, LangGraph, FastMCP |
| Puerto | 8000 (por Nginx: `/api/ia/`) |
| Contrato | `docs/openapi.yaml` |
| Base de datos | No tiene: los modelos se guardan como archivos en `/modelos/<versión>/` con un `latest.json` |

## Correrlo con todo el sistema

Desde la raíz del monorepo:

```sh
docker compose up -d --build ms-ia
docker compose --profile llm up -d ollama     # LLM local (imagen grande), solo cuando se usen los agentes
```

## Correrlo solo (desarrollo)

```sh
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env            # si no existe
uvicorn app.main:app --reload --port 8000 --env-file .env
```

- `GET http://localhost:8000/health` (incluye si Ollama responde)
- Swagger: `http://localhost:8000/docs` (por Nginx: `http://localhost/api/ia/docs`)

## Estado

Esqueleto con `/health`. Los endpoints de `docs/openapi.yaml` son el contrato acordado y aún no están implementados.
