# mfe-pos

Micro frontend del punto de venta de la Plataforma Licorería: catálogo, carrito y cobro; funciona sin conexión como PWA y sincroniza las ventas pendientes (CU02, CU03, CU04).

| | |
|---|---|
| Dueño | Dev 2 (componente TF.js de Dev 3) |
| Tecnología | React + Vite + vite-plugin-pwa (Workbox) |
| Puerto | 4202 (directo: `http://localhost:4202/mfe-pos/`; por el gateway: `http://localhost/mfe-pos/`) |
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

| Función | Estado |
|---|---|
| Catálogo (ms-inventario) con búsqueda y filtro por tipo | ✅ Semana 2 |
| Carrito, total y método de pago | ✅ Semana 2 |
| **Cobrar** → `POST /api/ventas/ventas` con `Idempotency-Key` nuevo (Saga) y mensaje según el resultado (venta completada, sin stock, venta revertida) | ✅ Semana 2 (CU02) |
| Sesión: dentro del Shell usa `window.licoreriaAuth`; como PWA sola inicia sesión con Keycloak (`src/auth.ts`) | ✅ Semana 2 |
| Dexie (IndexedDB), cola offline y `POST /ventas/sync` | Semana 3 (CU03) |
| Reconocimiento con TF.js desde la webcam | Semana 3 (CU04) |

## Pruebas

```sh
npm test      # total del carrito y mensajes de error de la Saga
```
