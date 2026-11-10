import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Fila de la tabla `producto` definida en `lib/db/esquema.sql`.
class ProductoLocal {
  const ProductoLocal({
    required this.codigo,
    required this.nombre,
    this.marca,
    this.tipo = 'OTRO',
    required this.precio,
    required this.etiquetaModelo,
  });

  final String codigo;
  final String nombre;
  final String? marca;
  final String tipo;
  final double precio;
  final String etiquetaModelo;

  Map<String, dynamic> aJson() => {
        'codigo': codigo,
        'nombre': nombre,
        'marca': marca,
        'tipo': tipo,
        'precio': precio,
        'etiqueta_modelo': etiquetaModelo,
      };

  factory ProductoLocal.desdeJson(Map<String, dynamic> j) => ProductoLocal(
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        marca: j['marca'] as String?,
        tipo: (j['tipo'] as String?) ?? 'OTRO',
        precio: (j['precio'] as num).toDouble(),
        etiquetaModelo: (j['etiqueta_modelo'] as String?) ??
            (j['etiquetaModelo'] as String?) ??
            mapaCodigoAEtiqueta[j['codigo'] as String] ??
            '',
      );
}

/// Fila de la tabla `stock` definida en `lib/db/esquema.sql`.
class StockLocal {
  const StockLocal({
    required this.productoCodigo,
    required this.cantidad,
    required this.actualizadoEn,
  });

  final String productoCodigo;
  final int cantidad;
  final String actualizadoEn;

  Map<String, dynamic> aJson() => {
        'producto_codigo': productoCodigo,
        'cantidad': cantidad,
        'actualizado_en': actualizadoEn,
      };

  factory StockLocal.desdeJson(Map<String, dynamic> j) => StockLocal(
        productoCodigo: (j['producto_codigo'] ?? j['productoCodigo']) as String,
        cantidad: ((j['cantidad'] ?? j['disponible'] ?? 0) as num).toInt(),
        actualizadoEn: (j['actualizado_en'] ?? j['actualizadoEn'] ?? DateTime.now().toUtc().toIso8601String()) as String,
      );
}

/// Fila de `foto_pendiente`: una foto analizada que todavía no se subió a S3.
class FotoPendiente {
  const FotoPendiente({
    required this.id,
    required this.archivo,
    required this.etiqueta,
    required this.confianza,
    required this.usuario,
    required this.creadaEn,
  });

  final String id;
  final String archivo;
  final String etiqueta;
  final double confianza;
  final String usuario;
  final DateTime creadaEn;

  Map<String, dynamic> aJson() => {
        'id': id,
        'archivo': archivo,
        'etiqueta': etiqueta,
        'confianza': confianza,
        'usuario': usuario,
        'creada_en': creadaEn.toUtc().toIso8601String(),
      };

  factory FotoPendiente.desdeJson(Map<String, Object?> j) => FotoPendiente(
        id: j['id'] as String,
        archivo: j['archivo'] as String,
        etiqueta: j['etiqueta'] as String,
        confianza: (j['confianza'] as num).toDouble(),
        usuario: j['usuario'] as String,
        creadaEn: DateTime.parse(j['creada_en'] as String),
      );
}

/// Vista unificada `producto JOIN stock` para consulta sin conexión (CU04 / R07).
class ProductoConStock {
  const ProductoConStock({
    required this.producto,
    required this.cantidad,
    required this.actualizadoEn,
  });

  final ProductoLocal producto;
  final int cantidad;
  final String actualizadoEn;
}

/// Mapeo oficial entre códigos del catálogo (`ms-inventario`) y clases del modelo TFLite (`ms-ia`).
const Map<String, String> mapaCodigoAEtiqueta = {
  'CER-001': 'pacena_620',
  'CER-003': 'huari_620',
  'SIN-001': 'casareal_negra',
  'WHI-001': 'jw_red',
  'VOD-001': 'absolut_750',
};

const Map<String, String> mapaEtiquetaACodigo = {
  'pacena_620': 'CER-001',
  'huari_620': 'CER-003',
  'casareal_negra': 'SIN-001',
  'jw_red': 'WHI-001',
  'absolut_750': 'VOD-001',
};

/// Base SQLite del teléfono con las tablas `producto`, `stock` y `sync_info` de `lib/db/esquema.sql`: catálogo y
/// stock para consultar sin internet (CU04 / R07).
class BaseLocal {
  /// [fabrica] y [ruta] solo se pasan en las pruebas, que no tienen el SQLite del dispositivo.
  BaseLocal({DatabaseFactory? fabrica, String? ruta}) {
    _fabrica = fabrica;
    _ruta = ruta;
  }

