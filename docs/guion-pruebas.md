# Guion de pruebas – lo construido hasta la semana 2

Recorre todo lo que funciona hoy, en el orden en que conviene probarlo. Cada paso dice **qué hacer** y **qué debe pasar**.
Marca `[x]` al terminar. Tiempo aproximado: 60–75 min.

| Parte | Qué se prueba | Dónde |
|---|---|---|
| 0 | Preparación y verificación automática | Terminal |
| 1 | Keycloak (SSO) | Navegador |
| 2 | CU01 – Inicio de sesión único y menú por rol | Navegador |
| 3 | CU02 – Venta con Saga (normal, sin stock, falla forzada) | Navegador + DBeaver + Compass |
| 4 | Idempotencia | Postman |
| 5 | CU05 – Proveedores | Navegador |
| 6 | APIs de cada microservicio | Postman / curl |
| 7 | CU04 – Reconocimiento de productos (ms-ia) | Postman / Swagger |
| 8 | POS como PWA independiente | Navegador |
| 9 | App móvil | Celular / emulador |
| 10 | Pruebas automáticas de cada proyecto | Terminal |

## Datos que vas a usar

| Usuario | Contraseña | Rol | Qué puede hacer |
|---|---|---|---|
| `cajero01` | `cajero01` | CAJERO | POS: vender |
| `gerente01` | `gerente01` | GERENTE | Gestión: proveedores, ver ventas y stock |
| `almacen01` | `almacen01` | ALMACEN | Ver stock (web sin módulos; usa la app) |
| `admin01` | `admin01` | ADMIN | POS y Gestión |

Productos útiles (stock inicial): `CER-001` Cerveza Paceña 620 ml (48, Bs 12), `VIN-001` Vino Kohlberg (20, Bs 45),
`WHI-003` Whisky Chivas Regal 12 Años (5, Bs 350).

---

## 0. Preparación (terminal, desde la raíz del proyecto)

- [ ] **0.1 Levantar todo**
  ```sh
  docker compose up -d --build
  ```
  Keycloak tarda ~2 min en estar listo (su base está en Supabase).
- [ ] **0.2 Dejar el stock como al inicio** (las pruebas anteriores lo cambian)
  ```sh
  docker compose exec ms-inventario php artisan inventario:seed --forzar
  ```
  ✅ `Catálogo listo: 20 productos y 20 registros de stock nuevos (forzado)`
- [ ] **0.3 Verificación automática**
  ```sh
  sh infra/verificar.sh
  ```
  ✅ Termina en `Resultado: 58 correctas, 0 fallas` (contenedores, Supabase, Atlas, DynamoDB, Keycloak, APIs, frontends, puertos).

---

## 1. Keycloak

- [ ] **1.1 Consola de administración:** http://localhost/auth/admin con `KC_BOOTSTRAP_ADMIN_*` de `infra/.env`.
  Cambia al realm **licoreria** (arriba a la izquierda).
  ✅ *Realm roles*: ADMIN, GERENTE, CAJERO, ALMACEN · *Users*: los 4 usuarios ·
  *Clients*: web-shell, app-movil, n8n, ms-gestion-admin, ms-ventas, licoreria-api.
- [ ] **1.2 PKCE:** *Clients → web-shell → Advanced* → ✅ *PKCE Method* = S256.
- [ ] **1.3 Consola de cuenta:** http://localhost/auth/realms/licoreria/account → entra como `cajero01`.
  ✅ Muestra *Personal info* (sin "Something went wrong").

---

## 2. CU01 – Inicio de sesión único y menú por rol

Usa una ventana de incógnito para cada usuario (así no se mezclan sesiones).

- [ ] **2.1** Abre http://localhost/ → ✅ redirige a la pantalla de login de Keycloak.
- [ ] **2.2** Entra como `cajero01` → ✅ "Hola, cajero01"; el menú muestra **POS** y **no** Gestión; arriba a la derecha el usuario y **Salir**.
- [ ] **2.3** Escribe en la barra http://localhost/gestion → ✅ **Acceso denegado** (prueba de CU01 del plan).
- [ ] **2.4** Pulsa **Salir** → ✅ vuelve al login de Keycloak.
- [ ] **2.5** Entra como `gerente01` → ✅ menú con **Gestión** y sin POS; http://localhost/pos → **Acceso denegado**.
- [ ] **2.6** Entra como `almacen01` → ✅ "Tu rol no tiene módulos en la web…".
- [ ] **2.7** Entra como `admin01` → ✅ ve POS y Gestión.

---

## 3. CU02 – Venta con Saga

