# Registro de defectos

Una fila por falla. Agrega las tuyas desde D-19, y al corregir una anota cómo se verificó.

**Estado:** Abierto → Corregido (falta verificar) → Verificado. **Severidad:** Crítico, Alto, Medio, Bajo (ver la guía).

## Defectos encontrados al revisar el código antes de probar

Ya están corregidos en el código, pero **ninguno está verificado contra el sistema levantado**: cada uno se cierra cuando pase su caso.

| ID | Severidad | CU / Req. | Componente | Descripción | Corrección | Verificar con | Estado |
|---|---|---|---|---|---|---|---|
| D-01 | Crítico | CU03 / R07 | ms-ventas | Una venta offline cancelada volvía `DUPLICADO` al reintentar y el POS la borraba: **venta cobrada perdida sin aviso** | Responde `ERROR VENTA_CANCELADA`; se conserva en la cola | E-07 | Corregido |
| D-02 | Alto | CU03 / R07 | mfe-pos | La pantalla prometía sincronización automática, pero solo había un botón manual | Sincroniza al volver la red y cada 30 s | C-CU03-04 | Corregido |
| D-03 | Alto | CU03 | mfe-pos | Si el servidor fallaba una vez, el POS quedaba "Sin conexión" hasta recargar | Revisa `/health` cada 30 s y vuelve solo | C-CU03-06 | Corregido |
| D-04 | Bajo | CU03, CU04 | mfe-pos | Dos reglas `.pos-modal-cuerpo` chocaban entre los modales. Las ventas con error tampoco se podían quitar de la cola | Reglas separadas; botón **Descartar** | C-CU03-03, C-CU03-07, C-CU04-02 | Corregido |
| D-05 | Alto | CU07 / R12 | ms-gestion | `generarReporte` usaba un secreto de ejemplo escrito en el código y no reenviaba el token del usuario | Reenvía el token; se quitó el secreto. Generar queda solo para GERENTE | C-CU07-01, C-CU07-08, D-06 | Corregido |
| D-06 | Crítico | CU07 / R12 | ms-gestion | Si ms-ia fallaba o no había ventas, guardaba un **reporte con ventas inventadas** ("Bs 473.00") | Error `IA_NO_DISPONIBLE`; sin ventas, reporte vacío | C-CU07-02, C-CU07-05, C-CU07-06 | Corregido |
| D-07 | Medio | CU07 | ms-ia | "Ventas de hoy" contaba las últimas 24 h, incluida parte de ayer | Cuenta desde las 00:00 de Bolivia | C-CU07-04 | Corregido |
| D-08 | Alto | CU07 / R13 | n8n | El reporte diario nunca llevaba PDF: ms-ia no da un id de reporte y la URL era relativa | El workflow genera el reporte en ms-gestion y arma la URL | C-CU07-10 | Corregido |
| D-09 | Alto | Todos | mfe-pos | Un merge rompió la compilación de `Pos.tsx` y `api.test.ts`, con buscador y escáner duplicados | Se resolvió el merge; queda el escáner `EscanerCamara` | A-08, C-CU04-02 | Corregido |
| D-10 | Bajo | – | ms-gestion | Error de tipos en `exportar-reporte.spec.ts` (no impedía correr las pruebas) | Corregido | A-03 | Corregido |
| D-11 | Crítico | CU06 / R04, R14 | ms-gestion | `crearOrdenCompra` y `ordenesCompra` estaban en el esquema, pero sin implementar: el contexto `compras` estaba vacío y el agente nunca podía crear la orden | Contexto `compras` implementado con pruebas unitarias | A-03, C-CU06-03, C-CU06-04 | Corregido |
| D-12 | Alto | R04 | ms-ia | El agente de reabastecimiento seguía pasos fijos; el LLM solo redactaba | El LLM elige tools y decide si pedir y cuánto. Reglas de seguridad: sin stock bajo no compra, tope de cantidad, tiempo máximo y plan B. Probado con Ollama real | C-CU06-14, 15, 16 | Corregido |
| D-13 | Alto | R12 | ms-ia | Los reportes se interpretaban por palabras clave | El LLM interpreta el pedido en JSON validado; las reglas quedan como plan B. 6 de 6 frases bien con Ollama real | C-CU07-14 | Corregido |
| D-14 | Alto | R14 | ms-ia | Las tools eran funciones por REST, sin protocolo MCP | Servidor FastMCP en `/mcp-server/mcp` con token; los agentes lo usan como clientes MCP. Probado con cliente real y `curl` | C-CU06-13 | Corregido |
| D-15 | Alto | R06 | mfe-pos | El navegador calculaba pesos con código propio | Usa TensorFlow.js: descarga el modelo, lo guarda en IndexedDB y predice con él | A-08, C-CU04-05 | Corregido |
| D-16 | Alto | R05 | app-movil | La app calculaba pesos con código propio y tenía botones de muestras simuladas | Usa `tflite_flutter`; sin modelo válido avisa. Falta compilar el APK y probarlo en un dispositivo con un modelo real | A-09, C-CU04-11 | Corregido |
| D-17 | Medio | R14 | ms-ia | El código usaba `e.status`, inexistente: un 404 de una tool daba error interno. Un token mal formado daba 500 | Corregido: `e.estado`, y el token mal formado da 401 | C-CU06-13 | Corregido |
| D-18 | Alto | R07, CU04 | app-movil | El catálogo offline se guardaba en un archivo JSON en la carpeta temporal, no en SQLite, y sus semillas tenían precios inventados (Paceña Bs 15 en vez de Bs 12). La etiqueta del servidor tampoco se leía | SQLite real con `sqflite` y `lib/db/esquema.sql`; semillas iguales al catálogo. Probado en SQLite en memoria; falta probar en un dispositivo | A-09, C-CU04-10 | Corregido |

