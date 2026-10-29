# Guion de pruebas – todo el sistema (semanas 1 a 3)

Recorre todo lo que funciona hoy, en el orden en que conviene probarlo. Cada paso dice **qué hacer** y **qué debe pasar** (✅).
Marca `[x]` al terminar. Tiempo aproximado: 2 h. Si algo falla, anota el paso y el mensaje, y sigue con el siguiente.

| Parte | Qué se prueba | Caso de uso | Dueño | Dónde |
|---|---|---|---|---|
| 0 | Preparación y verificación automática | – | Dev 1 | Terminal |
| 1 | Keycloak y su pantalla de login | CU01 | Dev 1 | Navegador |
| 2 | Inicio de sesión único y menú por rol | CU01 | Dev 1 + Dev 2 | Navegador |
| 3 | Venta con Saga: normal, sin stock y falla forzada | CU02 | Dev 1 + Dev 2 | Navegador + DBeaver + Compass |
| 4 | Idempotencia de las ventas | CU03 | Dev 1 | Postman |
| 5 | Ventas offline: sincronización | CU03 | Dev 1 | Postman |
| 6 | Concurrencia de stock | CU02 | Dev 1 | Terminal |
| 7 | Proveedores | CU05 | Dev 2 | Navegador + Compass |
| 8 | Aviso de stock bajo y reposición | CU06 | Dev 1 | Navegador + Postman + Gmail + n8n |
| 9 | Reporte diario | CU07 | Dev 1 | Navegador + Gmail |
| 10 | APIs de cada microservicio | – | Todos | Postman / Swagger |
| 11 | Reconocimiento de productos | CU04 | Dev 3 | Postman / Swagger |
| 12 | POS como PWA independiente | CU02 | Dev 2 | Navegador |
| 13 | App móvil | CU04 | Dev 3 | Celular / emulador |
| 14 | Pruebas automáticas de cada proyecto | – | Todos | Terminal |

## Datos que vas a usar

| Usuario | Contraseña | Rol | Qué puede hacer en la web |
|---|---|---|---|
| `cajero01` | `cajero01` | CAJERO | Punto de venta |
| `gerente01` | `gerente01` | GERENTE | Gestión (proveedores); por API ve ventas y stock |
| `almacen01` | `almacen01` | ALMACEN | Nada en la web (usa la app); por API ve y repone stock |
| `admin01` | `admin01` | ADMIN | Punto de venta y Gestión |

Stock inicial de los productos que se usan (cantidad / mínimo / precio):

| Código | Producto | Cantidad | Mínimo | Precio |
|---|---|---|---|---|
| `CER-001` | Cerveza Paceña 620 ml | 48 | 12 | Bs 12 |
| `VIN-001` | Vino Kohlberg Tinto 750 ml | 20 | 6 | Bs 45 |
| `SIN-003` | Singani Los Parrales 750 ml | 22 | 6 | Bs 60 |
| `RON-002` | Ron Abuelo Añejo 750 ml | 9 | 3 | Bs 130 |
| `WHI-003` | Whisky Chivas Regal 12 Años 750 ml | 5 | 2 | Bs 350 |

Herramientas: navegador (Chrome o Edge, con ventanas de incógnito), **Postman**, **DBeaver**, **MongoDB Compass**, terminal **Git Bash**
y tu **Gmail** (`GERENTE_EMAIL` de `n8n/.env`).

### Tokens para Postman

| Token | Cómo se pide en Postman (*Authorization* → *OAuth 2.0* → *Get New Access Token*) |
|---|---|
| **Cajero o gerente (usuario real)** | *Grant type* **Authorization Code (With PKCE)** · Auth URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/auth?prompt=login` · Access Token URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/token` · Client ID `web-shell` · Callback URL `http://localhost/callback` · Code Challenge Method `SHA-256` → entra como `cajero01` (o `gerente01`) → *Use Token* |
| **Gerente sin login** (cuenta de servicio `n8n`) | *Grant type* **Client Credentials** · Access Token URL la misma · Client ID `n8n` · Client Secret = `N8N_CLIENT_SECRET` de `n8n/.env` |

El token dura 5 minutos: si una petición responde **401**, pide uno nuevo.

---

## 0. Preparación (Git Bash, desde la raíz del proyecto)