  /// 2: tabla foto_pendiente (fotos analizadas que esperan subir a S3)
  static const _version = 2;
  static const _tablaFotos = '''
    CREATE TABLE IF NOT EXISTS foto_pendiente (
      id TEXT PRIMARY KEY, archivo TEXT NOT NULL, etiqueta TEXT NOT NULL, confianza REAL NOT NULL,
      usuario TEXT NOT NULL, creada_en TEXT NOT NULL)''';
  static const _nombreArchivo = 'licoreria_offline.db';

  /// Lo mínimo para usar la app sin haber sincronizado nunca; se reemplaza en la primera sincronización.
  static const _semillas = <({ProductoLocal producto, int cantidad})>[
    (
      producto: ProductoLocal(
        codigo: 'CER-001',
        nombre: 'Cerveza Paceña 620 ml',
        marca: 'Paceña',
        tipo: 'CERVEZA',
        precio: 12.0,
        etiquetaModelo: 'pacena_620',
      ),
      cantidad: 48,
    ),
    (
      producto: ProductoLocal(
        codigo: 'CER-003',
        nombre: 'Cerveza Huari 620 ml',
        marca: 'Huari',
        tipo: 'CERVEZA',
        precio: 14.0,
        etiquetaModelo: 'huari_620',
      ),
      cantidad: 36,
    ),
    (
      producto: ProductoLocal(
        codigo: 'SIN-001',
        nombre: 'Singani Casa Real Etiqueta Negra 750 ml',
        marca: 'Casa Real',
        tipo: 'SINGANI',
        precio: 95.0,
        etiquetaModelo: 'casareal_negra',
      ),
      cantidad: 18,
    ),
    (
      producto: ProductoLocal(
        codigo: 'WHI-001',
        nombre: 'Whisky Johnnie Walker Red Label 750 ml',
        marca: 'Johnnie Walker',
        tipo: 'WHISKY',
        precio: 180.0,
        etiquetaModelo: 'jw_red',
      ),
      cantidad: 10,
    ),
    (
      producto: ProductoLocal(
        codigo: 'VOD-001',
        nombre: 'Vodka Absolut 750 ml',
        marca: 'Absolut',
        tipo: 'VODKA',
        precio: 150.0,
        etiquetaModelo: 'absolut_750',
      ),
      cantidad: 12,
    ),
  ];

  static const _consultaProductos = '''
    SELECT p.codigo, p.nombre, p.marca, p.tipo, p.precio, p.etiqueta_modelo, s.cantidad, s.actualizado_en
    FROM producto p LEFT JOIN stock s ON s.producto_codigo = p.codigo''';

  late final DatabaseFactory? _fabrica;
  late final String? _ruta;
  Future<Database>? _abriendo;

  /// Abre la base una sola vez; si la apertura falla, el siguiente intento vuelve a probar.
  Future<Database> _base() => _abriendo ??= _abrir().catchError((Object e) {
        _abriendo = null;
        throw e;
      });

  Future<Database> _abrir() async {
    final fabrica = _fabrica ?? databaseFactory;
    final ruta = _ruta ?? p.join(await fabrica.getDatabasesPath(), _nombreArchivo);
    return fabrica.openDatabase(
      ruta,
      options: OpenDatabaseOptions(
        version: _version,
        onCreate: _crear,
        // Teléfonos que ya tenían la base de la versión 1: solo se agrega la tabla nueva, sin tocar sus datos
        onUpgrade: (db, anterior, _) async {
          if (anterior < 2) await db.execute(_tablaFotos);
        },
      ),
    );
  }

  Future<void> _crear(Database db, int _) async {
    final esquema = await rootBundle.loadString('lib/db/esquema.sql');
    await db.transaction((tx) async {
      for (final sentencia in _sentenciasDe(esquema)) {
        await tx.execute(sentencia);
      }
      final ahora = DateTime.now().toUtc().toIso8601String();
      for (final s in _semillas) {
        await tx.insert('producto', s.producto.aJson());
        await tx.insert('stock', StockLocal(productoCodigo: s.producto.codigo, cantidad: s.cantidad, actualizadoEn: ahora).aJson());
      }
    });
  }

  /// Separa un script SQL en sentencias, sin los comentarios `--`.
  static List<String> _sentenciasDe(String esquema) => esquema
      .replaceAll(RegExp(r'--[^\n]*'), '')
      .split(';')
      .map((x) => x.trim())
      .where((x) => x.isNotEmpty)
      .toList();

  static ProductoConStock _aProductoConStock(Map<String, Object?> f) => ProductoConStock(
        producto: ProductoLocal.desdeJson(f),
        cantidad: (f['cantidad'] as int?) ?? 0,
        actualizadoEn: (f['actualizado_en'] as String?) ?? '',
      );

  /// Abre la base y crea sus tablas si es la primera vez.
  Future<void> inicializar() => _base();

