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
