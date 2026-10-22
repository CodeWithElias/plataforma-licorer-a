# ms-inventario

Microservicio de inventario de la Plataforma Licorería: catálogo de productos, stock por sucursal y reservas de stock para la Saga de ventas, con **escrituras condicionales** (idempotencia) y **bloqueo optimista** en DynamoDB. Avisa a n8n cuando el stock baja del mínimo.

| | |
|---|---|
| Dueño | Dev 1 |
| Tecnología | PHP 8.4 · Laravel 13 + DynamoDB |
| Arquitectura | Clean Architecture (`src/`: Entities, UseCases, InterfaceAdapters, Frameworks) |
| Puerto | 8001 (por Nginx: `/api/inventario/`) |
| Contrato | `docs/openapi.yaml` |
| Base de datos | `db/inventario.sh` |

## Correrlo con todo el sistema

Desde la raíz del monorepo:

```sh
docker compose up -d --build ms-inventario
```

- `GET http://localhost:8001/health` directo, o `http://localhost/api/inventario/health` por el gateway (incluye las tablas de DynamoDB)

## Correrlo solo (desarrollo)

1. Levantar DynamoDB (y crear las tablas) y Keycloak (desde la raíz):
   ```sh
   docker compose up -d dynamodb dynamodb-init keycloak nginx
   ```
2. Ejecutar:
   ```sh
   cp .env.example .env
   composer install
   php artisan key:generate
   php -S localhost:8001 -t public public/index.php
   ```

Sin PHP instalado: `docker compose up -d --build ms-inventario`.

## Estructura Clean

```
src/
├── Entities/                 PHP puro, con sus reglas
├── UseCases/   └── Ports/    casos de uso e interfaces (sin Illuminate ni AWS SDK)
├── InterfaceAdapters/        Controllers y Presenters
└── Frameworks/               Persistence (DynamoDB), Http (middleware, /health), Laravel (ServiceProvider)
```

`Frameworks/Laravel/InventarioServiceProvider` une las interfaces con sus implementaciones. Si `DYNAMODB_ENDPOINT` está vacío, el cliente usa AWS real.

## Endpoints

Todos implementados según `docs/openapi.yaml` (por Nginx: `http://localhost/api/inventario/...`):

| Método y ruta | Rol | Qué hace |
|---|---|---|
| `GET /productos?tipo=` | cualquiera con token | Catálogo (20 productos) |
| `GET /productos/{codigo}` | cualquiera con token | Un producto |
| `GET /stock?sucursal=SUC-01` | GERENTE, ALMACEN | Stock con `disponible = cantidad − reservado` |
| `POST /stock/reservas` | CAJERO | Reserva (idempotente por `reservaId`, transacción + bloqueo optimista) |
| `GET /stock/reservas/{id}` | CAJERO, GERENTE | Consulta una reserva |
| `POST /stock/reservas/{id}/confirmar` | CAJERO | Descuenta el stock; avisa a n8n si queda bajo el mínimo |
| `DELETE /stock/reservas/{id}` | CAJERO | Libera lo reservado (compensación) |

## Catálogo de ejemplo

Al arrancar, el contenedor ejecuta `php artisan inventario:seed`, que inserta los 20 productos y su stock en `SUC-01` y `SUC-02` si faltan (no pisa lo existente). Para volver al stock inicial:

```sh
docker compose exec ms-inventario php artisan inventario:seed --forzar
```

## Pruebas

Pruebas unitarias de los casos de uso con repositorios en memoria (`tests/Unit`), sin DynamoDB:

```sh
# con PHP local
composer install && php vendor/bin/phpunit --testsuite Unit
# sin PHP (desde ms-inventario/, en Git Bash)
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" -w /app composer:2 sh -c "composer install -q && php vendor/bin/phpunit --testsuite Unit"
```

## Base de datos

`db/inventario.sh` crea las tablas `Productos`, `Stock` y `Reservas` en DynamoDB Local y carga un producto de ejemplo. Es idempotente. En Docker lo ejecuta el servicio `dynamodb-init`; fuera de Docker, con AWS CLI v2: `sh db/inventario.sh`.
