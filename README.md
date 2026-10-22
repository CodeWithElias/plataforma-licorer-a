# Plataforma Licorería

Monorepo de la Plataforma Licorería: 4 microservicios, un Shell con 2 micro frontends, una app móvil, Keycloak (SSO), Nginx (gateway) y n8n, todo levantado con Docker Compose.

## Estructura

| Carpeta | Dueño | Tecnología | Servicio en el compose | Contrato | Base de datos |
|---|---|---|---|---|---|
| `infra/` | Dev 1 | Nginx, Keycloak | `nginx:80`, `keycloak` | – | – |
| `ms-ventas/` | Dev 1 | Spring Boot + PostgreSQL (hexagonal, Saga) | `ms-ventas:8080` | `docs/openapi.yaml` | `db/V1__ventas.sql` (Flyway) |
| `ms-inventario/` | Dev 1 | Laravel + DynamoDB (Clean) | `ms-inventario:8001` | `docs/openapi.yaml` | `db/inventario.sh` |
| `n8n/` | Dev 1 | n8n (workflows exportados) | `n8n:5678` | – | – |
| `ms-gestion/` | Dev 2 | NestJS + MongoDB (DDD, GraphQL) | `ms-gestion:3000` | `schema.graphql` | `db/gestion.js` |
| `web-shell/` | Dev 2 | Angular + Native Federation (host) | `web-shell:4200` | – | – |
| `mfe-gestion/` | Dev 2 | Angular + Native Federation (remoto) | `mfe-gestion:4201` | – | – |
| `mfe-pos/` | Dev 2 | React + Vite, PWA | `mfe-pos:4202` | – | IndexedDB (Dexie) |
| `ms-ia/` | Dev 3 | FastAPI, TensorFlow, LangGraph, MCP | `ms-ia:8002` | `docs/openapi.yaml` | – (modelos en archivos) |
| `app-movil/` | Dev 3 | Flutter | No va en el compose: corre en el celular | – | `lib/db/esquema.sql` (SQLite) |
| `docs/` | Todos | Enterprise Architect, documento APA, planes | – | – | – |

## Reglas de cada proyecto

1. Un `Dockerfile` en su carpeta que construye y arranca el servicio en el puerto de la tabla.
2. Un `README.md` con cómo correrlo solo y un `.env.example` con sus variables **y valores de ejemplo** (nunca claves reales). Los valores reales van en `.env`, que no se sube a git.
3. Su contrato en su propia carpeta (`docs/openapi.yaml` o `schema.graphql`).
4. Su script de base de datos en `db/`: la base es del servicio, no de la infraestructura.
5. Ramas: `main` (lo que funciona), `develop` (integración) y `feature/<caso-de-uso>` (p. ej. `feature/cu02-saga`).
6. Cada quien trabaja dentro de su carpeta; los cambios a `docker-compose.yml` o `infra/` se avisan a Dev 1.

## Requisitos

- Docker Desktop (con WSL 2 en Windows) — `docker compose version`
- Git
- Para programar cada servicio fuera de Docker: ver el README de su carpeta.

## Variables de entorno

Cada proyecto tiene **un solo** `.env` con toda su configuración, y lo usa tanto fuera como dentro de Docker. No hay `.env` en la raíz.

- **Fuera de Docker** (desde el IDE), el servicio lee su `.env` directamente.
- **En Docker**, `docker-compose.yml` le pasa ese mismo archivo con `env_file`. Lo único que el compose cambia son las direcciones de red (`localhost` → `postgres-ventas`, `keycloak:8080`, …); no contiene ninguna clave.
- `.env.example`: mismas variables con valores de ejemplo, se sube a git. El `.env` real no.

| `.env` | Lo usan en Docker | Contiene |
|---|---|---|
| `ms-ventas/.env` | ms-ventas, postgres-ventas | Base de ventas (`POSTGRES_*`), Keycloak, URLs de la Saga |
| `ms-inventario/.env` | ms-inventario, dynamodb-init | `APP_KEY`, credenciales de DynamoDB, Keycloak, webhook de n8n |
| `ms-gestion/.env` | ms-gestion, keycloak | Mongo, Keycloak, secreto del cliente `ms-gestion-admin` |
| `ms-ia/.env` | ms-ia | Ollama, Keycloak, URLs de las tools MCP |
| `n8n/.env` | n8n, keycloak | Secreto del cliente `n8n` |
| `infra/.env` | keycloak, keycloak-db | Base de Keycloak y usuario administrador |
| `mfe-pos/.env` | (al compilar mfe-pos) | Rutas `VITE_*` de las APIs |
| `app-movil/.env` | (no va en Docker) | `API_URL` para `flutter run --dart-define-from-file=.env` |

