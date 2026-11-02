import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;

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

/// Base de datos local offline que implementa las tablas `producto`, `stock` y `sync_info`
/// de `lib/db/esquema.sql` con persistencia en disco en el dispositivo.
class BaseLocal {
  BaseLocal({this.persistirEnDisco = true, String? rutaArchivo})
      : _rutaArchivo = rutaArchivo ?? '${Directory.systemTemp.path}/licoreria_offline_sqlite.json';

  final bool persistirEnDisco;
  final String _rutaArchivo;

  final Map<String, ProductoLocal> _productos = {};
  final Map<String, StockLocal> _stocks = {};
  final Map<String, String> _syncInfo = {};
  String _esquemaSql = '';
  bool _inicializada = false;

  bool get inicializada => _inicializada;
  String get esquemaSql => _esquemaSql;

  static const List<ProductoLocal> _semillasProductos = [
    ProductoLocal(
      codigo: 'CER-001',
      nombre: 'Cerveza Paceña 620 ml',
      marca: 'CBN',
      tipo: 'CERVEZA',
      precio: 15.0,
      etiquetaModelo: 'pacena_620',
    ),
    ProductoLocal(
      codigo: 'CER-003',
      nombre: 'Cerveza Huari 620 ml',
      marca: 'CBN',
      tipo: 'CERVEZA',
      precio: 17.0,
      etiquetaModelo: 'huari_620',
    ),
    ProductoLocal(
      codigo: 'SIN-001',
      nombre: 'Singani Casa Real Etiqueta Negra 750 ml',
      marca: 'Casa Real',
      tipo: 'SINGANI',
      precio: 85.0,
      etiquetaModelo: 'casareal_negra',
    ),
    ProductoLocal(
      codigo: 'WHI-001',
      nombre: 'Whisky Johnnie Walker Red Label 750 ml',
      marca: 'Johnnie Walker',
      tipo: 'WHISKY',
      precio: 165.0,
      etiquetaModelo: 'jw_red',
    ),
    ProductoLocal(
      codigo: 'VOD-001',
      nombre: 'Vodka Absolut 750 ml',
      marca: 'Absolut',
      tipo: 'VODKA',
      precio: 130.0,
      etiquetaModelo: 'absolut_750',
    ),
  ];

  static const Map<String, int> _semillasStock = {
    'CER-001': 48,
    'CER-003': 36,
    'SIN-001': 24,
    'WHI-001': 15,
    'VOD-001': 20,
  };

  /// Inicializa el esquema `lib/db/esquema.sql`, carga datos persistidos o siembra el catálogo base para modo avión.
  Future<void> inicializar() async {
    if (_inicializada) return;

    try {
      _esquemaSql = await rootBundle.loadString('lib/db/esquema.sql');
    } catch (_) {
      _esquemaSql = 'CREATE TABLE producto (...); CREATE TABLE stock (...); CREATE TABLE sync_info (...);';
    }

    var cargadoDeDisco = false;
    if (persistirEnDisco) {
      try {
        final archivo = File(_rutaArchivo);
        if (await archivo.exists()) {
          final mapa = jsonDecode(await archivo.readAsString()) as Map<String, dynamic>;
          final listaProd = (mapa['producto'] as List<dynamic>? ?? []);
          final listaStock = (mapa['stock'] as List<dynamic>? ?? []);
          final mapaSync = (mapa['sync_info'] as Map<String, dynamic>? ?? {});
          for (final item in listaProd) {
            final p = ProductoLocal.desdeJson(item as Map<String, dynamic>);
            _productos[p.codigo] = p;
          }
          for (final item in listaStock) {
            final s = StockLocal.desdeJson(item as Map<String, dynamic>);
            _stocks[s.productoCodigo] = s;
          }
          mapaSync.forEach((k, v) => _syncInfo[k] = '$v');
          cargadoDeDisco = _productos.isNotEmpty;
        }
      } catch (_) {
        cargadoDeDisco = false;
      }
    }

    if (!cargadoDeDisco) {
      _cargarSemillas();
      await _persistir();
    }

    _inicializada = true;
  }

  void _cargarSemillas() {
    final ahora = '2026-11-01T16:39:14Z';
    for (final p in _semillasProductos) {
      _productos[p.codigo] = p;
      _stocks[p.codigo] = StockLocal(
        productoCodigo: p.codigo,
        cantidad: _semillasStock[p.codigo] ?? 10,
        actualizadoEn: ahora,
      );
    }
    _syncInfo['version_modelo'] = '20261101-163914';
    _syncInfo['ultima_sync'] = ahora;
  }

