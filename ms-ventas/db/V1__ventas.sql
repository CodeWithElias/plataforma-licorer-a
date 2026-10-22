-- ms-ventas – PostgreSQL
-- Se ejecuta solo al crear el contenedor postgres-ventas (docker-entrypoint-initdb.d).

CREATE TABLE venta (
  id              UUID PRIMARY KEY,
  numero          BIGSERIAL UNIQUE,
  operation_id    UUID NOT NULL UNIQUE,          -- generado en el cliente; evita duplicados
  sucursal_id     VARCHAR(20) NOT NULL,          -- referencia lógica a ms-gestion
  cajero_id       VARCHAR(64) NOT NULL,          -- 'sub' del token de Keycloak
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  estado          VARCHAR(15) NOT NULL CHECK (estado IN ('PENDIENTE','COMPLETADA','CANCELADA')),
  origen          VARCHAR(10) NOT NULL DEFAULT 'ONLINE' CHECK (origen IN ('ONLINE','OFFLINE'))
);

CREATE TABLE detalle_venta (
  id               BIGSERIAL PRIMARY KEY,
  venta_id         UUID NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
  producto_codigo  VARCHAR(30) NOT NULL,         -- referencia lógica a ms-inventario
  producto_nombre  VARCHAR(120) NOT NULL,        -- copia al momento de la venta
  cantidad         INT NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(10,2) NOT NULL,
  subtotal         NUMERIC(12,2) NOT NULL
);

CREATE TABLE pago (
  id        BIGSERIAL PRIMARY KEY,
  venta_id  UUID NOT NULL UNIQUE REFERENCES venta(id),
  metodo    VARCHAR(15) NOT NULL CHECK (metodo IN ('EFECTIVO','TARJETA','QR')),
  monto     NUMERIC(12,2) NOT NULL,
  estado    VARCHAR(15) NOT NULL CHECK (estado IN ('APROBADO','REEMBOLSADO'))
);

CREATE TABLE saga_instancia (
  id              UUID PRIMARY KEY,
  venta_id        UUID NOT NULL REFERENCES venta(id),
  paso_actual     VARCHAR(30) NOT NULL,          -- CREAR_VENTA, RESERVAR_STOCK, REGISTRAR_INGRESO, CONFIRMAR
  estado          VARCHAR(15) NOT NULL CHECK (estado IN ('EN_CURSO','COMPLETADA','COMPENSANDO','COMPENSADA','FALLIDA')),
  reserva_id      VARCHAR(64),                   -- devuelto por ms-inventario
  ingreso_id      VARCHAR(64),                   -- devuelto por ms-gestion
  error           TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_keys (
  clave        UUID PRIMARY KEY,                 -- encabezado Idempotency-Key
  endpoint     VARCHAR(60) NOT NULL,
  estado_http  INT NOT NULL,
  respuesta    JSONB NOT NULL,                   -- se devuelve igual si la clave se repite
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venta_fecha   ON venta(fecha);
CREATE INDEX idx_detalle_venta ON detalle_venta(venta_id);
CREATE INDEX idx_saga_estado   ON saga_instancia(estado);
