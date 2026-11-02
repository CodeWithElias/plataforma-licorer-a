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
docker compose up -d --build ms-ia     # levanta también ollama y ollama-init
```

**LLM de los agentes (Ollama).** El compose levanta `ollama` (CPU, puerto 11434) y `ollama-init`, que descarga el modelo
`OLLAMA_MODEL` de `.env` (por defecto `qwen2.5:3b`, ~2 GB) la primera vez y se apaga. Mientras se descarga, o si Ollama está
caído, los agentes responden igual con su plan B sin LLM (texto armado con reglas). Para seguir la descarga:
`docker compose logs -f ollama-init`. Para ver que ya está: `GET /health` → `components.ollama.modelos` incluye el modelo.
Para cambiar de modelo, edita `OLLAMA_MODEL` y vuelve a correr `docker compose up -d ollama-init ms-ia`.

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
| `POST /video/analizar` (multipart `video`) | CAJERO, ALMACEN, GERENTE | ✅ Semana 3 (CU04): 1 frame/s con OpenCV + clasificador |
| `POST /reportes`, `POST /agentes/reabastecimiento` | GERENTE | ✅ Semana 3 (agentes LangGraph + MCP, ver `docs/tools-mcp.md`) |
| `GET /mcp/tools`, `POST /mcp/tools/{nombre}` | según tool | ✅ Semana 3 (Servidor MCP FastMCP) |

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