- [ ] **0.1 Levantar todo**
  ```sh
  docker compose up -d --build
  ```
  Keycloak tarda 1 a 2 minutos en estar listo (su base está en Supabase).
- [ ] **0.2 Dejar el stock como al inicio** (las pruebas anteriores lo cambian)
  ```sh
  docker compose exec ms-inventario php artisan inventario:seed --forzar
  ```
  ✅ `Catálogo listo: 20 productos y 20 registros de stock nuevos (forzado)`
- [ ] **0.3 Verificación automática**
  ```sh
  sh infra/verificar.sh
  ```
  ✅ Termina en `Resultado: 63 correctas, 0 fallas`. Revisa contenedores, Supabase, Atlas, DynamoDB, Keycloak, las APIs de los
  4 microservicios, la semana 3 (sincronización, reposición y workflows de n8n activos), los frontends y los puertos.
- [ ] **0.4 Usuario de n8n:** abre http://localhost:5678 → la primera vez pide crear el usuario dueño (cualquier correo y contraseña).
  ✅ En *Overview* aparecen **CU06 Reabastecimiento por stock bajo** y **CU07 Reporte diario de ventas**, ambos publicados.

---

## 1. Keycloak

- [ ] **1.1 Login con la identidad de la licorería:** abre http://localhost/ → ✅ pantalla de Keycloak **blanca y lila**, con el logo y
  "Licorería" arriba, título "Acceder a tu cuenta", campos "Usuario o email" y "Contraseña" y botón "Iniciar sesión", todo en español.
- [ ] **1.2 Usuario equivocado:** entra con `cajero01` / `mal` → ✅ mensaje de error en español y no entra.
- [ ] **1.3 Consola de administración:** http://localhost/auth/admin con `KC_BOOTSTRAP_ADMIN_*` de `infra/.env`.
  Cambia al realm **licoreria** (arriba a la izquierda).
  ✅ *Realm roles*: ADMIN, GERENTE, CAJERO, ALMACEN · *Users*: los 4 usuarios ·
  *Clients*: web-shell, app-movil, n8n, ms-gestion-admin, ms-ventas, licoreria-api.
- [ ] **1.4 PKCE:** *Clients → web-shell → Advanced* → ✅ *PKCE Method* = S256.
- [ ] **1.5 Consola de cuenta:** http://localhost/auth/realms/licoreria/account → entra como `cajero01` →
  ✅ muestra *Personal info* (sin "Something went wrong").

---

## 2. CU01 – Inicio de sesión único y menú por rol

Usa una ventana de incógnito para cada usuario (así no se mezclan las sesiones).

- [ ] **2.1** Abre http://localhost/ → ✅ redirige al login de Keycloak.
- [ ] **2.2** Entra como `cajero01` → ✅ "Bienvenido · Hola, cajero01" con la tarjeta **Punto de venta**; en la barra de arriba solo
  aparece **Punto de venta** (no Gestión) y, a la derecha, la inicial "C", "cajero01 · Cajero" y **Salir**.
- [ ] **2.3** Escribe en la barra http://localhost/gestion → ✅ tarjeta **Acceso denegado** con el candado y "Volver al inicio".
- [ ] **2.4** Pulsa **Salir** → ✅ vuelve al login de Keycloak; http://localhost/ vuelve a pedir usuario (la sesión se cerró).
- [ ] **2.5** Entra como `gerente01` → ✅ solo **Gestión** en el menú; http://localhost/pos → **Acceso denegado**.
- [ ] **2.6** Entra como `almacen01` → ✅ "Tu rol no tiene módulos en la web. El personal de almacén usa la app móvil."
- [ ] **2.7** Entra como `admin01` → ✅ ve **Punto de venta** y **Gestión**, y puede abrir los dos.
- [ ] **2.8 Una sola sesión:** con `admin01` ya dentro, abre en otra pestaña http://localhost/mfe-pos/ → ✅ entra sin volver a pedir
  contraseña (inicio de sesión único).

---

## 3. CU02 – Venta con Saga

Abre también, para ver los datos por dentro:

- **DBeaver** → PostgreSQL de Supabase con `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` de `ms-ventas/.env` (SSL: *require*).
- **MongoDB Compass** → `MONGO_URL` de `ms-gestion/.env`, base `gestion`.
- **NoSQL Workbench** (opcional) → DynamoDB local en `localhost:8000`, tablas `Stock` y `Reservas`.