  /// `producto JOIN stock` filtrando por texto (código, nombre, marca, etiqueta) y tipo de bebida.
  Future<List<ProductoConStock>> listarProductos({String busqueda = '', String tipo = ''}) async {
    final db = await _base();
    final filtros = <String>[];
    final valores = <Object>[];
    if (tipo.trim().isNotEmpty) {
      filtros.add('UPPER(p.tipo) = ?');
      valores.add(tipo.trim().toUpperCase());
    }
    if (busqueda.trim().isNotEmpty) {
      filtros.add("LOWER(p.codigo || ' ' || p.nombre || ' ' || COALESCE(p.marca, '') || ' ' || p.etiqueta_modelo) LIKE ?");
      valores.add('%${busqueda.trim().toLowerCase()}%');
    }
    final donde = filtros.isEmpty ? '' : 'WHERE ${filtros.join(' AND ')}';
    final filas = await db.rawQuery('$_consultaProductos $donde ORDER BY p.codigo', valores);
    return filas.map(_aProductoConStock).toList();
  }

  /// Cantidad en stock de cada producto guardado, por código.
  Future<Map<String, int>> stockPorCodigo() async {
    final db = await _base();
    final filas = await db.query('stock', columns: ['producto_codigo', 'cantidad']);
    return {for (final f in filas) f['producto_codigo'] as String: f['cantidad'] as int};
  }

  Future<List<String>> tiposDisponibles() async {
    final db = await _base();
    final filas = await db.rawQuery('SELECT DISTINCT UPPER(tipo) AS tipo FROM producto WHERE tipo IS NOT NULL ORDER BY 1');
    return filas.map((f) => f['tipo'] as String).toList();
  }

  Future<ProductoConStock?> buscarPorCodigo(String codigo) async {
    final db = await _base();
    final filas = await db.rawQuery('$_consultaProductos WHERE p.codigo = ?', [codigo]);
    return filas.isEmpty ? null : _aProductoConStock(filas.first);
  }

  /// Busca un producto y su stock local a partir de la clase predicha por el modelo TFLite.
  Future<ProductoConStock?> buscarPorEtiqueta(String etiqueta) async {
    final db = await _base();
    final filas = await db.rawQuery('$_consultaProductos WHERE p.etiqueta_modelo = ?', [etiqueta]);
    if (filas.isNotEmpty) return _aProductoConStock(filas.first);
    final codigo = mapaEtiquetaACodigo[etiqueta];
    return codigo != null ? buscarPorCodigo(codigo) : null;
  }

  /// Actualiza catálogo y stock al sincronizar con `ms-inventario`, todo o nada.
  Future<void> guardarCatalogoYStock(
    List<ProductoLocal> productos,
    List<StockLocal> stocks, {
    String? versionModelo,
  }) async {
    final db = await _base();
    final codigos = productos.map((x) => x.codigo).toSet();
    await db.transaction((tx) async {
      for (final x in productos) {
        await tx.insert('producto', x.aJson(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
      for (final s in stocks.where((s) => codigos.contains(s.productoCodigo))) {
        await tx.insert('stock', s.aJson(), conflictAlgorithm: ConflictAlgorithm.replace);
      }
      await _guardarInfo(tx, 'ultima_sync', DateTime.now().toUtc().toIso8601String());
      if (versionModelo != null && versionModelo.isNotEmpty) {
        await _guardarInfo(tx, 'version_modelo', versionModelo);
      }
    });
  }

  // ---- Cola de fotos para S3 ----

  Future<void> encolarFoto(FotoPendiente f) async {
    final db = await _base();
    await db.insert('foto_pendiente', f.aJson(), conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// Las más antiguas primero.
  Future<List<FotoPendiente>> fotosPendientes({int limite = 20}) async {
    final db = await _base();
    final filas = await db.query('foto_pendiente', orderBy: 'creada_en', limit: limite);
    return filas.map(FotoPendiente.desdeJson).toList();
  }

  Future<int> contarFotosPendientes() async {
    final db = await _base();
    return Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM foto_pendiente')) ?? 0;
  }

  Future<void> quitarFoto(String id) async {
    final db = await _base();
    await db.delete('foto_pendiente', where: 'id = ?', whereArgs: [id]);
  }

  Future<String?> obtenerSyncInfo(String clave) async {
    final db = await _base();
    final filas = await db.query('sync_info', columns: ['valor'], where: 'clave = ?', whereArgs: [clave]);
    return filas.isEmpty ? null : filas.first['valor'] as String;
  }

  Future<void> guardarSyncInfo(String clave, String valor) async => _guardarInfo(await _base(), clave, valor);

  Future<void> _guardarInfo(DatabaseExecutor db, String clave, String valor) =>
      db.insert('sync_info', {'clave': clave, 'valor': valor}, conflictAlgorithm: ConflictAlgorithm.replace);

  Future<void> cerrar() async {
    final abriendo = _abriendo;
    _abriendo = null;
    if (abriendo != null) await (await abriendo).close();
  }
}
