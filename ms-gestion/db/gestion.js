// ms-gestion – MongoDB. Lo aplica el servicio mongo-init del compose en cada arranque:
//   mongosh "$MONGO_URL" db/gestion.js
// Idempotente: si una colección ya existe, actualiza su validador en lugar de fallar.
db = db.getSiblingDB(process.env.MONGO_DB || 'gestion');

function crearColeccion(nombre, opciones) {
  if (db.getCollectionNames().includes(nombre)) {
    db.runCommand({ collMod: nombre, ...opciones });
  } else {
    db.createCollection(nombre, opciones);
  }
}

// La licorería tiene una sola sucursal: no hay colección de sucursales (se borra si quedó de una versión anterior)
if (db.getCollectionNames().includes('sucursales')) db.sucursales.drop();

crearColeccion('empleados', { validator: { $jsonSchema: {
  bsonType: 'object', required: ['keycloakId', 'ci', 'nombre', 'cargo', 'activo'],
  properties: {
    keycloakId: { bsonType: 'string' }, ci: { bsonType: 'string' }, nombre: { bsonType: 'string' },
    cargo: { enum: ['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN'] }, activo: { bsonType: 'bool' } } } } });
db.empleados.createIndex({ keycloakId: 1 }, { unique: true });
db.empleados.createIndex({ ci: 1 }, { unique: true });

crearColeccion('proveedores', { validator: { $jsonSchema: {
  bsonType: 'object', required: ['nit', 'razonSocial', 'activo'],
  properties: {
    nit: { bsonType: 'string' }, razonSocial: { bsonType: 'string' },
    contacto: { bsonType: 'object', properties: { nombre: { bsonType: 'string' }, telefono: { bsonType: 'string' }, email: { bsonType: 'string' } } },
    productos: { bsonType: 'array', items: { bsonType: 'string' } },   // códigos de ms-inventario
    activo: { bsonType: 'bool' } } } } });
db.proveedores.createIndex({ nit: 1 }, { unique: true });

crearColeccion('ordenes_compra', { validator: { $jsonSchema: {
  bsonType: 'object', required: ['numero', 'proveedorId', 'fecha', 'estado', 'origen', 'lineas', 'total'],
  properties: {
    numero: { bsonType: 'string' }, proveedorId: { bsonType: 'objectId' }, fecha: { bsonType: 'date' },
    estado: { enum: ['BORRADOR', 'ENVIADA', 'RECIBIDA', 'ANULADA'] },
    origen: { enum: ['MANUAL', 'AGENTE'] },
    lineas: { bsonType: 'array', minItems: 1, items: { bsonType: 'object', required: ['productoCodigo', 'cantidad', 'precioUnitario'],
      properties: { productoCodigo: { bsonType: 'string' }, cantidad: { bsonType: 'int', minimum: 1 }, precioUnitario: { bsonType: 'decimal' } } } },
    total: { bsonType: 'decimal' } } } } });
db.ordenes_compra.createIndex({ numero: 1 }, { unique: true });
db.ordenes_compra.createIndex({ proveedorId: 1, fecha: -1 });

crearColeccion('ingresos', { validator: { $jsonSchema: {
  bsonType: 'object', required: ['operationId', 'ventaId', 'monto', 'fecha', 'estado'],
  properties: {
    operationId: { bsonType: 'string' }, ventaId: { bsonType: 'string' },
    monto: { bsonType: 'decimal' }, fecha: { bsonType: 'date' }, estado: { enum: ['ACTIVO', 'ANULADO'] } } } } });
db.ingresos.createIndex({ operationId: 1 }, { unique: true });   // idempotencia del paso de la Saga
db.ingresos.createIndex({ fecha: -1 });

crearColeccion('reportes', { validator: { $jsonSchema: {
  bsonType: 'object', required: ['consulta', 'columnas', 'datos', 'tipoGrafico', 'creadoPor', 'fecha'],
  properties: {
    consulta: { bsonType: 'string' }, columnas: { bsonType: 'array' }, datos: { bsonType: 'array' },
    tipoGrafico: { enum: ['barras', 'lineas', 'torta', 'tabla'] }, resumen: { bsonType: 'string' },
    creadoPor: { bsonType: 'string' }, fecha: { bsonType: 'date' },
    archivos: { bsonType: 'array', items: { bsonType: 'object', properties: { formato: { enum: ['XLSX', 'PDF'] }, ruta: { bsonType: 'string' } } } } } } } });
db.reportes.createIndex({ creadoPor: 1, fecha: -1 });

print('Base ' + db.getName() + ' lista: ' + db.getCollectionNames().sort().join(', '));