Consultas de DBeaver que se usan en esta guía:
```sql
SELECT numero, estado, origen, total, operation_id, fecha FROM venta ORDER BY numero DESC LIMIT 5;
SELECT p.estado AS pago, p.metodo, v.numero FROM pago p JOIN venta v ON v.id = p.venta_id ORDER BY v.numero DESC LIMIT 5;
SELECT v.numero, s.paso_actual, s.estado, s.error FROM saga_instancia s JOIN venta v ON v.id = s.venta_id ORDER BY s.creado_en DESC LIMIT 5;
```

### 3.1 Venta normal
- [ ] Como `cajero01` entra a **Punto de venta** → ✅ "20 productos disponibles", tarjetas con la etiqueta de color de cada tipo.
- [ ] Escribe "paceña" en el buscador y luego prueba los filtros por tipo (Cerveza, Vino…) → ✅ la lista se filtra; vuelve a **Todos**.
- [ ] Toca **Cerveza Paceña 620 ml** dos veces y **Vino Kohlberg** una vez → ✅ en las tarjetas aparece el contador (2 y 1) y en
  "Venta actual" se ven las dos líneas, "3 unidades" y total **Bs 69.00**.
- [ ] Prueba **+ / −** en el carrito y vuelve a dejar 2 + 1.
- [ ] Elige **Tarjeta** y pulsa **Cobrar Bs 69.00** → ✅ aviso verde **"Venta Nº N completada · Total cobrado Bs 69.00"** y el carrito se vacía.
- [ ] **DBeaver:** la venta N está `COMPLETADA` con `origen` `ONLINE`, el pago `APROBADO` con método `TARJETA`, y la saga
  `COMPLETADA` en el paso `CONFIRMAR`.
- [ ] **Compass:** en `ingresos` hay un documento con el `operationId` de la venta, `monto` 69 y `estado` `ACTIVO`.
- [ ] **Stock** (en la parte 10 con `GET /stock`, o en NoSQL Workbench): CER-001 bajó de 48 a 46 y VIN-001 de 20 a 19.

### 3.2 Sin stock
- [ ] Toca **Whisky Chivas Regal 12 Años** 6 veces (hay 5) y **Cobrar** → ✅ aviso rojo **"No se registró la venta · Sin stock
  suficiente: Whisky Chivas Regal 12 Años 750 ml (pediste 6, hay 5)"**.
- [ ] **DBeaver:** la venta queda `CANCELADA`, el pago `REEMBOLSADO` y la saga `COMPENSADA` en el paso `RESERVAR_STOCK`.
- [ ] El stock del Chivas sigue en 5 (no se reservó nada).

### 3.3 Falla forzada (rollback automático)
- [ ] En la terminal: `docker compose stop ms-gestion`
- [ ] En el POS vende 1 **Vino Kohlberg** → ✅ aviso rojo **"No se pudo completar la venta y se revirtió automáticamente (stock
  liberado y pago reembolsado). Intenta de nuevo."**
- [ ] **DBeaver:** venta `CANCELADA`, pago `REEMBOLSADO`, saga **`COMPENSANDO`** en el paso `REGISTRAR_INGRESO` (el error dice
  que falta anular el ingreso porque ms-gestion está apagado).
- [ ] **Stock:** VIN-001 sigue en 19 (la reserva se liberó al instante). En NoSQL Workbench la reserva con ese `operation_id` está `LIBERADA`.
- [ ] En la terminal: `docker compose start ms-gestion` y espera hasta 60 s.
- [ ] **DBeaver:** la misma saga pasa sola a ✅ **`COMPENSADA`** (la tarea de reintentos de cada 30 s usó el cliente `ms-ventas` de Keycloak).

---

## 4. CU03 – Idempotencia de las ventas (Postman, token de `cajero01`)

- [ ] `POST http://localhost/api/ventas/ventas`, encabezado `Idempotency-Key: 11111111-2222-3333-4444-555555555555`, cuerpo:
  ```json
  { "items": [ { "productoCodigo": "CER-001", "cantidad": 1 } ], "pago": { "metodo": "QR" } }
  ```
  ✅ **201** con `estado: COMPLETADA`.
- [ ] Envía **exactamente lo mismo** otra vez, y una tercera → ✅ **201** con **el mismo cuerpo, letra por letra** (mismo `id` y
  `numero`) y en *Headers* de la respuesta `Idempotent-Replayed: true`. El stock de CER-001 bajó **solo una vez**.
