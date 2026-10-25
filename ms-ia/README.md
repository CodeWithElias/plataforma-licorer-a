# ms-ia

Microservicio de inteligencia artificial de la Plataforma Licorería: clasificador de productos (MobileNetV2) para imágenes y video, agentes LangGraph (reportes y reabastecimiento) con Ollama y el servidor MCP (FastMCP) cuyas tools llaman a los otros servicios.

| | |
|---|---|
| Dueño | Dev 3 |
| Tecnología | FastAPI (Python 3.12), TensorFlow, LangGraph, FastMCP |
| Puerto | 8002 (por Nginx: `/api/ia/`) |
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
uvicorn app.main:app --reload --port 8002 --env-file .env
```

- `GET http://localhost:8002/health` (incluye si Ollama responde)
- Swagger: `http://localhost:8002/docs` (por Nginx: `http://localhost/api/ia/docs`)

## Endpoints

| Método y ruta | Rol | Estado |
|---|---|---|
| `GET /health` | público | ✅ |
| `GET /yo` | cualquiera con token | ✅ |
| `POST /imagen/clasificar` (multipart `imagen`) | CAJERO, ALMACEN, GERENTE | ✅ Semana 2 (CU04): TFLite + nombre del producto desde ms-inventario |
| `GET /modelos/latest`, `GET /modelos/{version}/{archivo}` | cualquiera con token | ✅ Para que la app y el POS descarguen el modelo |
| `POST /video/analizar` | | Semana 3 |
| `POST /reportes`, `POST /agentes/reabastecimiento` | GERENTE | Semana 3 (agentes LangGraph + MCP, ver `docs/tools-mcp.md`) |

Sin modelo entrenado, clasificar y `/modelos/latest` responden **503 `MODELO_NO_DISPONIBLE`**.

## Modelo de reconocimiento

1. Fotos: 5 productos × 40 fotos en `dataset/<etiquetaModelo>/` (guía en `dataset/README.md`; no van a git).
2. Entrenar MobileNetV2 (transfer learning) y exportar a TFLite (y TF.js con `tensorflowjs`):
   ```sh
   pip install -r entrenamiento/requirements.txt
   python entrenamiento/entrenar.py --dataset dataset --salida modelos
   ```
3. ms-ia toma el nuevo `modelos/latest.json` sin reiniciar (la carpeta `modelos/` está montada en el contenedor).

Para probar todo el proceso sin fotos: `python entrenamiento/dataset_sintetico.py --salida dataset-prueba` y entrenar con `--dataset dataset-prueba`. La inferencia usa **LiteRT** (runtime ligero de TFLite), así la imagen de ms-ia no necesita TensorFlow completo.

## Estructura

```
app/
├── main.py           arma la app (rutas, errores, prefijo del gateway)
├── seguridad.py      token de Keycloak con PyJWT (JWKS en caché) y requiere_roles(...)
├── errores.py        formato { codigo, mensaje }
├── api/              sistema (/health, /yo), imagen (/imagen/clasificar), modelos
├── modelos/          clasificador TFLite
├── servicios/        clientes de otros servicios (catálogo de ms-inventario)
├── agentes/          semana 3 (LangGraph)
└── mcp/              semana 3 (FastMCP)
entrenamiento/        entrenar.py, dataset_sintetico.py
```

## Pruebas

```sh
pip install -r requirements-dev.txt
python -m pytest     # seguridad (token válido, vencido, emisor, rol) y endpoints, sin Keycloak
```