  Future<void> _persistir() async {
    if (!persistirEnDisco) return;
    try {
      final archivo = File(_rutaArchivo);
      final datos = {
        'producto': _productos.values.map((p) => p.aJson()).toList(),
        'stock': _stocks.values.map((s) => s.aJson()).toList(),
        'sync_info': _syncInfo,
      };
      await archivo.writeAsString(jsonEncode(datos));
    } catch (_) {
      // Ignorar errores de sistema de archivos en entornos restringidos
    }
  }

  /// Asegura que las semillas estén presentes de forma síncrona si aún no se llamó a `inicializar()`.
  void _asegurarDatos() {
    if (_productos.isEmpty) {
      _cargarSemillas();
    }
  }

  /// Lista `producto JOIN stock` filtrando por texto (código, nombre, marca) y tipo de bebida.
  List<ProductoConStock> listarProductos({String busqueda = '', String tipo = ''}) {
    _asegurarDatos();
    final q = busqueda.trim().toLowerCase();
    final t = tipo.trim().toUpperCase();

    final resultado = <ProductoConStock>[];
    for (final p in _productos.values) {
      if (t.isNotEmpty && p.tipo.toUpperCase() != t) continue;
      if (q.isNotEmpty) {
        final texto = '${p.codigo} ${p.nombre} ${p.marca ?? ''} ${p.etiquetaModelo}'.toLowerCase();
        if (!texto.contains(q)) continue;
      }
      final st = _stocks[p.codigo];
      resultado.add(
        ProductoConStock(
          producto: p,
          cantidad: st?.cantidad ?? 0,
          actualizadoEn: st?.actualizadoEn ?? '',
        ),
      );
    }
    resultado.sort((a, b) => a.producto.codigo.compareTo(b.producto.codigo));
    return resultado;
  }

  List<String> tiposDisponibles() {
    _asegurarDatos();
    final tipos = _productos.values.map((p) => p.tipo.toUpperCase()).toSet().toList()..sort();
    return tipos;
  }

  ProductoConStock? buscarPorCodigo(String codigo) {
    _asegurarDatos();
    final p = _productos[codigo];
    if (p == null) return null;
    final st = _stocks[codigo];
    return ProductoConStock(
      producto: p,
      cantidad: st?.cantidad ?? 0,
      actualizadoEn: st?.actualizadoEn ?? '',
    );
  }

  /// Busca un producto y su stock local a partir de la clase predicha por el modelo TFLite.
  ProductoConStock? buscarPorEtiqueta(String etiqueta) {
    _asegurarDatos();
    for (final p in _productos.values) {
      if (p.etiquetaModelo == etiqueta) {
        final st = _stocks[p.codigo];
        return ProductoConStock(
          producto: p,
          cantidad: st?.cantidad ?? 0,
          actualizadoEn: st?.actualizadoEn ?? '',
        );
      }
    }
    final codigo = mapaEtiquetaACodigo[etiqueta];
    return codigo != null ? buscarPorCodigo(codigo) : null;
  }

  /// Reemplaza/actualiza el catálogo y stock local al sincronizar con `ms-inventario`.
  Future<void> guardarCatalogoYStock(
    List<ProductoLocal> productos,
    List<StockLocal> stocks, {
    String? versionModelo,
  }) async {
    _asegurarDatos();
    final ahora = DateTime.now().toUtc().toIso8601String();
    for (final p in productos) {
      final etiqueta = p.etiquetaModelo.isNotEmpty ? p.etiquetaModelo : (mapaCodigoAEtiqueta[p.codigo] ?? '');
      _productos[p.codigo] = ProductoLocal(
        codigo: p.codigo,
        nombre: p.nombre,
        marca: p.marca,
        tipo: p.tipo,
        precio: p.precio,
        etiquetaModelo: etiqueta,
      );
    }
    for (final s in stocks) {
      _stocks[s.productoCodigo] = s;
    }
    _syncInfo['ultima_sync'] = ahora;
    if (versionModelo != null && versionModelo.isNotEmpty) {
      _syncInfo['version_modelo'] = versionModelo;
    }
    await _persistir();
  }

  String? obtenerSyncInfo(String clave) {
    _asegurarDatos();
    return _syncInfo[clave];
  }

  Future<void> guardarSyncInfo(String clave, String valor) async {
    _asegurarDatos();
    _syncInfo[clave] = valor;
    await _persistir();
  }
}

