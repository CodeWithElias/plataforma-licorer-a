# web-shell

Shell Angular de la Plataforma Licorería: menú, inicio de sesión único con Keycloak (CU01) y carga de los micro frontends.

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | Angular + Native Federation (host) |
| Puerto | 80 en el contenedor (por Nginx: `/`) |

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

## Estado

Esqueleto: menú y carga de los dos remotos. Pendiente: keycloak-angular con PKCE, interceptor del token y menú según rol.