Keycloak lee los secretos de los clientes del `.env` de quien los usa (`ms-gestion/.env`, `n8n/.env`), así cada secreto se escribe una sola vez. web-shell y mfe-gestion (Angular) no usan variables de entorno.

Primera vez en una máquina nueva:

```sh
sh infra/crear-env.sh            # crea cada <proyecto>/.env desde su .env.example; luego pon los valores reales
docker compose run --rm mongo-init   # solo si el cluster de Atlas está vacío: crea colecciones e índices
```

### Bases de datos

| Base | Dónde | Configuración |
|---|---|---|
| PostgreSQL de ms-ventas | Supabase (en línea) | `ms-ventas/.env` (`DB_HOST`, `POSTGRES_*`); el esquema lo crea Flyway al arrancar |
| PostgreSQL de Keycloak | Supabase (en línea, otro proyecto) | `infra/.env` (`KC_DB_URL`, `KC_DB_*`); Keycloak crea sus tablas e importa el realm |
| MongoDB de ms-gestion | MongoDB Atlas (en línea) | `ms-gestion/.env` (`MONGO_URL`, `MONGO_DB`); colecciones e índices con `docker compose run --rm mongo-init` (una vez por cluster o si cambia `db/gestion.js`) |
| DynamoDB de ms-inventario | Local (contenedor `dynamodb`) | `ms-inventario/.env`; `dynamodb-init` crea las tablas |

Se usa el *session pooler* de Supabase (puerto 5432, con SSL) y pocas conexiones por servicio (`DB_POOL_MAX`, `KC_DB_POOL_MAX_SIZE`), porque el plan gratuito admite pocas. En Atlas, la IP de quien levanta el compose debe estar en *Network Access*.

## Levantar

```sh
docker compose up -d --build          # todo el sistema
sh infra/verificar.sh                 # comprueba que todo responde (termina con "0 fallas")
```

La primera vez tarda varios minutos (descarga imágenes y compila cada servicio). Keycloak tarda ~1 min en estar listo.

Otras formas:

```sh
docker compose up -d --build ms-ventas nginx      # solo lo que nombras (y sus dependencias)
docker compose --profile llm up -d ollama          # LLM local para los agentes de ms-ia (imagen grande)
docker compose down                                # apagar
docker compose down -v                             # apagar y borrar los datos
```

## URLs y puertos

Cada servicio tiene **un puerto propio**, el mismo dentro y fuera de Docker. La aplicación se usa siempre por el **gateway** (`http://localhost`): Nginx actúa de proxy inverso, recibe la petición y llama él mismo a la URL real del servicio (por ejemplo `/api/ventas/ventas` → `http://ms-ventas:8080/ventas`). Los puertos directos sirven para probar o depurar cada servicio por separado.

| Servicio | Puerto | Directo | Por el gateway |
|---|---|---|---|
| Gateway (Nginx) | 80 | – | http://localhost/ |
| web-shell | 4200 | http://localhost:4200 (sin los remotos) | http://localhost/ (app completa) |
| mfe-gestion | 4201 | http://localhost:4201/mfe-gestion/ | http://localhost/gestion (en el Shell) · http://localhost/mfe-gestion/ |
| mfe-pos | 4202 | http://localhost:4202/mfe-pos/ | http://localhost/pos (en el Shell) · http://localhost/mfe-pos/ |
| ms-gestion | 3000 | http://localhost:3000/health · http://localhost:3000/graphql | http://localhost/graphql |
| ms-ventas | 8080 | http://localhost:8080/health · http://localhost:8080/swagger-ui.html | http://localhost/api/ventas/… |
| ms-inventario | 8001 | http://localhost:8001/health | http://localhost/api/inventario/… |
| ms-ia | 8002 | http://localhost:8002/health · http://localhost:8002/docs | http://localhost/api/ia/… |
| Keycloak | – | – | http://localhost/auth/admin (admin: `KC_BOOTSTRAP_ADMIN_*` de `infra/.env`) |
| n8n | 5678 | http://localhost:5678 | – |
| DynamoDB Local | 8000 | NoSQL Workbench: credenciales de `ms-inventario/.env`, región `us-east-1` | – |
| PostgreSQL ventas | – | DBeaver: Supabase con los datos de `ms-ventas/.env` (SSL obligatorio) | – |
| MongoDB gestión | – | Compass: `MONGO_URL` de `ms-gestion/.env` | – |

