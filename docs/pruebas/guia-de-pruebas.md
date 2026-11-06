# Guía de pruebas – Plataforma Licorería

Fase 4 de ICONIX (Implementación): pruebas unitarias y funcionales basadas en los requisitos R01–R18 y en los 7 casos de uso.
Esta guía es a la vez el **plan de pruebas** y la **hoja de ejecución**: sigue las partes en orden y llena la columna *Resultado* de cada caso.

| Documento | Para qué |
|---|---|
| `guia-de-pruebas.md` (este) | Qué probar, cómo, qué debe pasar y dónde anotar el resultado |
| [`registro-de-defectos.md`](registro-de-defectos.md) | Cada falla encontrada. Ya trae los defectos detectados al revisar el código |
| [`informe-de-pruebas.md`](informe-de-pruebas.md) | Plantilla del informe final, para el documento APA y la defensa |
| `evidencias/` | Capturas y salidas de consola de cada caso |

## 1. Alcance y tipos de prueba

| Parte | Tipo | Qué demuestra | Herramienta |
|---|---|---|---|
| A | Unitarias | Las reglas de cada componente funcionan aisladas | JUnit, PHPUnit, Vitest, pytest, flutter test |
| B | Humo | El sistema levantó y responde | `infra/verificar.sh` |
| C | Funcionales (aceptación) | Cada flujo básico y alternativo de cada CU | Navegador, Postman, DBeaver, Compass, Gmail, celular |
| D | Seguridad | Autenticación, roles y secretos | Postman, terminal |
| E | Resiliencia y concurrencia | Saga, compensación, idempotencia, servicios caídos | Terminal, Postman |
| F | Requisitos | R01–R18 cumplidos, por demostración o inspección | Matriz de trazabilidad |
| G | Documentación | Contratos y artefactos ICONIX (R18) | Inspección |
| H | Instalación | Levanta en una máquina limpia solo con el README | Otra PC |

**Fuera de alcance:** el análisis de video (`POST /video/analizar`): el equipo decidió probar solo imágenes, aunque el plan y el endpoint lo mencionan. Tampoco carga masiva y estrés. El proyecto no define umbrales de rendimiento; solo se anotan tiempos de referencia (caso E-08).

**Criterio de salida:** todos los casos ejecutados, ningún defecto *crítico* o *alto* abierto, y los que queden abiertos documentados en el informe.

### Cómo documentar cada caso

1. Ejecuta los pasos y compara con **Esperado**.
2. Pon en *Resultado*: `OK`, `FALLA`, `BLOQUEADO` (no se pudo ejecutar porque depende de otra cosa) u `OBS` (funciona, con una observación).
3. Guarda la evidencia en `docs/pruebas/evidencias/` con el ID del caso: `C-CU02-01.png`, `A-ms-ventas.txt`. Debe verse el dato que prueba el resultado (respuesta, fila de la base, correo).
4. Si falla, agrégalo al registro de defectos con los pasos para reproducirlo y escribe su ID en *Resultado* (`FALLA D-12`). No corrijas sin anotarlo.
5. Tras una corrección, repite ese caso y los relacionados (regresión) y anota el nuevo resultado en el registro.

**Severidad:** *Crítico* = pérdida de datos o el sistema no funciona · *Alto* = un CU o requisito no se cumple · *Medio* = falla con alternativa · *Bajo* = detalle visual o de texto.

## 2. Entorno y datos

| Elemento | Valor |
|---|---|
| Bases | Supabase (ventas y Keycloak) y MongoDB Atlas (gestión), en la nube; DynamoDB local. **Se necesita internet** |
| Herramientas | Docker Desktop, Git Bash, Chrome o Edge, Postman, DBeaver, MongoDB Compass, Gmail, celular o emulador Android |
| DBeaver | `DB_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` de `ms-ventas/.env` (SSL: *require*) |
| Compass | `MONGO_URL` de `ms-gestion/.env`, base `gestion`. Tu IP debe estar en *Network Access* de Atlas |
| Correos | Bandeja de `GERENTE_EMAIL` de `n8n/.env` (revisa *Spam* la primera vez) |

| Usuario | Contraseña | Rol | En la web |
|---|---|---|---|
| `cajero01` | `cajero01` | CAJERO | Punto de venta |
| `gerente01` | `gerente01` | GERENTE | Gestión: proveedores y reportes |
| `almacen01` | `almacen01` | ALMACEN | Sin módulos (usa la app); por API ve y repone stock |
| `admin01` | `admin01` | ADMIN | Punto de venta y Gestión |

| Código | Producto | Cantidad inicial | Mínimo | Precio |
|---|---|---|---|---|
| `CER-001` | Cerveza Paceña 620 ml | 48 | 12 | Bs 12 |
| `VIN-001` | Vino Kohlberg Tinto 750 ml | 20 | 6 | Bs 45 |
| `SIN-003` | Singani Los Parrales 750 ml | 22 | 6 | Bs 60 |
| `RON-002` | Ron Abuelo Añejo 750 ml | 9 | 3 | Bs 130 |
| `WHI-003` | Whisky Chivas Regal 12 Años 750 ml | 5 | 2 | Bs 350 |

