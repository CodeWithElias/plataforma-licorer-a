# ms-gestion

Microservicio de gestión de la Plataforma Licorería: proveedores, empleados, órdenes de compra, contabilidad (ingresos de la Saga de ventas) y reportes. Única API **GraphQL** del sistema.

| | |
|---|---|
| Dueño | Dev 2 |
| Tecnología | NestJS + MongoDB |
| Arquitectura | DDD (bounded contexts: proveedores, contabilidad, compras, reportes) |
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

## Operaciones GraphQL

| Operación | Rol | Estado |
|---|---|---|
| `salud` | público | ✅ |
| `yo` | cualquiera con token | ✅ Usuario y roles del token |
| `proveedores(activo)`, `proveedor(id)`, `crearProveedor`, `editarProveedor` | GERENTE, ADMIN | ✅ CU05 |
| `registrarIngreso(input)`, `anularIngreso(operationId)` | CAJERO (token reenviado por ms-ventas) | ✅ CU02, idempotentes por `operationId` |
| `crearOrdenCompra`, `ordenesCompra` | GERENTE | Semana 3 (CU06) |
| `reportes`, `exportarReporte` | GERENTE | Semana 3 (CU07) |

Los errores de negocio llegan en `errors[].extensions.code`: `DATOS_INVALIDOS`, `NIT_DUPLICADO`, `PROVEEDOR_NO_ENCONTRADO`, `INGRESO_NO_ENCONTRADO`, `UNAUTHENTICATED`, `FORBIDDEN`.

## Estructura (DDD)

```
src/
├── compartido/        auth (passport-jwt + jwks-rsa, @Publico, @Roles, @UsuarioActual), mongo (conexión a Atlas), errores
├── proveedores/       dominio (Proveedor, Nit) · aplicacion (casos de uso) · infraestructura (Mongo) · interfaces (resolver)
├── contabilidad/      dominio (Ingreso) · aplicacion (RegistrarIngreso, AnularIngreso) · infraestructura · interfaces
├── compras/           semana 3
└── reportes/          semana 3
```

**Seguridad:** todo resolver o controller exige token de Keycloak por defecto (guard global); `@Publico()` lo libera y `@Roles('GERENTE')` exige un rol.

## Pruebas

```sh
npm test          # dominio y casos de uso con repositorios en memoria (proveedores, contabilidad)
npm run test:e2e  # /health, salud y yo sin token
```
