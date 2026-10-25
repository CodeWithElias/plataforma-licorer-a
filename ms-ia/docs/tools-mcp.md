# Tools MCP de ms-ia

Servidor MCP (FastMCP) dentro de ms-ia, semana 3. Lo usan los agentes LangGraph (reportes y reabastecimiento) y n8n.
Cada tool llama a la API del servicio dueño **directo por la red de Docker** y reenvía el token de quien llamó al
agente (el gerente desde el MFE Gestión, o la cuenta de servicio de n8n, ambos con rol `GERENTE`).

| Tool | Entrada | Llama a | Devuelve |
|---|---|---|---|
| `buscar_producto` | `consulta: str` (código, nombre o marca), `tipo: str \| None` | `GET http://ms-inventario:8001/productos?tipo=` y filtra por texto; `GET /productos/{codigo}` si es un código | `[{codigo, nombre, marca, tipo, precio}]` |
| `stock_actual` | `codigos: list[str] \| None` (vacío = todos), `solo_bajo_minimo: bool = False` | `GET http://ms-inventario:8001/stock` | `[{productoCodigo, cantidad, reservado, disponible, minimo}]` |
| `ventas_por_periodo` | `desde: str`, `hasta: str` (ISO 8601; `hasta` exclusivo) | `GET http://ms-ventas:8080/ventas?desde=&hasta=` | `[{numero, fecha, total, items:[{productoCodigo, productoNombre, cantidad, subtotal}]}]` |
| `crear_orden_compra` | `proveedorId: str`, `lineas: [{productoCodigo, cantidad, precioUnitario}]` | mutation `crearOrdenCompra(input: {proveedorId, origen: AGENTE, lineas})` en `http://ms-gestion:3000/graphql` | `{id, numero, total, estado}` |

Errores: si el servicio responde `{codigo, mensaje}` (p. ej. `SIN_PERMISO`), la tool lo devuelve como error con ese
código para que el agente lo explique en su respuesta.

## Flujos que las usan

- **CU06 – Reabastecer** (`POST /agentes/reabastecimiento`, lo llama n8n con `{productoCodigo, cantidad, minimo}`):
  `stock_actual` → `ventas_por_periodo` (últimos 30 días, para estimar cuánto pedir) → proveedor del producto
  (`proveedores` en ms-gestion) → `crear_orden_compra`.
- **CU07 – Reporte por lenguaje natural** (`POST /reportes`): el agente elige entre `ventas_por_periodo`,
  `stock_actual` y `buscar_producto`, y arma `{columnas, datos, tipoGrafico, resumen}`.