**Tokens en Postman** (*Authorization* → *OAuth 2.0* → *Get New Access Token*). Duran 5 minutos: si responde 401, pide otro.

| Token | Configuración |
|---|---|
| Usuario real (`T-CAJERO`, `T-GERENTE`, `T-ADMIN`) | *Authorization Code (With PKCE)* · Auth URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/auth?prompt=login` · Access Token URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/token` · Client ID `web-shell` · Callback `http://localhost/callback` · Challenge `SHA-256` |
| Cuenta de servicio (`T-SERVICIO`, rol GERENTE) | *Client Credentials* · misma Token URL · Client ID `n8n` · Secret = `N8N_CLIENT_SECRET` de `n8n/.env` |

**UUID nuevos:** Supabase conserva los datos entre corridas, así que cada prueba de idempotencia o sincronización necesita UUID nuevos: `python -c "import uuid; print(uuid.uuid4())"`.

**Antes de empezar:** agrega la IP de tu PC en Atlas → *Network Access* (hoy Atlas la rechaza y ms-gestion no conecta; O-16). Luego, desde la raíz del proyecto en Git Bash:

```sh
docker compose up -d --build --remove-orphans   # quita los contenedores mongo y postgres anteriores; la primera vez ollama-init descarga el modelo (~2 GB)
docker compose logs -f ollama-init          # espera a que termine; Ctrl+C para salir
docker compose run --rm mongo-init          # aplica en Atlas colecciones e índices actuales (idempotente)
docker compose exec ms-inventario php artisan inventario:seed --forzar   # stock como en la tabla de arriba
```

Abre http://localhost:5678 y crea el usuario dueño de n8n si lo pide.

> Sigue las partes en orden: los números de stock suponen que reiniciaste el stock antes de la parte C.

---

## Parte A. Pruebas unitarias

Corre cada comando desde la carpeta del proyecto y guarda la salida: `<comando> 2>&1 | tee ../docs/pruebas/evidencias/A-<proyecto>.txt`.

| ID | Proyecto | Comando | Esperado | Resultado |
|---|---|---|---|---|
| A-01 | ms-ventas | `./mvnw test` | 18 pruebas, 0 fallas | |
| A-02 | ms-inventario | `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app composer:2 sh -c "composer install -q && php vendor/bin/phpunit --testsuite Unit"` | 25 pruebas, 0 fallas | |
| A-03 | ms-gestion | `npm ci`, luego `npm test` | 20 pruebas, 0 fallas | |
| A-04 | ms-gestion (e2e) | `npm run test:e2e` | 4 pruebas, 0 fallas | |
| A-05 | ms-ia | `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app python:3.12-slim sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q"` | 38 pruebas, 0 fallas | |
| A-06 | web-shell | `npx ng test --watch=false` | 3 pruebas, 0 fallas | |
| A-07 | mfe-gestion | `npx ng test --watch=false` | 2 pruebas, 0 fallas | |
| A-08 | mfe-pos | `npm test` | 6 pruebas, 0 fallas | |
| A-09 | app-movil | `flutter analyze` y `flutter test` | Sin problemas; 7 pruebas | |

**Cobertura** (anótala en el informe):

| ID | Proyecto | Comando | Referencia medida | Resultado |
|---|---|---|---|---|
| A-10 | ms-ventas | `./mvnw org.jacoco:jacoco-maven-plugin:0.8.13:prepare-agent test org.jacoco:jacoco-maven-plugin:0.8.13:report` → abre `target/site/jacoco/index.html` | 36.8 % de líneas | |
| A-11 | ms-gestion | `npx vitest run --coverage` | 86.5 % de líneas, solo de los archivos que cargan las pruebas | |

> Los adaptadores, controladores y la seguridad no tienen prueba unitaria: se cubren en las partes C y D. Decláralo así en el informe (observación O-04 del registro).

---

## Parte B. Humo

| ID | Paso | Esperado | Resultado |
|---|---|---|---|
| B-01 | `sh infra/verificar.sh` | Termina en `0 fallas`. Si Ollama aún descarga el modelo, ese punto lo avisa y no cuenta como falla | |
| B-02 | `docker compose ps` | Todos `running`, salvo `dynamodb-init` y `ollama-init` (terminan con código 0) | |
| B-03 | `curl -s http://localhost/api/ia/health` | `"motor":"langgraph"`, y en `ollama` aparece `qwen2.5:3b` | |
| B-04 | n8n → *Overview* | **CU06** y **CU07** publicados | |

---

## Parte C. Pruebas funcionales por caso de uso

Usa una ventana de incógnito por usuario para que no se mezclen las sesiones.

