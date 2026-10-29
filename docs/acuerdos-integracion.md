# Acuerdos de integración

Puntos donde un servicio llama a otro. Los contratos completos están en cada servicio:
[ms-ventas](../ms-ventas/docs/openapi.yaml) · [ms-inventario](../ms-inventario/docs/openapi.yaml) · [ms-gestion](../ms-gestion/schema.graphql) · [ms-ia](../ms-ia/docs/openapi.yaml).

Reglas comunes:

- Entre microservicios se llama **directo por la red de Docker** (`http://ms-inventario:8001`, …); solo los frontends y la app pasan por Nginx.
- Cada llamada **reenvía el token** que recibió el servicio que llama (el del cajero, el del gerente o el de la cuenta de servicio de n8n). No hay clientes de Keycloak nuevos para esto.
- Los errores REST tienen la forma `{ "codigo": "SIN_STOCK", "mensaje": "..." }`; el `codigo` es estable y es lo que se compara en el código.

## 1. Saga de ventas (CU02) – ms-ventas llama a ms-inventario y ms-gestion

El `operationId` de la venta (= `Idempotency-Key` del POS) identifica la operación en los 3 servicios, así cualquier paso o compensación se puede reintentar sin duplicar.

| Paso | Llamada | Compensación |
|---|---|---|
| 0 | `GET /productos/{codigo}` por ítem (nombre y precio) | – (solo lectura) |
| 1 | Venta PENDIENTE + pago simulado (local) | Venta CANCELADA, pago REEMBOLSADO |
| 2 | `POST /stock/reservas` con `reservaId = operationId` | `DELETE /stock/reservas/{reservaId}` |
| 3 | mutation `registrarIngreso` | mutation `anularIngreso` |
| 4 | `POST /stock/reservas/{reservaId}/confirmar` + venta COMPLETADA | – |

Tiempo máximo 5 s por llamada y 2 reintentos con espera; agotados, se compensa.

### Con ms-inventario (Dev 1)

Cómo interpreta ms-ventas cada respuesta:

| Llamada | Respuesta | Para la Saga |
|---|---|---|
| `POST /stock/reservas` | 201 o 200 | Reservado (200 = reintento de una reserva que ya existía) |
| | 409 `SIN_STOCK` | No hay stock → compensa y responde 409 al POS |
| | 404 `PRODUCTO_NO_ENCONTRADO` | Compensa y responde 404 al POS |
| `POST .../confirmar` | 200 | Confirmado |
| `DELETE /stock/reservas/{id}` | 200 o 404 | Compensación hecha (404 = la reserva nunca se creó) |
| Cualquiera | 5xx, timeout | Reintenta; agotados los reintentos, compensa (502 al POS) |

### Con ms-gestion (Dev 2) – implementado en la semana 2

URL: `http://ms-gestion:3000/graphql` (`POST`, `Content-Type: application/json`, `Authorization: Bearer <token del cajero>`).

```graphql
mutation RegistrarIngreso($in: IngresoInput!) {
  registrarIngreso(input: $in) { id estado }
}
# variables: { "in": { "operationId": "<uuid>", "ventaId": "<uuid>", "monto": 72.0 } }

mutation AnularIngreso($operationId: String!) {
  anularIngreso(operationId: $operationId) { id estado }
}
```

Lo que necesita ms-ventas de ms-gestion:

1. **`registrarIngreso` idempotente:** si el `operationId` ya existe, devuelve el ingreso existente (no error). Lo garantiza el índice único `ingresos.operationId` de `db/gestion.js`.
2. **`anularIngreso` idempotente:** si ya está `ANULADO`, lo devuelve tal cual. Si no existe, responde un error GraphQL con `extensions.code = "INGRESO_NO_ENCONTRADO"`, que ms-ventas toma como compensación hecha.
3. Cualquier otro error (`errors[]` en la respuesta, HTTP distinto de 200 o timeout) se trata como fallo del paso → compensación.
4. Las compensaciones son independientes: si ms-gestion está caído, la reserva se libera y la venta se cancela al instante; la anulación del ingreso queda pendiente (saga `COMPENSANDO`) y la tarea de ms-ventas la reintenta cada 30 s con el token del cliente `ms-ventas` (rol CAJERO) hasta dejarla `COMPENSADA`.

## 2. Tools MCP de ms-ia (Dev 3) – semana 3 (detalle en `ms-ia/docs/tools-mcp.md`)

Las tools llaman directo a los servicios dueños y reenvían el token del usuario o de n8n que llamó al agente. Todas las rutas exigen al menos rol `GERENTE` (o `ALMACEN` para stock), que tienen el gerente y la cuenta de servicio de n8n.