- [ ] Con otra clave y `cantidad: 9999` → ✅ **409** `SIN_STOCK`. Repite con la misma clave → ✅ el mismo 409 y no se crea otra venta.
- [ ] `Idempotency-Key: abc` → ✅ **400** `DATOS_INVALIDOS` ("debe ser un UUID").
- [ ] Sin el encabezado `Idempotency-Key` → ✅ **400** `DATOS_INVALIDOS`.
- [ ] Con un producto inexistente (`XXX-999`) y otra clave → ✅ **404** `PRODUCTO_NO_ENCONTRADO`.
- [ ] Usa la clave `11111111-2222-3333-4444-555555555555` en `POST /api/ventas/ventas/sync` → ✅ **422** `IDEMPOTENCY_KEY_REUSADA`.
- [ ] Con el token de `gerente01` → ✅ **403** `SIN_PERMISO` (solo el cajero vende) · sin token → ✅ **401** `NO_AUTENTICADO`.
- [ ] **DBeaver:** `SELECT clave, endpoint, estado_http, respuesta FROM idempotency_keys ORDER BY creado_en DESC LIMIT 5;` → ✅ la
  clave `11111111-…` con 201 y la respuesta guardada. Los 400 y 404 no se guardan (esa clave se puede reintentar corregida).

---

## 5. CU03 – Ventas offline: sincronización (Postman, token de `cajero01`)

La cola offline del POS todavía no existe (Dev 2, semana 3); aquí se simula con Postman lo que enviará el POS al reconectarse.

- [ ] `POST http://localhost/api/ventas/ventas/sync` con este cuerpo (la misma venta dos veces, una sin stock y una mal formada):
  ```json
  [
    { "operationId": "aaaaaaaa-0000-4000-8000-000000000001", "items": [ { "productoCodigo": "VIN-001", "cantidad": 1 } ], "pago": { "metodo": "QR" }, "fechaLocal": "2026-10-28T09:15:00-04:00" },
    { "operationId": "aaaaaaaa-0000-4000-8000-000000000001", "items": [ { "productoCodigo": "VIN-001", "cantidad": 1 } ], "pago": { "metodo": "QR" }, "fechaLocal": "2026-10-28T09:15:00-04:00" },
    { "operationId": "aaaaaaaa-0000-4000-8000-000000000002", "items": [ { "productoCodigo": "WHI-003", "cantidad": 9999 } ], "pago": { "metodo": "EFECTIVO" }, "fechaLocal": "2026-10-28T09:20:00-04:00" },
    { "operationId": "no-es-uuid", "items": [ { "productoCodigo": "CER-001", "cantidad": 1 } ], "pago": { "metodo": "EFECTIVO" } }
  ]
  ```
  ✅ **200** con `[OK, DUPLICADO, ERROR SIN_STOCK, ERROR DATOS_INVALIDOS]` en ese orden. Un ítem malo no tumba el lote.
- [ ] Envía el lote otra vez → ✅ la primera venta ahora es `DUPLICADO` con el mismo `ventaId` (no se vende dos veces).
- [ ] `GET http://localhost/api/ventas/ventas/{ventaId}` → ✅ `origen: OFFLINE` y `fecha` = la `fechaLocal` enviada (09:15 de Bolivia).
- [ ] Un lote con un `operationId` nuevo y `fechaLocal` de mañana → ✅ OK, pero se guarda con la hora del servidor.
- [ ] Un lote vacío `[]` → ✅ **400** `DATOS_INVALIDOS`.

> Si repites esta parte otro día, cambia los `operationId` (`…0001` → `…0011`); si no, todo sale `DUPLICADO`, que también es correcto.

---

## 6. Concurrencia de stock (Git Bash)

Prueba que DynamoDB no vende dos veces la última unidad (bloqueo optimista). Copia el token de `cajero01` desde Postman.

- [ ] Deja el Chivas con 1 unidad: en el POS vende **4 Whisky Chivas Regal** (hay 5) → ✅ venta completada.
- [ ] Lanza dos ventas de 1 Chivas **al mismo tiempo**:
  ```sh
  TOKEN='<pega aquí el token de cajero01>'
  for i in 1 2; do
    curl -s -o /dev/null -w "venta $i: %{http_code}\n" -X POST http://localhost/api/ventas/ventas \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -H "Idempotency-Key: $(python -c 'import uuid; print(uuid.uuid4())')" \
      -d '{"items":[{"productoCodigo":"WHI-003","cantidad":1}],"pago":{"metodo":"EFECTIVO"}}' &
  done; wait
  ```
  ✅ Una responde **201** y la otra **409** (`SIN_STOCK`). El Chivas queda en 0, nunca en −1.