### CU01 – Iniciar sesión (R16)

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU01-01 | Básico | Abre http://localhost/ | Redirige al login de Keycloak, blanco y lila, en español | |
| C-CU01-02 | Básico | Entra como `cajero01` | "Hola, cajero01"; el menú muestra solo **Punto de venta**; nombre, rol y **Salir** arriba a la derecha | |
| C-CU01-03 | Alterno | Contraseña incorrecta | Mensaje de error en español; no entra | |
| C-CU01-04 | Alterno | Como cajero, abre http://localhost/gestion | Pantalla **Acceso denegado**. El 403 de la API se prueba en D-03 | |
| C-CU01-05 | Básico | **Salir** y vuelve a http://localhost/ | Pide usuario otra vez | |
| C-CU01-06 | Por rol | `gerente01`: abre también `/pos` | Solo **Gestión** en el menú; `/pos` → Acceso denegado | |
| C-CU01-07 | Por rol | `almacen01` | "Tu rol no tiene módulos en la web…" | |
| C-CU01-08 | Por rol | `admin01` | Ve y abre Punto de venta y Gestión | |
| C-CU01-09 | SSO | Con sesión de `admin01`, abre http://localhost/mfe-pos/ en otra pestaña | Entra sin pedir contraseña | |

### CU02 – Registrar venta (R01, R03, R08, R09)

Para ver los datos en DBeaver:

```sql
SELECT numero, estado, origen, total, operation_id, fecha FROM venta ORDER BY numero DESC LIMIT 5;
SELECT v.numero, p.metodo, p.estado FROM pago p JOIN venta v ON v.id = p.venta_id ORDER BY v.numero DESC LIMIT 5;
SELECT v.numero, s.paso_actual, s.estado, s.error FROM saga_instancia s JOIN venta v ON v.id = s.venta_id ORDER BY s.creado_en DESC LIMIT 5;
```

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU02-01 | Básico | Como `cajero01`, entra a **Punto de venta** | "20 productos disponibles", con etiqueta de color por tipo | |
| C-CU02-02 | Básico | Busca "paceña"; prueba los filtros por tipo; vuelve a **Todos** | La lista se filtra | |
| C-CU02-03 | Básico | Toca 2 veces **Cerveza Paceña 620 ml** y 1 vez **Vino Kohlberg**; prueba + y − y deja 2 + 1 | Contadores 2 y 1; "3 unidades"; total **Bs 69.00** | |
| C-CU02-04 | Básico | Elige **Tarjeta** y **Cobrar Bs 69.00** | Aviso verde **Venta Nº N completada · Total cobrado Bs 69.00**; carrito vacío | |
| C-CU02-05 | Básico | DBeaver | Venta `COMPLETADA`, `ONLINE`; pago `APROBADO`, `TARJETA`; saga `COMPLETADA` en `CONFIRMAR` | |
| C-CU02-06 | Básico | Compass → `ingresos` | Documento con el `operationId`, monto 69, estado `ACTIVO` | |
| C-CU02-07 | Básico | `GET http://localhost/api/inventario/stock` con T-SERVICIO | CER-001 = 46; VIN-001 = 19 | |
| C-CU02-08 | Alterno: sin stock | Toca 6 veces **Whisky Chivas Regal** (hay 5) y **Cobrar** | Aviso rojo "Sin stock suficiente: … (pediste 6, hay 5)" | |
| C-CU02-09 | Alterno: sin stock | DBeaver y `GET /stock` | Venta `CANCELADA`, pago `REEMBOLSADO`, saga `COMPENSADA`; Chivas sigue en 5 con `reservado` 0 | |

### CU03 – Vender offline y sincronizar (R07)

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU03-01 | Básico | En el POS, DevTools (F12) → *Network* → **Offline** | Etiqueta **Sin conexión**; botón **Cobrar Offline** | |
| C-CU03-02 | Básico | Vende 1 **Cerveza Paceña** | Aviso "Venta guardada en modo Offline (IndexedDB)"; el contador de **Cola Offline** sube a 1 | |
| C-CU03-03 | Básico | Abre **Cola Offline**; DevTools → *Application* → *IndexedDB* | La venta aparece **Pendiente** en los dos lugares | |
| C-CU03-04 | Básico | Quita **Offline** y espera hasta 30 s | Etiqueta **En línea**; aviso "Ventas offline sincronizadas · 1 registradas…"; la cola queda en 0 | |
| C-CU03-05 | Básico | DBeaver | **Una sola** venta nueva, `origen` `OFFLINE`, con la hora en que se hizo | |
| C-CU03-06 | Alterno: servidor caído con red | `docker compose stop ms-ventas`; espera 30 s; vende 1 **Vino**; `docker compose start ms-ventas` | Pasa a **Sin conexión**; la venta queda en cola; al volver el servicio se sincroniza sola en ≤ 1 min | |
| C-CU03-07 | Alterno: sin stock | Offline, vende 6 **Chivas**; vuelve a línea | Queda en la cola como **Error (SIN_STOCK)**; **Descartar** la elimina | |
| C-CU03-08 | Alterno: recarga sin red | Abre http://localhost/mfe-pos/ con sesión; ponlo Offline y recarga | Debe cargar la PWA y el catálogo guardado. **Revisar con atención** (O-07) | |
| C-CU03-09 | API: lote | Con T-CAJERO, `POST http://localhost/api/ventas/ventas/sync` con el cuerpo de abajo | **200** con `[OK, DUPLICADO, ERROR SIN_STOCK, ERROR DATOS_INVALIDOS]` en ese orden | |
| C-CU03-10 | API: reenvío | Envía el mismo lote otra vez | La primera sale `DUPLICADO` con el mismo `ventaId` | |
| C-CU03-11 | API: fechas | `GET /api/ventas/ventas/{ventaId}` | `origen: OFFLINE`, `fecha` = `fechaLocal`. Con una `fechaLocal` futura usa la hora del servidor | |
| C-CU03-12 | API: límites | Lote vacío `[]`; lote de 51 ventas | **400** `DATOS_INVALIDOS` | |