| Tool | Servicio | Llamada | Rol |
|---|---|---|---|
| `buscar_producto` | ms-inventario | `GET http://ms-inventario:8001/productos?tipo=` y `GET /productos/{codigo}` | cualquiera con token |
| `stock_actual` | ms-inventario | `GET http://ms-inventario:8001/stock` | GERENTE, ALMACEN |
| `ventas_por_periodo` | ms-ventas | `GET http://ms-ventas:8080/ventas?desde=&hasta=` (fechas ISO 8601, `hasta` exclusivo) | GERENTE |
| `crear_orden_compra` | ms-gestion | mutation `crearOrdenCompra(input: { proveedorId, origen: AGENTE, lineas })` | GERENTE |

## 3. Aviso de stock bajo (CU06) – ms-inventario → n8n → ms-ia (semana 3, Dev 1)

Workflow `n8n/workflows/cu06-reabastecimiento.json`.

1. Al confirmar una reserva, si `cantidad < minimo` y no se avisó antes, ms-inventario llama a
   `POST http://n8n:5678/webhook/stock-bajo` con `{ productoCodigo, nombre, cantidad, minimo, fecha }`.
   La marca `avisoEnviado` del stock evita avisos repetidos y se borra con `POST /stock/{codigo}/reposiciones`
   cuando el producto vuelve a quedar en o sobre el mínimo.
2. n8n pide un token con su cliente `n8n` (credencial OAuth2 *Client Credentials* que se crea sola desde
   `n8n/.env`) y llama a `POST http://ms-ia:8002/agentes/reabastecimiento` con
   `{ productoCodigo, nombre, cantidad, minimo }`. Espera hasta 120 s.
3. Lo que n8n espera del agente (Dev 3): `200 { ordenCreada: bool, numero?: string, lineas?: [{ productoCodigo, cantidad, precioUnitario }], motivo?: string }`.
4. Correo al gerente (`GERENTE_EMAIL`):
   - `ordenCreada = true`: "Orden de compra {numero} creada" con las líneas.
   - `ordenCreada = false`: aviso de stock bajo con el `motivo` del agente.
   - El agente no responde (todavía no existe, error o timeout): aviso de stock bajo igual, indicando que no se creó orden automática.

## 4. Reporte diario (CU07) – n8n → ms-ventas, ms-ia y ms-gestion (semana 3, Dev 1)

Workflow `n8n/workflows/cu07-reporte-diario.json`. Corre todos los días a las 23:00 (hora de Bolivia) y también
con `GET http://localhost:5678/webhook/reporte-diario` (opcional `?dia=AAAA-MM-DD`) para probarlo.

1. `GET http://ms-ventas:8080/ventas?desde=<día>T00:00:00-04:00&hasta=<día siguiente>T00:00:00-04:00`
   (rol GERENTE de la cuenta de servicio). Con esto arma la tabla por producto; es lo único obligatorio.
2. `POST http://ms-ia:8002/reportes` con `{ consulta: "Ventas del día <día> por producto", desde, hasta }`.
   Lo que n8n usa de la respuesta (Dev 3): `resumen` (texto para el correo) y `reporteId` (el `id` del Reporte
   guardado en ms-gestion).
3. mutation `exportarReporte(id: <reporteId>, formato: PDF) { formato url }` en ms-gestion (Dev 2) y
   `GET <url>` con el mismo token para descargar el PDF (la `url` debe ser alcanzable desde la red de Docker).
4. Correo al gerente con el total, la tabla por producto, el `resumen` y el PDF adjunto. Si falla el paso 2 o 3,
   el correo sale igual sin PDF y con una nota.

## Estado

- [x] `registrarIngreso` / `anularIngreso` con `INGRESO_NO_ENCONTRADO` (ms-gestion, semana 2).
- [x] Saga de ms-ventas contra ms-inventario y ms-gestion reales, con reintento de compensaciones (semana 2).
- [x] Lista de tools MCP (`ms-ia/docs/tools-mcp.md`) y ruta del agente de reabastecimiento.
- [x] Idempotencia de `POST /ventas` y `POST /ventas/sync` (tabla `idempotency_keys`) y sincronización offline (semana 3, Dev 1).
- [x] Aviso de stock bajo sin duplicados y reposición de stock (semana 3, Dev 1).
- [x] Workflows de n8n CU06 y CU07 con credenciales automáticas y correos por Gmail (semana 3, Dev 1).
- [ ] Servidor MCP y agentes de ms-ia; `reporteId` en la respuesta de `/reportes` (semana 3, Dev 3).
- [ ] `exportarReporte` en ms-gestion (semana 3, Dev 2).
- [ ] Cola offline del POS que llama a `POST /ventas/sync` (semana 3, Dev 2).
- [ ] Login de la app móvil desde un dispositivo: `KC_HOSTNAME` con la IP de la PC (ver `app-movil/README.md`).
