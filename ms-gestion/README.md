# ms-gestion

Microservicio de gestión de la Plataforma Licorería: proveedores, empleados, órdenes de compra, contabilidad (ingresos de la Saga de ventas) y reportes. Única API **GraphQL** del sistema.

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | NestJS + MongoDB |
| Arquitectura | DDD (bounded contexts: proveedores, contabilidad, reportes) |
| Puerto | 3000 (por Nginx: `/graphql`) |
| Contrato | `schema.graphql` |
| Base de datos | `db/gestion.js` |

## Correrlo con todo el sistema

Desde la raíz del monorepo:

```sh
docker compose up -d --build ms-gestion
```

## Correrlo solo (desarrollo)

```sh
docker compose up -d keycloak nginx         # desde la raíz (la base está en Atlas)
cp .env.example .env
npm install
npm run start:dev
```

- `GET http://localhost:3000/health`
- GraphQL: `POST http://localhost:3000/graphql` con `{ salud }`

## Estado

Esqueleto: `/health` y la query `salud`. El resto de `schema.graphql` es el contrato acordado y todavía no tiene resolvers (responde `null`).

Lo que espera ms-ventas (Saga, CU02): `registrarIngreso(input: {operationId, ventaId, sucursalId, monto})` y `anularIngreso(operationId)`, ambos idempotentes por `operationId`.

## Pruebas

```sh
npm test          # unitarias
npm run test:e2e  # /health y query salud
```