```json
[
  { "operationId": "<UUID-A>", "items": [ { "productoCodigo": "VIN-001", "cantidad": 1 } ], "pago": { "metodo": "QR" }, "fechaLocal": "2026-11-06T09:15:00-04:00" },
  { "operationId": "<UUID-A>", "items": [ { "productoCodigo": "VIN-001", "cantidad": 1 } ], "pago": { "metodo": "QR" }, "fechaLocal": "2026-11-06T09:15:00-04:00" },
  { "operationId": "<UUID-B>", "items": [ { "productoCodigo": "WHI-003", "cantidad": 9999 } ], "pago": { "metodo": "EFECTIVO" }, "fechaLocal": "2026-11-06T09:20:00-04:00" },
  { "operationId": "no-es-uuid", "items": [ { "productoCodigo": "CER-001", "cantidad": 1 } ], "pago": { "metodo": "EFECTIVO" } }
]
```

### CU04 – Reconocer producto por cámara (R05, R06, R10)

> **Modelo vigente (O-05):** MobileNetV2 real `20261106-204346`, entrenado con solo 54 fotos. Carga y corre en el servidor, el navegador y la app, pero su precisión es baja y sus confianzas quedan bajo el 80 %, así que estos casos pueden fallar hasta reentrenar con fotos propias. Anota el resultado real de cada producto; un resultado bajo aquí es una falla de datos, no de código.

Genera una imagen de prueba:

```sh
docker compose exec ms-ia python -c "from PIL import Image,ImageDraw;i=Image.new('RGB',(224,224),(230,225,215));ImageDraw.Draw(i).rectangle([40,30,190,200],fill=(200,160,40));i.save('/tmp/pacena.jpg')"
docker compose cp ms-ia:/tmp/pacena.jpg ./pacena.jpg
```

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU04-01 | Básico (servidor) | Con T-CAJERO, `POST http://localhost/api/ia/imagen/clasificar`, form-data `imagen` = `pacena.jpg` | `CER-001`, confianza ≥ 0.8 | |
| C-CU04-02 | Básico (web) | POS → **Escanear cámara (IA)** → sube `pacena.jpg` | Reconoce Paceña ≥ 80 % y la agrega al carrito | |
| C-CU04-03, C-CU04-05 | Básico (web, sin red) | Abre el escáner una vez con red; DevTools → Offline; repite | Sigue reconociendo, porque el modelo corre en el navegador (R06) | |
| C-CU04-04 | Plan | Foto real de cada uno de los 5 productos, en web y app | Producto correcto ≥ 80 %. Anota el resultado de cada uno | |
| C-CU04-05 | TF.js real | Abre el escáner con red; DevTools → *Application* → *IndexedDB* → `tensorflowjs` | Aparece `licoreria-modelo-<versión>`: el modelo se descargó de ms-ia y quedó en el navegador | |
| C-CU04-06 | Alterno | Mismo POST de imagen con un archivo vacío; con T-ADMIN | **400**; **403** | |
| C-CU04-07 | Modelos | `GET http://localhost/api/ia/modelos/latest` | Versión, 5 etiquetas y URLs de los archivos | |

**App móvil** (R05, R07). Con el celular por USB o un emulador, `adb reverse` hace que `localhost` del teléfono llegue a tu PC, así que el login de Keycloak funciona sin cambiar `KC_HOSTNAME`:

```sh
adb reverse tcp:80 tcp:80
cd app-movil && flutter run --dart-define=API_URL=http://localhost
```

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU04-08 | Básico | Instala y abre la app | Muestra **Licorería** e **Iniciar sesión** | |
| C-CU04-09 | Básico | Inicia sesión como `cajero01` | Abre Keycloak y vuelve a la pantalla de inicio. Si no vuelve, anota el defecto (O-06) | |
| C-CU04-10 | Básico | Con red, abre **Catálogo y stock sin conexión** y pulsa sincronizar; luego modo avión, cierra y vuelve a abrir la app | Lista productos y stock desde SQLite, con los datos sincronizados; búsqueda y filtros funcionan. Evidencia: copia la base (comando de abajo) y ábrela en DBeaver: tablas `producto`, `stock` y `sync_info` | |
| C-CU04-11 | Básico | Modo avión → **Escanear producto** → **Escanear** apuntando a cada producto | Reconoce con TFLite, sin red, ≥ 80 %. Sin modelo válido debe avisar, nunca inventar un resultado | |

Copiar la base SQLite del teléfono para la evidencia de C-CU04-10 (app en modo debug):

```sh
adb exec-out run-as com.licoreria.app_movil cat databases/licoreria_offline.db > docs/pruebas/evidencias/C-CU04-10.db
```

### CU05 – Gestionar proveedores (R03, R17)

Como `gerente01` → **Gestión**.

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU05-01 | Básico | Abre **Proveedores** | Tabla con proveedor, NIT, contacto, productos y estado | |
| C-CU05-02 | Básico | **+ Nuevo proveedor**: NIT nuevo de 10 dígitos, razón social, contacto y productos `ron-002, vin-002, ron-002` | Aparece **Activo** con `RON-002` y `VIN-002` (mayúsculas, sin repetir) | |
| C-CU05-03 | Básico | Compass → `proveedores` | Documento creado | |
| C-CU05-04 | Alterno | Otro con el **mismo NIT** | "Ya existe un proveedor con ese NIT." | |
| C-CU05-05 | Alterno | NIT `ABC`; email `juan@`; razón social vacía | Mensajes de validación; **Guardar** deshabilitado | |
| C-CU05-06 | Básico | **Editar**: cambia la razón social | Cambio visible en la lista | |
| C-CU05-07 | Básico | Crea otro proveedor y apaga **Proveedor activo** | Figura **Inactivo** | |
| C-CU05-08 | Básico | Filtros **Activos / Inactivos** | Filtra y actualiza el conteo | |

Deja **activo** el proveedor de C-CU05-02: lo necesita CU06.

### CU06 – Reabastecer stock (R04, R11, R14)

Reinicia el stock si ya vendiste Ron: `docker compose exec ms-inventario php artisan inventario:seed --forzar`.

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU06-01 | Previo | `GET /api/inventario/stock` con T-SERVICIO | `RON-002`: 9, mínimo 3, `bajoMinimo` y `avisoEnviado` en `false` | |
| C-CU06-02 | Básico | Como `cajero01`, vende **7 Ron Abuelo** (quedan 2) | La venta se completa | |
| C-CU06-03 | Básico | Revisa Gmail (el LLM en CPU puede tardar hasta 4 min) | "Orden de compra … creada por stock bajo de Ron Abuelo…" con sus líneas. El motivo y la cantidad los decide el agente | |
| C-CU06-04 | Básico | Con T-SERVICIO, `POST http://localhost/graphql`: `{ ordenesCompra { numero origen estado total lineas { productoCodigo cantidad } } }` | Orden con `origen: AGENTE` | |
| C-CU06-05 | Básico | n8n → CU06 → *Executions* | Ejecución en verde con el aviso, el agente y el correo | |
| C-CU06-06 | Alterno: sin repetir | Vende 1 Ron más; revisa `GET /stock` y Gmail | `avisoEnviado: true`; **no** llega otro correo | |
| C-CU06-07 | Reposición | Con T-SERVICIO, `POST /api/inventario/stock/RON-002/reposiciones` con `{ "cantidad": 30 }` | **200**: `cantidad: 31`, `bajoMinimo` y `avisoEnviado` en `false` | |
| C-CU06-08 | Reposición | Vende 29 Ron (quedan 2) | Llega un **segundo** correo y otra orden | |
| C-CU06-09 | Alterno: reposición inválida | `cantidad: 0`; producto `XXX-999`; con T-CAJERO | **400**; **404**; **403** | |
| C-CU06-10 | Alterno: sin proveedor | Vende `WHI-003` hasta quedar bajo 2 (vende 4), sin proveedor para ese producto | Correo de stock bajo con el motivo; no se crea orden | |
| C-CU06-11 | Alterno: agente caído | `docker compose stop ms-ia`; baja `VIN-001` de su mínimo; `docker compose start ms-ia` | Correo "no respondió, así que no se creó una orden automática" | |
| C-CU06-12 | Alterno: n8n caído | `docker compose stop n8n`; baja `SIN-003` de su mínimo; `docker compose start n8n`; espera 30 s y vende 1 más | La venta nunca falla; el aviso llega en la segunda venta | |
| C-CU06-13 | MCP (R14) | Corre el bloque de abajo: primero sin token y luego con T-SERVICIO | Sin token **401**. Con token, `initialize` responde el protocolo MCP y `tools/list` da las 4 tools | |
| C-CU06-14 | Agente decide (R04) | Con T-SERVICIO y `RON-002` bajo el mínimo, `POST http://localhost/api/ia/agentes/reabastecimiento` con `{ "productoCodigo": "RON-002", "cantidad": 2, "minimo": 3 }` | `decididoPor: llm`, `herramientasUsadas` incluye la tool que eligió, `ordenCreada: true` y una cantidad razonable | |
| C-CU06-15 | Seguridad del agente | Repite con el producto ya repuesto, sobre su mínimo | `ordenCreada: false`, sin orden nueva, aunque el cuerpo diga `cantidad: 2`: manda el stock real | |
| C-CU06-16 | Plan B | `docker compose stop ollama`; repite C-CU06-14 con el stock bajo; `docker compose start ollama` | `decididoPor: reglas`; la orden se crea igual | |

