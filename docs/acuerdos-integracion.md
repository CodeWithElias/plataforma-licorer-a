# Acuerdos de integración

Puntos donde un servicio llama a otro. Los contratos completos están en cada servicio:
[ms-ventas](../ms-ventas/docs/openapi.yaml) · [ms-inventario](../ms-inventario/docs/openapi.yaml) · [ms-gestion](../ms-gestion/schema.graphql) · [ms-ia](../ms-ia/docs/openapi.yaml).

Reglas comunes:

- Entre microservicios se llama **directo por la red de Docker** (`http://ms-inventario:8000`, …); solo los frontends y la app pasan por Nginx.
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

### Con ms-gestion (Dev 2) – a confirmar con Dev 2

URL: `http://ms-gestion:3000/graphql` (`POST`, `Content-Type: application/json`, `Authorization: Bearer <token del cajero>`).

```graphql
mutation RegistrarIngreso($in: IngresoInput!) {
  registrarIngreso(input: $in) { id estado }
}
# variables: { "in": { "operationId": "<uuid>", "ventaId": "<uuid>", "sucursalId": "SUC-01", "monto": 72.0 } }

mutation AnularIngreso($operationId: String!) {
  anularIngreso(operationId: $operationId) { id estado }
}
```

Lo que necesita ms-ventas de ms-gestion:

1. **`registrarIngreso` idempotente:** si el `operationId` ya existe, devuelve el ingreso existente (no error). Lo garantiza el índice único `ingresos.operationId` de `db/gestion.js`.
2. **`anularIngreso` idempotente:** si ya está `ANULADO`, lo devuelve tal cual. Si no existe, responde un error GraphQL con `extensions.code = "INGRESO_NO_ENCONTRADO"`, que ms-ventas toma como compensación hecha.
3. Cualquier otro error (`errors[]` en la respuesta, HTTP distinto de 200 o timeout) se trata como fallo del paso → compensación.
4. Mientras ms-gestion no esté listo, ms-ventas usa un `GestionPort` falso que responde OK o falla a pedido.

## 2. Tools MCP de ms-ia (Dev 3) – a confirmar con Dev 3

Las tools llaman directo a los servicios dueños y reenvían el token del usuario o de n8n que llamó al agente. Todas las rutas exigen al menos rol `GERENTE` (o `ALMACEN` para stock), que tienen el gerente y la cuenta de servicio de n8n.

| Tool | Servicio | Llamada | Rol |
|---|---|---|---|
| `buscar_producto` | ms-inventario | `GET http://ms-inventario:8000/productos?tipo=` y `GET /productos/{codigo}` | cualquiera con token |
| `stock_actual` | ms-inventario | `GET http://ms-inventario:8000/stock?sucursal=SUC-01` | GERENTE, ALMACEN |
| `ventas_por_periodo` | ms-ventas | `GET http://ms-ventas:8080/ventas?desde=&hasta=&sucursal=` (fechas ISO 8601, `hasta` exclusivo) | GERENTE |
| `crear_orden_compra` | ms-gestion | mutation `crearOrdenCompra(input: { proveedorId, origen: AGENTE, lineas })` | GERENTE |

## 3. Aviso de stock bajo (CU06) – ms-inventario → n8n → ms-ia

1. Al confirmar una reserva, si `cantidad < minimo` y no se avisó antes, ms-inventario llama a
   `POST http://n8n:5678/webhook/stock-bajo` con `{ productoCodigo, sucursalId, cantidad, minimo }`.
2. n8n obtiene un token con su cliente `n8n` (client credentials) y llama a
   `POST http://ms-ia:8000/agentes/reabastecimiento` con el mismo cuerpo. **Ruta exacta a confirmar con Dev 3.**
3. Si el agente crea la orden, n8n envía el correo al gerente.

## Pendientes de confirmar

- [ ] Dev 2: forma de `registrarIngreso` / `anularIngreso` y el código `INGRESO_NO_ENCONTRADO`.
- [ ] Dev 3: tabla de tools MCP y ruta del agente de reabastecimiento.