## Observaciones abiertas

Riesgos conocidos sin corregir. Decide con el equipo si se corrigen o se declaran en el informe.

| ID | Severidad | Componente | Observación | Caso |
|---|---|---|---|---|
| O-01 | Medio | ms-ventas | Si `confirmar` se aplica en inventario pero se pierde la respuesta, la Saga compensa, inventario responde 409 `RESERVA_CONFIRMADA` y la saga queda en `COMPENSANDO` para siempre, con la venta cancelada y el stock ya descontado. Improbable, pero real | Revisión de código |
| O-02 | Medio | ms-gestion | `/reportes/descargar/{id}` no pide token: cualquiera con el enlace descarga el reporte | D-08 |
| O-03 | Medio | ms-gestion | `npm audit`: 6 vulnerabilidades altas (`xlsx`, `multer`, `body-parser`, `@nestjs/*`…) | D-09 |
| O-04 | Medio | Todos | Cobertura unitaria baja en adaptadores, controladores y frontends (ms-ventas 36.8 %) | A-10, A-11 |
| O-05 | Alto | ms-ia, mfe-pos, app-movil | R05, R06, R10: ya hay un MobileNetV2 real (`20261106-204346`, TFLite de 8.9 MB y TF.js) que carga y da los mismos resultados en LiteRT y TF.js. Pero se entrenó con solo 54 fotos: 63.6 % en 11 fotos de validación (Absolut y JW Red 100 %; Casa Real, Huari y Paceña 0 %), con confianzas bajo el 80 %, que es el mínimo para agregar al carrito. Falta reentrenar con fotos propias | C-CU04-01…04, C-CU04-11 |
| O-06 | Medio | app-movil | Keycloak publica `http://localhost/auth`. Por red Wi-Fi el login no vuelve; la guía usa `adb reverse`, aún sin probar | C-CU04-09 |
| O-07 | Alto | mfe-pos | Recargar la PWA sin red puede fallar: `keycloak.init` con `login-required` intenta ir al login. Sin comprobar | C-CU03-08 |
| O-08 | Alto | Documentación | Faltan artefactos ICONIX: CU01, CU02, CU05, clases de ms-ventas y ms-inventario, componentes y despliegue | G-01…05 |
| O-09 | Bajo | Plan vs. sistema | El plan espera "2 respuestas DUPLICADO" al reenviar `POST /ventas`; el sistema da 3 respuestas 201 idénticas con `Idempotent-Replayed`. `DUPLICADO` solo existe en `/ventas/sync`. Actualiza el plan y la demo | E-03 |
| O-10 | Bajo | mfe-pos | `CamaraModal.tsx` (escáner simulado) ya no se usa | Inspección |
| O-11 | Alto | Git | El commit `0724bd9` ("entrenar con fotos reales") está solo en `origin/maykoldev`, no en `develop`. Es la misma técnica de 212 bytes. Si se une tal cual, `latest.json` apunta a `20261104-095057`, carpeta que no está en git (agrega `/modelos/` a `.gitignore`), y el servidor no encontraría el modelo | C-CU04-07 |
| O-12 | Bajo | ms-ia | El modelo `qwen2.5:3b` en CPU es lento (un reporte unos 30–40 s; el agente hasta unos 2 min) y a veces decide distinto entre corridas. Las reglas de seguridad acotan el riesgo. Conviene comentarlo en la defensa | C-CU06-14, C-CU07-14 |
| O-14 | Alto | `dataset/` | Dataset limpiado el 2026-11-06. Las 200 imágenes originales salían de unas 8 fotos, giradas y espejadas, y varias eran de otro producto (Absolut Extrakt, Gold Label, Los Parrales). Quedan 54 fotos distintas con fuente en `dataset/ATRIBUCIONES.csv`: Absolut 21, JW Red 14, Huari 10, Paceña 7, Casa Real 2; lo descartado está en `dataset-descartado/`. Faltan fotos de Casa Real, Paceña y Huari para entrenar con buena precisión | C-CU04-04 |
| O-16 | Alto | Infra | Atlas rechaza la conexión desde la IP actual de la PC (error TLS 80) y `ms-gestion` queda sin base. Agregar la IP en *Network Access* | B-01 |
| O-17 | Bajo | Plan vs. sistema | El análisis de video existe en `ms-ia`, pero se decidió no probarlo. Declararlo en el informe | Fuera de alcance |
| O-18 | Alto | Git | El `.gitignore` de la raíz tiene `modelos/`, que también ignora `ms-ia/modelos/`. `latest.json` sí está en git y apunta a `20261106-204346`, una carpeta que no se sube: en un clon limpio ms-ia no encontraría el modelo y el POS no podría descargarlo | H-03, C-CU04-07 |
| O-13 | Bajo | Plan vs. sistema | Librerías distintas al plan, con la función cubierta: gráfico sin ECharts, `xlsx` en vez de exceljs, IndexedDB nativo en vez de Dexie, cliente de FastMCP en vez de `langchain-mcp-adapters` (no es compatible con la versión actual de `mcp`) | Inspección |

## Defectos encontrados durante la ejecución

| ID | Fecha | Severidad | Caso | Componente | Pasos para reproducir | Esperado | Obtenido | Evidencia | Estado | Corrección y verificación |
|---|---|---|---|---|---|---|---|---|---|---|
| D-19 | | | | | | | | | | |