Bloque de C-CU06-13:

```sh
URL=http://localhost/api/ia/mcp-server/mcp
curl -s -w ' [%{http_code}]\n' -H 'Content-Type: application/json' -H 'Accept: application/json,text/event-stream' $URL -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
TOKEN='<T-SERVICIO>'
curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json,text/event-stream' $URL -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"qa","version":"1"}}}'
curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json,text/event-stream' -H 'MCP-Protocol-Version: 2025-06-18' $URL -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

### CU07 – Generar y exportar reporte (R12, R13, R04)

Como `gerente01` → **Gestión → Reportes**. Ten ventas hechas hoy.

| ID | Flujo | Pasos | Esperado | Resultado |
|---|---|---|---|---|
| C-CU07-01 | Básico | Escribe "Ventas por producto de esta semana en barras" → **Generar reporte** | Tabla, gráfico de barras, KPIs y resumen | |
| C-CU07-13 | Básico: por voz | En Chrome o Edge, pulsa 🎤, permite el micrófono y di "ventas de hoy por producto"; luego **Generar reporte** | El texto aparece en el cuadro y genera el reporte. Firefox no lo soporta: debe avisarlo | |
| C-CU07-14 | LLM interpreta (R12) | Con T-SERVICIO, `POST http://localhost/api/ia/reportes` con cada frase: "dime lo que se está por acabar", "cuánto queda de vodka", "necesito saber cuánta plata entró hoy", "cómo fueron las ventas día a día en el mes" | `interpretadoPor: llm`; las dos primeras usan stock (`Disponible`), la cuarta `Fecha` con líneas. Son frases sin las palabras clave de las reglas | |
| C-CU07-02 | Básico | Compara con `GET /api/ventas/ventas?desde=…&hasta=…` | **Los números coinciden con las ventas reales**, sin datos inventados | |
| C-CU07-03 | Básico | **Descargar PDF** y **Descargar XLSX** | Abren bien y traen los mismos datos | |
| C-CU07-04 | Básico | Prueba las consultas rápidas ("Ventas de hoy por producto", "Stock bajo mínimo"…) | Cada una con datos propios. "Hoy" solo cuenta desde las 00:00 de Bolivia | |
| C-CU07-05 | Alterno: sin datos | "Ventas del día 2020-01-01 por producto" | Reporte vacío con "No se registraron ventas…"; ninguna cifra | |
| C-CU07-06 | Alterno: IA caída | `docker compose stop ms-ia`, genera un reporte, `docker compose start ms-ia` | Mensaje de error claro; **no** se crea un reporte con datos falsos | |
| C-CU07-07 | Alterno: sin LLM | `docker compose stop ollama`, genera un reporte, `docker compose start ollama` | Sale igual con `interpretadoPor: reglas` y resumen armado por reglas | |
| C-CU07-08 | Alterno: rol | Como `admin01`, intenta generar | Error "Se requiere el rol GERENTE"; sí puede ver y descargar los existentes | |
| C-CU07-09 | Historial | Abre el historial | Lista los reportes con su consulta, autor y fecha | |
| C-CU07-10 | Reporte diario | Abre http://localhost:5678/webhook/reporte-diario | Llega a Gmail "Reporte diario de ventas AAAA-MM-DD: Bs …" con tabla por producto y **PDF adjunto** | |
| C-CU07-11 | Reporte diario | Agrega `?dia=2020-01-01` | "No hubo ventas este día" | |
| C-CU07-12 | Programación | n8n → CU07 | Disparador 23:00, zona America/La_Paz. Si puedes, déjalo correr una noche | |

---

## Parte D. Seguridad

