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

- `GET http://localhost/api/ventas/health`
- Swagger: `http://localhost/api/ventas/swagger-ui.html`

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

## Base de datos

Las tablas (`venta`, `detalle_venta`, `pago`, `saga_instancia`, `idempotency_keys`) las crea **Flyway** al arrancar el servicio, a partir de los scripts de `db/`. El `pom.xml` copia `db/` a `classpath:db/migration`, así funciona igual en Docker, en local o contra una base administrada.

Para cambiar el esquema no se edita `V1__ventas.sql`: se agrega un script nuevo, por ejemplo `db/V2__agrega_columna.sql`.