> El Chivas quedó bajo su mínimo (2): en tu Gmail llega un aviso de stock bajo de este producto. Es correcto (CU06).

---

## 7. CU05 – Proveedores (como `gerente01`)

- [ ] **Gestión** → ✅ pestañas **Proveedores** y "Reportes · Próximamente"; tabla con proveedor, NIT, contacto, productos y estado.
- [ ] **+ Nuevo proveedor**: NIT `1023456789`, razón social, contacto (nombre, teléfono, email) y productos `cer-001, vin-002, cer-001` →
  **Guardar** → ✅ aparece en la lista con productos `CER-001` y `VIN-002` (en mayúsculas y sin repetir) y estado **Activo**.
- [ ] Crea otro con el **mismo NIT** → ✅ "No se pudo guardar · Ya existe un proveedor con ese NIT."
- [ ] NIT `ABC` → ✅ "El NIT debe tener entre 5 y 15 dígitos." y **Guardar** queda deshabilitado.
- [ ] Email inválido (`juan@`) → ✅ "El email no es válido."
- [ ] **Editar** el proveedor: cambia la razón social y apaga el interruptor **Proveedor activo** → ✅ en la lista figura **Inactivo** (en gris).
- [ ] Filtro **Activos / Inactivos** → ✅ filtra la lista; el pie dice cuántos hay.
- [ ] **Compass:** colección `proveedores` con el documento creado y editado.

---

## 8. CU06 – Aviso de stock bajo y reposición

n8n llama al agente de reabastecimiento de ms-ia; como ese agente todavía no existe (Dev 3), el correo sale igual y dice que no se
creó una orden automática. Usa el token **gerente sin login** para ver y reponer stock.

- [ ] `GET http://localhost/api/inventario/stock` → ✅ `RON-002` con `cantidad: 9`, `minimo: 3`, `bajoMinimo: false`, `avisoEnviado: false`.
- [ ] Como `cajero01`, vende en el POS **7 Ron Abuelo Añejo** (quedan 2, bajo el mínimo de 3) → ✅ en unos segundos llega a tu Gmail
  **"Stock bajo: Ron Abuelo Añejo 750 ml (quedan 2)"** con la tabla Producto / Quedan / Mínimo (la primera vez revisa *Spam*).
- [ ] `GET /stock` → ✅ RON-002 con `bajoMinimo: true` y `avisoEnviado: true`.
- [ ] Vende **1 Ron Abuelo** más → ✅ la venta se completa y **no** llega otro correo (ya se avisó).
- [ ] `POST http://localhost/api/inventario/stock/RON-002/reposiciones` con `{ "cantidad": 30 }` → ✅ **200** con `cantidad: 31`,
  `bajoMinimo: false` y `avisoEnviado: false`.