Para ver los datos por dentro abre también:

- **DBeaver** → PostgreSQL de Supabase con `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` de `ms-ventas/.env` (SSL: *require*).
- **MongoDB Compass** → `MONGO_URL` de `ms-gestion/.env`, base `gestion`.
- **NoSQL Workbench** (opcional) → DynamoDB local en `localhost:8000`, tablas `Stock` y `Reservas`.

Consultas de DBeaver que se usan en esta parte:
```sql
SELECT numero, estado, total, operation_id, fecha FROM venta ORDER BY numero DESC LIMIT 5;
SELECT p.estado AS pago, v.numero FROM pago p JOIN venta v ON v.id = p.venta_id ORDER BY v.numero DESC LIMIT 5;
SELECT v.numero, s.paso_actual, s.estado, s.error FROM saga_instancia s JOIN venta v ON v.id = s.venta_id ORDER BY s.creado_en DESC LIMIT 5;
```

### 3.1 Venta normal
- [ ] Como `cajero01` entra a **POS** → ✅ aparecen los 20 productos; prueba la búsqueda ("paceña") y el filtro por tipo.
- [ ] Toca **Cerveza Paceña 620 ml** dos veces y **Vino Kohlberg** una vez → ✅ carrito con 2 + 1, total **Bs 69.00**.
- [ ] Prueba **+ / −** en el carrito y vuelve a dejar 2 + 1.
- [ ] Elige un método de pago y pulsa **Cobrar Bs 69.00** →
  ✅ mensaje verde **"Venta Nº N completada · Bs 69.00"** y el carrito se vacía.
- [ ] **DBeaver:** la venta N está `COMPLETADA`, el pago `APROBADO`, la saga `COMPLETADA` en el paso `CONFIRMAR`.
- [ ] **Compass:** en `ingresos` hay un documento con el `operationId` de la venta, `monto` 69 y `estado` `ACTIVO`.
- [ ] **Stock:** CER-001 bajó de 48 a 46 y VIN-001 de 20 a 19 (NoSQL Workbench, o `GET /stock` en la parte 6).

### 3.2 Sin stock
- [ ] Toca **Whisky Chivas Regal 12 Años** 6 veces (hay 5) y **Cobrar** →
  ✅ mensaje rojo **"Sin stock suficiente: Whisky Chivas Regal 12 Años 750 ml (pediste 6, hay 5)"**.
- [ ] **DBeaver:** la venta queda `CANCELADA`, pago `REEMBOLSADO`, saga `COMPENSADA` en el paso `RESERVAR_STOCK`.
- [ ] El stock del Chivas sigue en 5 (no se reservó nada).

### 3.3 Falla forzada (rollback automático)
- [ ] En la terminal: `docker compose stop ms-gestion`
- [ ] En el POS vende 1 **Vino Kohlberg** →
  ✅ mensaje **"No se pudo completar la venta y se revirtió automáticamente (stock liberado y pago reembolsado)…"**.
- [ ] **DBeaver:** venta `CANCELADA`, pago `REEMBOLSADO`, saga **`COMPENSANDO`** en el paso `REGISTRAR_INGRESO`
  (el error dice que falta anular el ingreso: ms-gestion está apagado).
- [ ] **Stock:** VIN-001 no bajó (la reserva se liberó al instante). En NoSQL Workbench, la reserva con ese `operation_id` está `LIBERADA`.
- [ ] En la terminal: `docker compose start ms-gestion` y espera hasta 60 s.
- [ ] **DBeaver:** la misma saga pasa sola a ✅ **`COMPENSADA`** (la tarea de reintentos usó el cliente `ms-ventas` de Keycloak).

---

## 4. Idempotencia (Postman)

**Token de cajero en Postman:** pestaña *Authorization* → *OAuth 2.0* → *Grant type* **Authorization Code (With PKCE)**:

| Campo | Valor |
|---|---|
| Auth URL | `http://localhost/auth/realms/licoreria/protocol/openid-connect/auth?prompt=login` |
| Access Token URL | `http://localhost/auth/realms/licoreria/protocol/openid-connect/token` |
| Client ID | `web-shell` |
| Callback URL | `http://localhost/callback` |
| Code Challenge Method | SHA-256 |

*Get New Access Token* → entra como `cajero01` → *Use Token*. (Para un gerente, repite con `gerente01`.)

- [ ] `POST http://localhost/api/ventas/ventas`, encabezado `Idempotency-Key: 11111111-2222-3333-4444-555555555555`, cuerpo:
  ```json
  { "items": [ { "productoCodigo": "CER-001", "cantidad": 1 } ], "pago": { "metodo": "QR" } }
  ```
  ✅ **201** con `estado: COMPLETADA`.