| ID | Pasos | Esperado | Resultado |
|---|---|---|---|
| D-01 | `POST /api/ventas/ventas` sin token; con token alterado | **401** `NO_AUTENTICADO` | |
| D-02 | `GET /api/inventario/productos` y `GET /api/ia/yo` sin token; GraphQL `{ yo { usuario } }` sin token | **401** y `UNAUTHENTICATED`. `{ salud }` sí responde sin token | |
| D-03 | `POST /ventas` con T-GERENTE; `GET /ventas?desde&hasta` con T-CAJERO; `GET /stock` con T-CAJERO; GraphQL `{ proveedores { id } }` con T-CAJERO | **403** o `FORBIDDEN` | |
| D-04 | Clave admin: entra a http://localhost/auth/admin | Solo con `KC_BOOTSTRAP_ADMIN_*` | |
| D-05 | `git check-ignore n8n/.env ms-ventas/.env ms-gestion/.env ms-inventario/.env ms-ia/.env infra/.env` | Lista los 6: ninguno se sube a git | |
| D-06 | `git grep -n -i -E "client_secret=|password=|mongodb\+srv://" -- ':!*.example' ':!*.md'` | Sin secretos reales. Anota cualquier resultado | |
| D-07 | Web: PKCE en `web-shell` (*Clients → Advanced*) | `S256` | |
| D-08 | `GET http://localhost/reportes/descargar/<id>?formato=pdf` **sin token** | Hoy descarga sin autenticar: anótalo (O-02) | |
| D-09 | `cd ms-gestion && npm audit --omit=dev` (y en los demás proyectos Node) | Anota el conteo: hoy ms-gestion tiene 6 altas (O-03) | |

---

## Parte E. Resiliencia, idempotencia y concurrencia

| ID | Pasos | Esperado | Resultado |
|---|---|---|---|
| E-01 | **Rollback:** `docker compose stop ms-gestion`; en el POS vende 1 Vino | Aviso "…se revirtió automáticamente…"; venta `CANCELADA`, pago `REEMBOLSADO`, saga `COMPENSANDO`; el stock no bajó | |
| E-02 | **Compensación pendiente:** `docker compose start ms-gestion`; espera hasta 60 s | La misma saga pasa sola a `COMPENSADA` | |
| E-03 | **Idempotencia:** `POST /api/ventas/ventas` con T-CAJERO, `Idempotency-Key` nuevo y `{ "items": [ { "productoCodigo": "CER-001", "cantidad": 1 } ], "pago": { "metodo": "QR" } }`, **3 veces** | 3 respuestas **201 idénticas**; 2.ª y 3.ª con `Idempotent-Replayed: true`; 1 venta; el stock baja 1 vez | |
| E-04 | Repite con `cantidad: 9999` y otra clave, dos veces | El mismo 409 `SIN_STOCK`, sin otra venta | |
| E-05 | `Idempotency-Key: abc`; sin encabezado; producto `XXX-999` con clave nueva | **400**; **400**; **404**. El 404 no se guarda: esa clave se puede reintentar | |
| E-06 | Usa la clave de E-03 en `POST /ventas/sync` | **422** `IDEMPOTENCY_KEY_REUSADA` | |
| E-07 | **Venta offline cancelada:** `docker compose stop ms-gestion`; envía un lote con 1 venta (UUID nuevo) a `/ventas/sync`; `docker compose start ms-gestion`; reenvía el lote | Primero `ERROR SAGA_COMPENSADA`; después `ERROR VENTA_CANCELADA`, **nunca** `DUPLICADO` (regresión de D-01) | |
| E-08 | **Última unidad:** deja `WHI-003` con 1 disponible y corre el bloque de abajo | Una **201** y otra **409**; el stock queda en 0, nunca negativo. Anota el tiempo de una venta normal | |
| E-09 | **Reserva idempotente:** con T-CAJERO, `POST /api/inventario/stock/reservas` dos veces con el mismo `reservaId`; `…/confirmar`; `DELETE …` | 201; 200 sin reservar doble; `CONFIRMADA`; 409 `RESERVA_CONFIRMADA` | |
| E-10 | **Gateway:** `docker compose stop ms-ia`; `GET /api/ia/health`; usa el POS | **502** en esa ruta; el resto sigue funcionando | |

```sh
TOKEN='<token de cajero01>'
for i in 1 2; do
  curl -s -o /dev/null -w "venta $i: %{http_code}\n" -X POST http://localhost/api/ventas/ventas \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -H "Idempotency-Key: $(python -c 'import uuid; print(uuid.uuid4())')" \
    -d '{"items":[{"productoCodigo":"WHI-003","cantidad":1}],"pago":{"metodo":"EFECTIVO"}}' &
done; wait
```

---

## Parte F. Matriz de trazabilidad de requisitos

*Demostrado* = lo prueban los casos indicados. *Inspección* = se comprueba leyendo el código o la configuración.