- Keycloak solo entra por `/auth`: el emisor de los tokens es `http://localhost/auth`, por otro puerto el login no valdría.
- El Shell en `:4200` directo no carga los remotos, porque los busca en `/mfe-gestion/` y `/mfe-pos/` del mismo origen; eso solo existe en el gateway.
- Si un servicio está caído, Nginx responde `502` en su ruta, pero el resto sigue funcionando.
- Para correr un servicio desde el IDE en su puerto, detén antes su contenedor (`docker compose stop ms-ventas`).

## Cómo se integran los micro frontends

- `/gestion` → **mfe-gestion** por Native Federation (`web-shell/public/federation.manifest.json` → `/mfe-gestion/remoteEntry.json`).
- `/pos` → **mfe-pos** como Web Component `<licoreria-pos>` (`/mfe-pos/pos-element.js`). Es el plan B del plan general para el remoto React.

## Keycloak (realm `licoreria`)

El realm se importa solo desde `infra/keycloak/realm-licoreria.json` al arrancar. Si el realm ya existe no se vuelve a importar; para aplicar cambios del JSON: `docker compose down -v` (borra los datos) o edítalo en la consola.

- Emisor (`iss`): `http://localhost/auth/realms/licoreria`
- Claves (JWKS) desde la red de Docker: `http://keycloak:8080/auth/realms/licoreria/protocol/openid-connect/certs`
- Roles de realm (vienen en `realm_access.roles`): `ADMIN`, `GERENTE`, `CAJERO`, `ALMACEN`
- Audiencia de los tokens (`aud`): `licoreria-api`

| Usuario | Contraseña | Rol |
|---|---|---|
| admin01 | admin01 | ADMIN |
| gerente01 | gerente01 | GERENTE |
| cajero01 | cajero01 | CAJERO |
| almacen01 | almacen01 | ALMACEN |

| Cliente | Tipo | Uso |
|---|---|---|
| `web-shell` | Público, Authorization Code + PKCE (S256) | Shell Angular y MFEs. Redirect: `http://localhost/*`, `http://localhost:4200/*` |
| `app-movil` | Público, Authorization Code + PKCE (S256) | Flutter. Redirect: `com.licoreria.app:/oauth2redirect` |
| `n8n` | Confidencial, Client Credentials (secreto `N8N_CLIENT_SECRET` de `n8n/.env`) | Workflows; su cuenta de servicio tiene rol `GERENTE` |
| `ms-gestion-admin` | Confidencial, Client Credentials (secreto `KEYCLOAK_ADMIN_CLIENT_SECRET` de `ms-gestion/.env`) | ms-gestion crea/consulta usuarios en Keycloak |
| `licoreria-api` | Solo audiencia | Los microservicios pueden exigir `aud = licoreria-api` |

Token de prueba en Postman/Bruno: Authorization → OAuth 2.0 → *Authorization Code (With PKCE)*, Auth URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/auth`, Token URL `http://localhost/auth/realms/licoreria/protocol/openid-connect/token`, Client ID `web-shell`, Callback `http://localhost/callback`.

> Los secretos y contraseñas son solo para desarrollo.

## Problemas comunes

- **Los scripts `.sh` fallan con `\r: not found`**: el archivo quedó con CRLF. El `.gitattributes` fuerza LF; si ya lo clonaste antes, vuelve a hacer checkout del archivo.
- **Cambié `gestion.js`** o es un cluster de Atlas nuevo: `docker compose run --rm mongo-init` (es idempotente).
- **ms-gestion no conecta a Atlas** (`querySrv`, `timed out`): agrega tu IP en Atlas → *Network Access*.
- **`tenant/user not found` en Supabase**: el host del pooler no corresponde al proyecto (cada proyecto tiene la región en su host).
- **401 con un token recién emitido**: revisa en jwt.io que `iss` sea `http://localhost/auth/realms/licoreria`.
- **Un puerto está ocupado** (80, 3000, 4200-4202, 5678, 8000-8002, 8080): detén el programa que lo usa (XAMPP, otro servidor, un `ng serve` del mismo proyecto, etc.).