- [ ] Envía **exactamente lo mismo** otra vez → ✅ **200** con el **mismo `id` y `numero`**; el stock de CER-001 bajó **solo una vez**.
- [ ] Sin el encabezado `Idempotency-Key` → ✅ **400** `DATOS_INVALIDOS`.
- [ ] Con un producto inexistente (`XXX-999`) y otra clave → ✅ **404** `PRODUCTO_NO_ENCONTRADO`.
- [ ] Con el token de `gerente01` → ✅ **403** `SIN_PERMISO` (solo el cajero vende).
- [ ] Sin token → ✅ **401** `NO_AUTENTICADO`.

> En la semana 3 la respuesta repetida será la misma guardada en `idempotency_keys` (también para `/ventas/sync`).

---

## 5. CU05 – Proveedores (como `gerente01`)

- [ ] **Gestión → Proveedores** → ✅ la lista carga (por GraphQL desde ms-gestion).
- [ ] **Nuevo proveedor**: NIT `1023456789`, razón social, contacto (nombre, teléfono, email) y productos `cer-001, vin-002` → **Guardar** →
  ✅ aparece en la lista con productos `CER-001, VIN-002` (en mayúsculas y sin repetir).
- [ ] Crea otro con el **mismo NIT** → ✅ "Ya existe un proveedor con ese NIT."
- [ ] NIT `ABC` → ✅ el formulario no deja guardar (entre 5 y 15 dígitos).
- [ ] Email inválido (`juan@`) → ✅ el formulario lo marca.
- [ ] **Editar** el proveedor: cambia la razón social y desmarca **Activo** → ✅ en la lista figura **Inactivo**.
- [ ] Filtro **Activos / Inactivos** → ✅ filtra la lista.
- [ ] **Compass:** colección `proveedores` con el documento creado.

---

## 6. APIs de cada microservicio (Postman o curl)

**Token de gerente sin login** (cuenta de servicio `n8n`, rol GERENTE): en Postman *OAuth 2.0* → *Client Credentials*,
Token URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/token`, Client ID `n8n`,
Client Secret = `N8N_CLIENT_SECRET` de `n8n/.env`.

### ms-inventario (http://localhost/api/inventario · directo http://localhost:8001)
- [ ] `GET /health` (sin token) → ✅ 200, DynamoDB UP con 3 tablas.
- [ ] `GET /productos` → ✅ 20 productos · `?tipo=WHISKY` → 3 · `?tipo=AGUA` → 400.
- [ ] `GET /productos/CER-001` → ✅ 200 · `GET /productos/XXX-999` → 404.
- [ ] `GET /stock` con gerente → ✅ 200 con `disponible = cantidad − reservado` · con cajero → 403.
- [ ] Con token de **cajero**, ciclo de una reserva (`reservaId` = un UUID nuevo):
  `POST /stock/reservas` `{ "reservaId": "<uuid>", "items": [ { "productoCodigo": "CER-001", "cantidad": 2 } ] }` → ✅ 201 `ACTIVA` ·
  repetirla → 200 (no reserva dos veces) · `POST /stock/reservas/<uuid>/confirmar` → `CONFIRMADA` ·
  `DELETE /stock/reservas/<uuid>` → 409 `RESERVA_CONFIRMADA`.
- [ ] Reserva de 1000 unidades → ✅ 409 `SIN_STOCK` con `faltantes`.

### ms-ventas (http://localhost/api/ventas · directo http://localhost:8080)
- [ ] `GET /health` → ✅ db UP (Supabase).
- [ ] Swagger: http://localhost/api/ventas/swagger-ui.html → ✅ "ms-ventas 1.0.0" con botón **Authorize**.
- [ ] `GET /ventas/{id}` (id de la parte 3) con cajero → ✅ detalle con `items`, `pago` y `saga`.
- [ ] `GET /ventas?desde=2026-10-01T00:00:00Z&hasta=2026-12-31T00:00:00Z` con gerente → ✅ solo ventas `COMPLETADA` · con cajero → 403.
- [ ] `GET /flyway` con gerente → ✅ migraciones 1 y 2 en `SUCCESS`.

### ms-gestion (http://localhost/graphql · directo http://localhost:3000)
- [ ] `GET http://localhost:3000/health` → ✅ MongoDB UP con 5 colecciones.
- [ ] `{ salud }` sin token → ✅ `"ok"` · `{ yo { usuario roles } }` sin token → `UNAUTHENTICATED`.
- [ ] `{ yo { usuario roles } }` con token → ✅ usuario y roles.
- [ ] `{ proveedores { razonSocial activo } }` con gerente → ✅ lista · con cajero → error `FORBIDDEN`.

