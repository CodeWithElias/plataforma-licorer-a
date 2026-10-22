# mfe-gestion

Micro frontend de gestión de la Plataforma Licorería: proveedores (CU05) y reportes por lenguaje natural con exportación (CU07).

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | Angular + Native Federation (remoto) |
| Puerto | 4201 (directo: `http://localhost:4201/mfe-gestion/`; por el gateway: `http://localhost/mfe-gestion/`) |
| Consume | ms-gestion (`/graphql`), ms-ia (`/api/ia/reportes`) |

## Cómo se integra con el Shell

`federation.config.mjs` expone `./Component` (`src/app/gestion/gestion.ts`). El Shell lo carga en la ruta `/gestion` leyendo `/mfe-gestion/remoteEntry.json`. El build de producción usa `baseHref: /mfe-gestion/`.

## Correrlo con todo el sistema

```sh
docker compose up -d --build mfe-gestion web-shell nginx   # desde la raíz
```

## Correrlo solo (desarrollo)

```sh
npm install
npx ng serve       # http://localhost:4201
```

## Estado

Esqueleto: el componente `Gestion` es un marcador. Pendiente: Apollo Angular, lista y formulario de proveedores, pantalla de reportes con ECharts.
