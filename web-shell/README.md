# web-shell

Shell Angular de la Plataforma Licorería: menú, inicio de sesión único con Keycloak (CU01) y carga de los micro frontends.

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | Angular + Native Federation (host) |
| Puerto | 4200 (directo: `http://localhost:4200`; la app completa, con los remotos, en el gateway: `http://localhost/`) |

## Cómo carga los micro frontends

| Ruta | Remoto | Mecanismo |
|---|---|---|
| `/gestion` | mfe-gestion (Angular) | Native Federation: `public/federation.manifest.json` → `/mfe-gestion/remoteEntry.json` |
| `/pos` | mfe-pos (React) | Web Component `<licoreria-pos>` importado de `/mfe-pos/pos-element.js` |

## Correrlo con todo el sistema

```sh
docker compose up -d --build web-shell mfe-gestion mfe-pos nginx   # desde la raíz
```

Abrir http://localhost/

## Correrlo solo (desarrollo)

```sh
npm install
npx ng serve       # http://localhost:4200
```

Con `ng serve` las rutas `/mfe-gestion/...` y `/mfe-pos/...` no existen; para probar la integración usa el compose (o cambia temporalmente el manifest a `http://localhost:4201/remoteEntry.json`).

## Inicio de sesión (CU01)

- `keycloak-angular`: al entrar al Shell se exige login (cliente público `web-shell`, PKCE S256) y el token se renueva solo.
- Interceptor: agrega `Authorization: Bearer` a las peticiones a `/api/…` y `/graphql`.
- Menú y rutas por rol (`auth/rol.guard.ts`): CAJERO → POS; GERENTE o ADMIN → Gestión. Si no tiene el rol ve **Acceso denegado**.
- La sesión se comparte con los remotos:
  - mfe-gestion (Angular) usa el `HttpClient` del Shell → el interceptor agrega el token.
  - mfe-pos (React) llama a `window.licoreriaAuth.token()` (`auth/sesion.ts`).

## Pruebas

```sh
npx ng test --watch=false     # menú según rol
```