| Req. | Requisito | Cómo se verifica | Casos | Cumple |
|---|---|---|---|---|
| R01 | Microservicios (mín. 3) | 4 servicios independientes, cada uno con su base | B-02, E-10 | |
| R02 | Micro frontends | Shell Angular con remoto Angular y Web Component React; cada uno en su puerto | C-CU01-02, C-CU02-01, C-CU05-01 | |
| R03 | GraphQL solo en gestión; REST en lo demás | Inspección de contratos y C-CU05 | C-CU05-01, D-02 | |
| R04 | Construido con agentes | Agentes LangGraph con LLM local: eligen tools y deciden; reglas de seguridad validan | B-03, C-CU06-14, C-CU06-15, C-CU07-14 | |
| R05 | IA local en móvil | TensorFlow Lite en el teléfono, en modo avión. Requiere el modelo reentrenado | C-CU04-11 | |
| R06 | IA local en navegador | TensorFlow.js, sin red. Requiere el modelo reentrenado para acertar | C-CU04-03 | |
| R07 | Offline, sincronización, idempotencia | PWA + IndexedDB; app + SQLite; `Idempotency-Key` | C-CU03-01…12, C-CU04-10, E-03 | |
| R08 | Transacciones transversales | Una venta en 3 servicios y 3 bases | C-CU02-05…07 | |
| R09 | Saga con rollback | Compensación automática | C-CU02-09, E-01, E-02 | |
| R10 | ML/DL con TensorFlow, imágenes | MobileNetV2 con `entrenar.py`, pendiente de reentrenar (O-05). El video queda fuera por decisión del equipo | C-CU04-01, C-CU04-04 | |
| R11 | n8n y pipelines | CU06 y CU07 | B-04, C-CU06-05, C-CU07-10 | |
| R12 | Reportes en lenguaje natural | El LLM interpreta el pedido, escrito o por voz, y redacta el resumen | C-CU07-01, C-CU07-13, C-CU07-14 | |
| R13 | Pantalla y exportación | Tabla, gráfico, Excel y PDF. El plan decía ECharts; el gráfico está hecho sin esa librería: anótalo | C-CU07-01, C-CU07-03 | |
| R14 | MCP | Servidor FastMCP con protocolo real; los agentes lo usan como clientes | C-CU06-13 | |
| R15 | Spring Boot, NestJS, PHP, Angular, React, PostgreSQL, MongoDB, DynamoDB | Inspección de cada carpeta y su base | B-01 | |
| R16 | SSO | Keycloak, sesión única | C-CU01-01…09 | |
| R17 | DDD, hexagonal, clean | Inspección: `ms-gestion/src`, `ms-ventas/.../domain|application|infrastructure`, `ms-inventario/src/Entities|UseCases|…` | Parte G | |
| R18 | ICONIX | Artefactos de la parte G | G-01…07 | |

---

## Parte G. Documentación

| ID | Qué revisar | Dónde | Esperado | Resultado |
|---|---|---|---|---|
| G-01 | Modelo de dominio | Enterprise Architect / `docs/ea` | Actualizado con el código | |
| G-02 | Descripción de los **7** CU (básico y alternos) | `docs/ea` | Hoy solo hay CU04, CU06 y CU07 escritos (O-08) | |
| G-03 | Robustez de los 7 CU | `docs/ea`, `docs/plan-implementacion-dev2-semana3.md` | Hay CU03, CU04, CU06, CU07; faltan CU01, CU02, CU05 | |
| G-04 | Secuencia detallada de CU02 y CU03 | Igual | CU03 existe; **falta CU02** (con el fragmento `alt`) | |
| G-05 | Clases, componentes y despliegue | Igual | Falta ms-ventas, ms-inventario, componentes y despliegue | |
| G-06 | Contratos vs. implementación | `*/docs/openapi.yaml`, `ms-gestion/schema.graphql`, Swagger | Cada ruta probada existe en el contrato, con los mismos códigos | |
| G-07 | README general y de cada proyecto | Cada carpeta | Puertos, comandos y bases coinciden con el sistema. El README cita `docs/postman/` y `docs/planes/`, que no existen | |
| G-08 | Documento APA | `docs/apa` | Con diagramas y evidencia de estas pruebas | |

---

## Parte H. Instalación limpia

En **otra PC**, siguiendo **solo el README**.

| ID | Pasos | Esperado | Resultado |
|---|---|---|---|
| H-01 | Clona el repositorio; copia los `.env` reales | Sin pasos que falten en el README | |
| H-02 | `docker compose up -d --build` | Levanta todo; anota el tiempo total | |
| H-03 | `sh infra/verificar.sh` | 0 fallas. En Atlas, la IP de esa PC debe estar permitida | |
| H-04 | Repite C-CU01-02 y C-CU02-04 | Funcionan | |

---

## Al terminar

1. Llena el [informe](informe-de-pruebas.md) con los totales y los defectos abiertos.
2. Actualiza los diagramas en Enterprise Architect (fase 4 de ICONIX).
3. Agrega informe y evidencias al documento APA.
4. Deja el stock como al inicio: `docker compose exec ms-inventario php artisan inventario:seed --forzar`.
