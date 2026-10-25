# ms-ventas

Microservicio de ventas de la Plataforma Licorería: registra ventas con una **Saga orquestada** (reserva de stock en ms-inventario, ingreso en ms-gestion y compensación si algo falla) y sincroniza las ventas hechas sin conexión sin duplicarlas.

| | |
|---|---|
| Dueño | Dev 1 |
| Tecnología | Spring Boot 4 (Java 17) + PostgreSQL |
| Arquitectura | Hexagonal (puertos y adaptadores) |
| Puerto | 8080 (por Nginx: `/api/ventas/`) |
| Contrato | `docs/openapi.yaml` |
| Base de datos | PostgreSQL en Supabase · esquema en `db/V1__ventas.sql` (migraciones de Flyway) |

## Correrlo con todo el sistema

Desde la raíz del monorepo:

```sh
docker compose up -d --build ms-ventas
```

- `GET http://localhost:8080/health` directo, o `http://localhost/api/ventas/health` por el gateway
- Swagger: `http://localhost:8080/swagger-ui.html` (por el gateway: `http://localhost/api/ventas/swagger-ui.html`)

## Correrlo solo (desarrollo)

1. Levantar Keycloak (desde la raíz); la base está en Supabase:
   ```sh
   docker compose up -d keycloak nginx
   ```
2. Ejecutar desde la carpeta `ms-ventas/`. Spring lee las variables de `.env` (`spring.config.import=optional:file:.env[.properties]`); si no existe, créalo con `sh infra/crear-env.sh` (desde la raíz) o copiando `.env.example`:
   ```sh
   cp .env.example .env    # solo la primera vez
   ./mvnw spring-boot:run
   ```

## Endpoints

| Método y ruta | Rol | Estado |
|---|---|---|
| `POST /ventas` (encabezado `Idempotency-Key`) | CAJERO | ✅ Semana 2: Saga completa |
| `GET /ventas/{id}` | CAJERO, GERENTE | ✅ Venta con detalle, pago y estado de la Saga |
| `GET /ventas?desde=&hasta=` | GERENTE | ✅ Ventas COMPLETADAS del periodo (tool MCP `ventas_por_periodo`) |
| `POST /ventas/sync` | CAJERO | Semana 3 (CU03) |

## La Saga (CU02)

`application/service/SagaOrquestador` ejecuta los 4 pasos y guarda el estado en `saga_instancia` después de cada uno:

1. Venta PENDIENTE + pago simulado APROBADO (local).
2. `POST /stock/reservas` en ms-inventario (`reservaId` = `Idempotency-Key`).
3. `registrarIngreso` en ms-gestion (GraphQL).
4. `POST /stock/reservas/{id}/confirmar` y venta COMPLETADA.

Si un paso falla compensa en orden inverso (anular ingreso → liberar reserva → venta CANCELADA y pago REEMBOLSADO). Las compensaciones son independientes: lo que se puede deshacer se deshace al instante y lo que falla queda pendiente (saga `COMPENSANDO`). La tarea `ReintentoCompensaciones` lo reintenta cada 30 s con el token del cliente `ms-ventas` de Keycloak (`VENTAS_CLIENT_SECRET` en `.env`), hasta dejarla `COMPENSADA`. También retoma las sagas `EN_CURSO` de más de 2 minutos (el servicio se cayó a mitad).

Cada llamada remota tiene 5 s de tiempo máximo y 2 reintentos con espera (solo ante caídas o 5xx); es seguro porque ms-inventario y ms-gestion no repiten un mismo `operationId`. El token del cajero se reenvía en cada llamada.

**Prueba de falla forzada:** `docker compose stop ms-gestion`, vender desde el POS → 502 `SAGA_COMPENSADA`, venta CANCELADA y reserva LIBERADA; `docker compose start ms-gestion` → en ≤ 60 s la saga pasa a COMPENSADA.

## Estructura hexagonal

```
src/main/java/com/licoreria/ventas/
├── domain/                 sin Spring ni JPA
│   ├── model/              Venta (agregado), DetalleVenta, Pago, EstadoVenta, MetodoPago, OrigenVenta
│   ├── saga/               SagaInstancia, PasoSaga, EstadoSaga
│   └── exception/          SinStock, SagaCompensada, ProductoNoEncontrado, …
├── application/
│   ├── port/in/            RegistrarVentaUseCase, ConsultarVentasUseCase
│   ├── port/out/           VentaRepositoryPort, SagaRepositoryPort, InventarioPort, GestionPort, TokenServicioPort
│   └── service/            RegistrarVentaService, ConsultarVentasService, SagaOrquestador, ReintentoCompensaciones
└── infrastructure/
    ├── adapter/in/web/     VentaController, ManejadorErrores
    ├── adapter/out/        persistence (JPA), inventario (REST), gestion (GraphQL), keycloak (token de servicio)
    └── config/             SecurityConfig, BeanConfig, OpenApiConfig
```

`SagaOrquestador` solo conoce `InventarioPort` y `GestionPort`: no sabe que uno es REST y el otro GraphQL.

## Pruebas

```sh
./mvnw test     # SagaOrquestadorTest: Saga con puertos falsos (venta normal, sin stock, rollback, compensación pendiente)
```

## Base de datos

Las tablas (`venta`, `detalle_venta`, `pago`, `saga_instancia`, `idempotency_keys`) las crea **Flyway** al arrancar el servicio, a partir de los scripts de `db/`. El `pom.xml` copia `db/` a `classpath:db/migration`, así funciona igual en Docker, en local o contra una base administrada. Hibernate valida al arrancar que las entidades coincidan con las tablas (`ddl-auto=validate`).

Para cambiar el esquema no se edita un script ya aplicado: se agrega uno nuevo (`db/V2__sin_sucursales.sql` quitó la columna `sucursal_id`, porque la licorería tiene una sola sucursal).
