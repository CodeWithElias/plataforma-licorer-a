-- App Flutter – SQLite: catálogo y stock para consultar sin internet (CU04)

CREATE TABLE producto (
  codigo           TEXT PRIMARY KEY,
  nombre           TEXT NOT NULL,
  marca            TEXT,
  tipo             TEXT,
  precio           REAL NOT NULL,
  etiqueta_modelo  TEXT NOT NULL      -- clase que devuelve el modelo TFLite
);

CREATE TABLE stock (
  producto_codigo  TEXT PRIMARY KEY REFERENCES producto(codigo),
  cantidad         INTEGER NOT NULL,
  actualizado_en   TEXT NOT NULL
);

CREATE TABLE sync_info (
  clave  TEXT PRIMARY KEY,            -- p. ej. 'ultima_sync', 'version_modelo'
  valor  TEXT NOT NULL
);

-- Fotos analizadas que esperan subir a S3 (la imagen está en un archivo; aquí solo la ruta y lo que predijo)
CREATE TABLE foto_pendiente (
  id         TEXT PRIMARY KEY,
  archivo    TEXT NOT NULL,
  etiqueta   TEXT NOT NULL,
  confianza  REAL NOT NULL,
  usuario    TEXT NOT NULL,
  creada_en  TEXT NOT NULL
);
