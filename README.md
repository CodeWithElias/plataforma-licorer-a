# Plataforma Licorería

Monorepo de la Plataforma Licorería: 4 microservicios, un Shell con 2 micro frontends, una app móvil, Keycloak (SSO), Nginx (gateway) y n8n, todo levantado con Docker Compose.

## Estructura

| Carpeta | Dueño | Tecnología | Servicio en el compose | Contrato | Base de datos |
|---|---|---|---|---|---|
| `infra/` | Dev 1 | Nginx, Keycloak | `nginx:80`, `keycloak` | – | – |
| `ms-ventas/` | Dev 1 | Spring Boot + PostgreSQL (hexagonal, Saga) | `ms-ventas:8080` | `docs/openapi.yaml` | `db/V1__ventas.sql` (Flyway) |
| `ms-inventario/` | Dev 1 | Laravel + DynamoDB (Clean) | `ms-inventario:8000` | `docs/openapi.yaml` | `db/inventario.sh` |
| `n8n/` | Dev 1 | n8n (workflows exportados) | `n8n:5678` | – | – |
| `ms-gestion/` | Dev 2 | NestJS + MongoDB (DDD, GraphQL) | `ms-gestion:3000` | `schema.graphql` | `db/gestion.js` |
| `web-shell/` | Dev 2 | Angular + Native Federation (host) | `web-shell:80` | – | – |
| `mfe-gestion/` | Dev 2 | Angular + Native Federation (remoto) | `mfe-gestion:80` | – | – |
| `mfe-pos/` | Dev 2 | React + Vite, PWA | `mfe-pos:80` | – | IndexedDB (Dexie) |
| `ms-ia/` | Dev 3 | FastAPI, TensorFlow, LangGraph, MCP | `ms-ia:8000` | `docs/openapi.yaml` | – (modelos en archivos) |
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
sh infra/crear-env.sh     # crea cada <proyecto>/.env desde su .env.example; luego cambia las claves de ejemplo
```

### Bases de datos

| Base | Dónde | Configuración |
|---|---|---|
| PostgreSQL de ms-ventas | Supabase (en línea) | `ms-ventas/.env` (`DB_HOST`, `POSTGRES_*`); el esquema lo crea Flyway al arrancar |
| PostgreSQL de Keycloak | Supabase (en línea, otro proyecto) | `infra/.env` (`KC_DB_URL`, `KC_DB_*`); Keycloak crea sus tablas e importa el realm |
| MongoDB de ms-gestion | MongoDB Atlas (en línea) | `ms-gestion/.env` (`MONGO_URL`, `MONGO_DB`); el servicio `mongo-init` aplica `db/gestion.js` en cada arranque |
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

## URLs

| Qué | URL |
|---|---|
| Shell (inicio) | http://localhost/ |
| POS (dentro del Shell / independiente) | http://localhost/pos · http://localhost/mfe-pos/ |
| Gestión (dentro del Shell / independiente) | http://localhost/gestion · http://localhost/mfe-gestion/ |
| Keycloak (consola admin: `KC_BOOTSTRAP_ADMIN_*` de `infra/.env`) | http://localhost/auth/admin |
| API ventas · Swagger | http://localhost/api/ventas/health · http://localhost/api/ventas/swagger-ui.html |
| API inventario | http://localhost/api/inventario/health |
| GraphQL gestión | http://localhost/graphql |
| API IA · Swagger | http://localhost/api/ia/health · http://localhost/api/ia/docs |
| n8n | http://localhost:5678 |
| PostgreSQL ventas (DBeaver) | Supabase: host, usuario y clave de `ms-ventas/.env` (SSL obligatorio) |
| DynamoDB Local (NoSQL Workbench) | http://localhost:8000 — credenciales `local` / `local`, región `us-east-1` |
| MongoDB (Compass) | Atlas: `MONGO_URL` de `ms-gestion/.env` |

Si un servicio está caído, Nginx responde `502` en su ruta, pero el resto sigue funcionando.

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
- **Cambié `gestion.js`**: se aplica solo al levantar el compose, o a mano con `docker compose run --rm mongo-init`.
- **ms-gestion no conecta a Atlas** (`querySrv`, `timed out`): agrega tu IP en Atlas → *Network Access*.
- **`tenant/user not found` en Supabase**: el host del pooler no corresponde al proyecto (cada proyecto tiene la región en su host).
- **401 con un token recién emitido**: revisa en jwt.io que `iss` sea `http://localhost/auth/realms/licoreria`.
- **El puerto 80 u 8000 está ocupado**: detén el programa que lo usa (XAMPP, otro servidor, etc.).
