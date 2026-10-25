# mfe-gestion

Micro frontend de gestión de la Plataforma Licorería: proveedores (CU05) y reportes por lenguaje natural con exportación (CU07).

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | Angular + Native Federation (remoto) |
| Puerto | 4201 (directo: `http://localhost:4201/mfe-gestion/`; por el gateway: `http://localhost/mfe-gestion/`) |
| Consume | ms-gestion (`/graphql`), ms-ia (`/api/ia/reportes`) |

## Cómo se integra con el Shell

`federation.config.mjs` expone `./routes` (`src/app/rutas.ts`): las rutas del módulo con su propio Apollo. El Shell las monta en `/gestion` leyendo `/mfe-gestion/remoteEntry.json`. El build de producción usa `baseHref: /mfe-gestion/`.

Apollo usa el `HttpClient` del Shell, cuyo interceptor agrega el token de Keycloak a `/graphql`. Abierto solo (sin el Shell) no hay sesión: las pantallas piden abrir Gestión desde `http://localhost/gestion`.

## Correrlo con todo el sistema

```sh
docker compose up -d --build mfe-gestion web-shell nginx   # desde la raíz
```

## Correrlo solo (desarrollo)

```sh
npm install
npx ng serve       # http://localhost:4201
```

## Pantallas

| Ruta (dentro de `/gestion`) | Qué hace | Estado |
|---|---|---|
| `proveedores` | Lista con filtro activos/inactivos | ✅ CU05 |
| `proveedores/nuevo`, `proveedores/:id` | Formulario de alta y edición (NIT, razón social, contacto, productos, activo) | ✅ CU05 |
| `reportes` | Reporte por lenguaje natural con ECharts y exportación | Semana 3 (CU07) |

Los errores de ms-gestion se muestran según `errors[].extensions.code` (p. ej. `NIT_DUPLICADO` → "Ya existe un proveedor con ese NIT").

## Pruebas

```sh
npx ng test --watch=false
```