---

## 7. CU04 – Reconocimiento de productos (ms-ia)

> El modelo actual está entrenado con **imágenes sintéticas** (no hay fotos reales todavía): reconoce bien formas y colores
> parecidos a los del dataset de prueba, no fotos reales de botellas. Con las fotos reales se vuelve a entrenar (ver `ms-ia/dataset/README.md`).

- [ ] Swagger: http://localhost/api/ia/docs → ✅ lista `/health`, `/yo`, `/imagen/clasificar`, `/modelos/latest`.
- [ ] `GET /api/ia/yo` con token → ✅ usuario y roles · sin token → 401.
- [ ] `GET /api/ia/modelos/latest` → ✅ versión, 5 etiquetas, URL del `.tflite`; descargar esa URL con token → 200 (~9 MB).
- [ ] Imagen de prueba: genera una con
  ```sh
  docker compose exec ms-ia python -c "from PIL import Image,ImageDraw;i=Image.new('RGB',(224,224),(230,225,215));ImageDraw.Draw(i).rectangle([40,30,190,200],fill=(200,160,40));i.save('/tmp/pacena.jpg')"
  docker compose cp ms-ia:/tmp/pacena.jpg ./pacena.jpg
  ```
- [ ] `POST /api/ia/imagen/clasificar` (form-data, campo `imagen` = `pacena.jpg`) con cajero →
  ✅ `productoCodigo: CER-001`, `nombre: Cerveza Paceña 620 ml`, confianza > 0.9.
- [ ] Con token de `admin01` → ✅ 403 · archivo vacío → 400.

---

## 8. POS como PWA independiente

- [ ] En incógnito abre http://localhost/mfe-pos/ → ✅ pide login de Keycloak por su cuenta; entra como `cajero01` → carga el catálogo.
- [ ] Haz una venta desde aquí → ✅ "Venta Nº … completada".
- [ ] En Chrome/Edge: icono de **instalar app** en la barra de direcciones → ✅ se instala como "POS".
- [ ] Directo por su puerto: http://localhost:4202/mfe-pos/ y Gestión en http://localhost:4201/mfe-gestion/ → ✅ cargan.

---

## 9. App móvil (Flutter)

```sh
cd app-movil
cd android && gradlew --stop && cd ..
flutter clean && flutter pub get
flutter run --dart-define-from-file=.env      # .env: API_URL=http://<IP de tu PC>  (emulador: http://10.0.2.2)
```

- [ ] ✅ La app compila e instala; muestra **Licorería** y el botón **Iniciar sesión** con la dirección del servidor.
- [ ] Al pulsar **Iniciar sesión** se abre la página de Keycloak.

> **Limitación conocida:** Keycloak publica su URL como `http://localhost/auth`, así que desde el teléfono el login no
> puede completarse todavía. La cámara y el reconocimiento quedan detrás del login. Se resuelve configurando
> `KC_HOSTNAME` con la IP de la PC (integración de CU04, semana 3).

---

## 10. Pruebas automáticas de cada proyecto

| Proyecto | Comando (desde su carpeta) | ✅ Esperado |
|---|---|---|
| ms-ventas | `./mvnw test` | 6 pruebas (Saga con puertos falsos) |
| ms-inventario | `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app composer:2 sh -c "composer install -q && php vendor/bin/phpunit --testsuite Unit"` | 19 pruebas |
| ms-gestion | `npm test` y `npm run test:e2e` | 13 + 4 |
| ms-ia | `pip install -r requirements-dev.txt && python -m pytest` | 11 |
| web-shell | `npx ng test --watch=false` | 3 |
| mfe-gestion | `npx ng test --watch=false` | 2 |
| mfe-pos | `npm test` | 3 |
| app-movil | `flutter analyze && flutter test` | sin problemas · 2 |

---

## Al terminar

- Dejar el stock como al inicio: `docker compose exec ms-inventario php artisan inventario:seed --forzar`
- Apagar: `docker compose down` (los datos de Supabase y Atlas se conservan; DynamoDB local se recrea al levantar).

## Lo que todavía no existe (semana 3)

Venta offline y `POST /ventas/sync` (CU03) · TFLite en la app y TF.js en el POS (CU04) · agentes, MCP y workflows de n8n
(CU06, CU07) · reportes por lenguaje natural y exportación (CU07).
