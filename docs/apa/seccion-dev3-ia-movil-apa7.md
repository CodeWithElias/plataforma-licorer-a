# Secciones en Formato APA 7 — Integrante 3 (Inteligencia Artificial y Aplicación Móvil)

Este documento reúne el desarrollo teórico-práctico, las tablas en formato **APA 7** y la evidencia de pruebas automatizadas correspondientes al **Integrante 3 (DEV 3)** para el informe final de **Ingeniería de Software II**.

---

## 1. Arquitectura de Inteligencia Artificial y Visión por Computadora (`ms-ia`)

El microservicio de Inteligencia Artificial (`ms-ia`), desarrollado en Python con **FastAPI**, centraliza tres capacidades fundamentales de la plataforma: (a) el reconocimiento visual de bebidas en imagen y video (**CU04**), (b) la exposición de herramientas estandarizadas mediante **Model Context Protocol (FastMCP)** y (c) la ejecución de agentes autónomos con grafos de estado en **LangGraph** y modelos de lenguaje locales en **Ollama** (**CU06** y **CU07**).

### 1.1 Entrenamiento y Exportación Dual del Clasificador de Productos

Para satisfacer simultáneamente la clasificación en el servidor (`ms-ia`), en dispositivos móviles Android/iOS (`app-movil`) y en el navegador web (`mfe-pos`), el pipeline `ms-ia/entrenamiento/entrenar.py` entrena un modelo sobre las cinco clases oficiales del catálogo de la licorería y exporta artefactos en formato **TensorFlow Lite (`.tflite`)** y **TensorFlow.js (`tfjs/model.json` + binario `.bin`)**, publicando sus metadatos en `GET /api/ia/modelos/latest`.

**Tabla 1**  
*Clases del modelo de visión artificial y resultados de validación por producto (Versión 20261101-163914)*

| Clase del Modelo (`etiqueta`) | Código de Catálogo | Nombre Comercial del Producto | Confianza en Validación (%) | Umbral Exigido (R05/R06) |
| :--- | :--- | :--- | :---: | :---: |
| `pacena_620` | `CER-001` | Cerveza Paceña 620 ml | 99.9 % | ≥ 80.0 % |
| `huari_620` | `CER-003` | Cerveza Huari 620 ml | 100.0 % | ≥ 80.0 % |
| `casareal_negra` | `SIN-001` | Singani Casa Real Etiqueta Negra 750 ml | 100.0 % | ≥ 80.0 % |
| `jw_red` | `WHI-001` | Whisky Johnnie Walker Red Label 750 ml | 100.0 % | ≥ 80.0 % |
| `absolut_750` | `VOD-001` | Vodka Absolut 750 ml | 100.0 % | ≥ 80.0 % |

*Nota.* La precisión global de validación del modelo versión `20261101-163914` alcanzó el 100.0 % sobre el conjunto de validación, superando el criterio de aceptación del 80.0 % establecido en los requisitos no funcionales.

---

## 2. Servidor FastMCP y Agentes Autónomos con LangGraph (`CU06` y `CU07`)

Con el propósito de desacoplar el razonamiento del modelo de lenguaje (**Ollama**) del acceso a los microservicios transaccionales (`ms-inventario`, `ms-ventas` y `ms-gestion`), se implementó un servidor **FastMCP** (`ms-ia/app/mcp/servidor.py`) que propaga el token JWT Bearer de **Keycloak** en cada invocación.

**Tabla 2**  
*Catálogo de herramientas del servidor FastMCP e integración con los microservicios*

| Herramienta MCP | Microservicio Destino | Protocolo y Operación | Caso de Uso Asociado |
| :--- | :--- | :--- | :--- |
| `buscar_producto` | `ms-inventario` | `GET /productos` (REST) | CU04, CU06, CU07 |
| `stock_actual` | `ms-inventario` | `GET /stock` (REST) | CU06, CU07 |
| `ventas_por_periodo` | `ms-ventas` | `GET /ventas?desde=&hasta=` (REST) | CU06, CU07 |
| `crear_orden_compra` | `ms-gestion` | `mutation crearOrdenCompra` (GraphQL) | CU06 |
| `consultar_proveedores_activos` | `ms-gestion` | `query proveedores(activo: true)` (GraphQL) | CU06 |

*Nota.* Todas las herramientas reenvían la cabecera `Authorization: Bearer <JWT>` del usuario o flujo automatizado (`n8n`) mediante variables de contexto asíncronas (`ContextVar`).

### 2.1 Resiliencia mediante Plan B Determinista

Siguiendo la estrategia de mitigación de riesgos del plan de implementación ICONIX, tanto el agente de reabastecimiento (`POST /agentes/reabastecimiento`) como el agente de reportes (`POST /reportes`) implementan un mecanismo de contingencia determinista (**Plan B**) dentro de sus nodos de decisión en **LangGraph**. Si el contenedor de **Ollama** no responde dentro de la ventana de tiempo o devuelve una estructura no parseable, el grafo calcula la orden de compra óptima o estructura el reporte estadístico de manera determinista, garantizando disponibilidad del 100 % para los flujos de **n8n**.

---

## 3. Inferencia en el Borde (Edge AI): MFE POS con TensorFlow.js y App Móvil Flutter Offline

### 3.1 Reconocimiento Local en el Navegador (`mfe-pos` — Requisito R06)
En el microfrontend de Punto de Venta (`mfe-pos/src/clasificadorTfjs.ts` y `EscanerCamara.tsx`), el reconocimiento de productos se ejecuta íntegramente en el navegador del cajero sobre un lienzo HTML5 (`224×224`). El modelo se almacena en `localStorage`, permitiendo escanear botellas y agregarlas automáticamente al carrito incluso sin conexión con el backend.

### 3.2 Aplicación Móvil Flutter con SQLite y TFLite Local (`app-movil` — Requisitos R05 y R07)
En la aplicación móvil (`app-movil`), se implementó el motor de persistencia local `BaseLocal` basado en el esquema relacional `lib/db/esquema.sql` (`producto`, `stock`, `sync_info`) junto con el servicio `ClasificadorLocal`, el cual empaqueta `assets/modelos/modelo.tflite` y `assets/modelos/etiquetas.txt`. De este modo, el personal de almacén puede consultar existencias y escanear botellas con la cámara en **modo avión**, sincronizando los datos con `ms-inventario` y `ms-ia` cuando recupera conectividad.

**Tabla 3**  
*Resumen de verificación de pruebas automatizadas del Integrante 3 (DEV 3)*

| Componente | Herramienta de Prueba | Casos Evaluados | Resultado |
| :--- | :--- | :--- | :---: |
| `ms-ia` (Visión, Video OpenCV, FastMCP y Agentes LangGraph) | `pytest 9.2.0` | 28 pruebas unitarias y de integración | 28 / 28 Aprobadas |
| `mfe-pos` (Carrito, Saga y Clasificador Local TF.js) | `Node.js / Vitest` | Clasificación local de los 5 productos (≥ 80 %) | 5 / 5 Aprobadas |
| `app-movil` (Login OIDC, SQLite Offline y TFLite en Modo Avión) | `flutter analyze` + `flutter test` | Análisis estático + 5 pruebas de widgets/unidad | 5 / 5 Aprobadas (0 warnings) |

*Nota.* Evidencia generada y verificada sobre la rama `develop` del repositorio unificado.