- [ ] Con token de `cajero01` la misma reposición → ✅ **403** · `{ "cantidad": 0 }` → ✅ **400** · producto `XXX-999` → ✅ **404**.
- [ ] Vende **29 Ron Abuelo** (quedan 2) → ✅ llega un **segundo** correo.
- [ ] n8n (http://localhost:5678) → workflow **CU06** → *Executions* → ✅ una ejecución en verde por cada correo. Abre una: se ve el
  aviso de ms-inventario, la llamada al agente (con error, porque no existe) y el correo enviado.
- [ ] **n8n caído no rompe la venta:** `docker compose stop n8n`. Vende **17 Singani Los Parrales** (de 22 quedan 5, bajo el mínimo de 6)
  → ✅ la venta se completa; no llega correo y `GET /stock` muestra SIN-003 con `avisoEnviado: false`.
  `docker compose start n8n`, espera 30 s y vende **1 Singani Los Parrales** más → ✅ ahora sí llega el aviso (se reintentó).

---

## 9. CU07 – Reporte diario

Corre solo todos los días a las 23:00 (hora de Bolivia). Para no esperar:

- [ ] Abre http://localhost:5678/webhook/reporte-diario → ✅ la página responde con los datos del envío y llega a tu Gmail
  **"Reporte diario de ventas AAAA-MM-DD: Bs …"** con el número de ventas, el total y la tabla por producto ordenada por monto.
- [ ] Compara con DBeaver: `SELECT count(*), sum(total) FROM venta WHERE estado = 'COMPLETADA' AND fecha >= current_date;`
  → ✅ mismo número de ventas y total (si es de noche, ojo con el día en UTC).
- [ ] http://localhost:5678/webhook/reporte-diario?dia=2026-01-01 → ✅ reporte de ese día con "No hubo ventas este día".
- [ ] ✅ El correo dice que el PDF no está disponible: es lo esperado hasta que ms-ia tenga `/reportes` (Dev 3) y ms-gestion
  `exportarReporte` (Dev 2).
- [ ] n8n → workflow **CU07** → ✅ el disparador **Todos los días 23:00** está configurado con zona horaria America/La_Paz.

---

## 10. APIs de cada microservicio (Postman o Swagger)

### ms-inventario (http://localhost/api/inventario · directo http://localhost:8001)
- [ ] `GET /health` (sin token) → ✅ 200, DynamoDB UP con 3 tablas.
- [ ] `GET /productos` → ✅ 20 productos · `?tipo=WHISKY` → 3 · `?tipo=AGUA` → 400 · sin token → 401.
- [ ] `GET /productos/CER-001` → ✅ 200 · `GET /productos/XXX-999` → 404.
- [ ] `GET /stock` con gerente → ✅ 200 con `disponible = cantidad − reservado`, `bajoMinimo` y `avisoEnviado` · con cajero → 403.
- [ ] Con token de **cajero**, el ciclo de una reserva (`reservaId` = un UUID nuevo):
  `POST /stock/reservas` `{ "reservaId": "<uuid>", "items": [ { "productoCodigo": "CER-001", "cantidad": 2 } ] }` → ✅ 201 `ACTIVA` ·
  repetirla → 200 (no reserva dos veces) · `POST /stock/reservas/<uuid>/confirmar` → `CONFIRMADA` ·
  `DELETE /stock/reservas/<uuid>` → 409 `RESERVA_CONFIRMADA`.
- [ ] Reserva de 1000 unidades → ✅ 409 `SIN_STOCK` con `faltantes`.

### ms-ventas (http://localhost/api/ventas · directo http://localhost:8080)
- [ ] `GET /health` → ✅ db UP (Supabase).
- [ ] Swagger: http://localhost/api/ventas/swagger-ui.html → ✅ "ms-ventas" con **Authorize**; aparecen `POST /ventas`,
  `POST /ventas/sync`, `GET /ventas` y `GET /ventas/{id}`.
- [ ] `GET /ventas/{id}` (id de la parte 3) con cajero → ✅ detalle con `items`, `pago`, `origen` y `saga`.
- [ ] `GET /ventas?desde=2026-10-01T00:00:00Z&hasta=2026-12-31T00:00:00Z` con gerente → ✅ solo ventas `COMPLETADA` · con cajero → 403.
- [ ] `GET /flyway` con gerente → ✅ migraciones **1, 2 y 3** en `SUCCESS`.

### ms-gestion (http://localhost/graphql · directo http://localhost:3000)
- [ ] `GET http://localhost:3000/health` → ✅ MongoDB UP con 5 colecciones.
- [ ] `{ salud }` sin token → ✅ `"ok"` · `{ yo { usuario roles } }` sin token → `UNAUTHENTICATED`.
- [ ] `{ yo { usuario roles } }` con token → ✅ usuario y roles.
- [ ] `{ proveedores { razonSocial activo } }` con gerente → ✅ lista · con cajero → error `FORBIDDEN`.

### ms-ia (http://localhost/api/ia · directo http://localhost:8002)
- [ ] Swagger: http://localhost/api/ia/docs → ✅ lista `/health`, `/yo`, `/imagen/clasificar`, `/modelos/latest`.
- [ ] `GET /api/ia/yo` con token → ✅ usuario y roles · sin token → 401.

---

## 11. CU04 – Reconocimiento de productos (ms-ia)

> El modelo actual está entrenado con **imágenes sintéticas** (todavía no hay fotos reales): reconoce formas y colores parecidos a
> los del dataset de prueba, no fotos reales de botellas. Con las fotos reales se vuelve a entrenar (ver `ms-ia/dataset/README.md`).

- [ ] `GET /api/ia/modelos/latest` → ✅ versión, 5 etiquetas y la URL del `.tflite`; descargar esa URL con token → 200 (~9 MB).
- [ ] Genera una imagen de prueba:
  ```sh
  docker compose exec ms-ia python -c "from PIL import Image,ImageDraw;i=Image.new('RGB',(224,224),(230,225,215));ImageDraw.Draw(i).rectangle([40,30,190,200],fill=(200,160,40));i.save('/tmp/pacena.jpg')"
  docker compose cp ms-ia:/tmp/pacena.jpg ./pacena.jpg
  ```
- [ ] `POST /api/ia/imagen/clasificar` (form-data, campo `imagen` = `pacena.jpg`) con cajero →
  ✅ `productoCodigo: CER-001`, `nombre: Cerveza Paceña 620 ml`, confianza > 0.9.
- [ ] Con token de `admin01` → ✅ 403 · archivo vacío → 400.

---

## 12. POS como PWA independiente

- [ ] En incógnito abre http://localhost/mfe-pos/ → ✅ pide login de Keycloak por su cuenta; entra como `cajero01` → carga el catálogo
  con el mismo diseño que dentro del Shell.
- [ ] Haz una venta desde aquí → ✅ "Venta Nº … completada".
- [ ] En Chrome/Edge: icono de **instalar app** en la barra de direcciones → ✅ se instala como "POS" con el ícono lila.
- [ ] Directo por su puerto: http://localhost:4202/mfe-pos/ y Gestión en http://localhost:4201/mfe-gestion/ → ✅ cargan.

---

## 13. App móvil (Flutter)

```sh
cd app-movil
cd android && gradlew --stop && cd ..
flutter clean && flutter pub get
flutter run --dart-define-from-file=.env      # .env: API_URL=http://<IP de tu PC>  (emulador: http://10.0.2.2)
```

- [ ] ✅ La app compila e instala; muestra **Licorería** y el botón **Iniciar sesión** con la dirección del servidor.
- [ ] Al pulsar **Iniciar sesión** se abre la página de Keycloak.

> **Limitación conocida:** Keycloak publica su URL como `http://localhost/auth`, así que desde el teléfono el login todavía no puede
> completarse y la cámara queda detrás del login. Se resuelve configurando `KC_HOSTNAME` con la IP de la PC (integración de CU04).

---

## 14. Pruebas automáticas de cada proyecto

| Proyecto | Comando (desde su carpeta) | ✅ Esperado |
|---|---|---|
| ms-ventas | `./mvnw test` | 18 pruebas (Saga, sincronización e idempotencia con puertos falsos) |
| ms-inventario | `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app composer:2 sh -c "composer install -q && php vendor/bin/phpunit --testsuite Unit"` | 25 pruebas |
| ms-gestion | `npm test` y `npm run test:e2e` | 13 + 4 |
| ms-ia | `pip install -r requirements-dev.txt && python -m pytest` | 11 |
| web-shell | `npx ng test --watch=false` | 3 |
| mfe-gestion | `npx ng test --watch=false` | 2 |
| mfe-pos | `npm test` | 3 |
| app-movil | `flutter analyze && flutter test` | sin problemas · 2 |

---

## Al terminar

- Dejar el stock como al inicio: `docker compose exec ms-inventario php artisan inventario:seed --forzar`
- Apagar: `docker compose down` (los datos de Supabase, Atlas y n8n se conservan; DynamoDB local se recrea al levantar).

## Lo que todavía no existe (semana 3 de Dev 2 y Dev 3)

| Falta | Dueño | Qué pasa hoy |
|---|---|---|
| Cola offline del POS que llama a `/ventas/sync` | Dev 2 | El endpoint funciona; se prueba con Postman (parte 5) |
| `exportarReporte` en ms-gestion y la pestaña Reportes | Dev 2 | El reporte diario llega sin PDF (parte 9) |
| Agentes de reabastecimiento y de reportes, servidor MCP | Dev 3 | n8n envía el aviso y el reporte igual, sin orden automática ni resumen (partes 8 y 9) |
| TFLite en la app y TF.js en el POS; login del celular | Dev 3 | El reconocimiento se prueba por API (parte 11) |
| Modelo entrenado con fotos reales | Dev 3 | Entrenado con imágenes sintéticas |
