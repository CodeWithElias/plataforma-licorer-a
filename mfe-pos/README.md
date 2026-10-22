# mfe-pos

Micro frontend del punto de venta de la Plataforma Licorería: catálogo, carrito y cobro; funciona sin conexión como PWA y sincroniza las ventas pendientes (CU02, CU03, CU04).

| | |
|---|---|
| Dueño | Dev 2 (componente TF.js de Dev 3) |
| Tecnología | React + Vite + vite-plugin-pwa (Workbox) |
| Puerto | 80 en el contenedor (por Nginx: `/mfe-pos/`) |
| Consume | ms-ventas, ms-inventario, ms-ia |

## Cómo se integra con el Shell

El build genera dos entradas:

- `index.html`: el POS como PWA independiente en `http://localhost/mfe-pos/`.
- `pos-element.js`: Web Component `<licoreria-pos>` que el Shell Angular importa en la ruta `/pos`.

Se usa Web Component en lugar de Native Federation para el remoto React (plan B del plan general: Native Federation entre Angular y React es frágil).

## Correrlo con todo el sistema

```sh
docker compose up -d --build mfe-pos web-shell nginx   # desde la raíz
```

## Correrlo solo (desarrollo)

```sh
npm install
npm run dev        # http://localhost:4202/mfe-pos/
```

## Estado

Esqueleto: la pantalla `Pos` es un marcador. Pendiente: catálogo, carrito, Dexie (IndexedDB) y cola offline.
