import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../db/base_local.dart';
import 'clasificador_local.dart';
import 'sesion.dart';

/// Resultado de clasificación de producto (local con TFLite en el teléfono o vía ms-ia).
class Prediccion {
  Prediccion({
    required this.etiqueta,
    required this.confianza,
    this.productoCodigo,
    this.nombre,
    this.precio,
    this.stockDisponible,
    this.modelo,
    this.modoOffline = false,
  });

  final String etiqueta;
  final double confianza;
  final String? productoCodigo;
  final String? nombre;
  final double? precio;
  final int? stockDisponible;
  final String? modelo;
  final bool modoOffline;

  factory Prediccion.desdeJson(Map<String, dynamic> j, {BaseLocal? baseLocal}) {
    final etiqueta = j['etiqueta'] as String;
    final codigo = j['productoCodigo'] as String?;
    final itemLocal = codigo != null
        ? baseLocal?.buscarPorCodigo(codigo)
        : baseLocal?.buscarPorEtiqueta(etiqueta);
    return Prediccion(
      etiqueta: etiqueta,
      confianza: (j['confianza'] as num).toDouble(),
      productoCodigo: codigo ?? itemLocal?.producto.codigo,
      nombre: (j['nombre'] as String?) ?? itemLocal?.producto.nombre,
      precio: itemLocal?.producto.precio,
      stockDisponible: itemLocal?.cantidad,
      modelo: j['modelo'] as String?,
      modoOffline: false,
    );
  }
}

class ErrorApi implements Exception {
  ErrorApi(this.codigo, this.mensaje);
  final String codigo;
  final String mensaje;
  @override
  String toString() => mensaje;
}

class Api {
  Api(
    this.sesion, {
    http.Client? cliente,
    BaseLocal? baseLocal,
    ClasificadorLocal? clasificadorLocal,
  })  : _http = cliente ?? http.Client(),
        baseLocal = baseLocal ?? BaseLocal(),
        lateClasificador = clasificadorLocal;

  final Sesion sesion;
  final http.Client _http;
  final BaseLocal baseLocal;
  final ClasificadorLocal? lateClasificador;

  late final ClasificadorLocal clasificadorLocal =
      lateClasificador ?? ClasificadorLocal(baseLocal: baseLocal);

  /// Clasifica la foto en el propio teléfono con TFLite (Semana 3 / CU04 / R05).
  /// Funciona 100 % en modo avión cruzando la clase predicha con la base SQLite local.
  Future<Prediccion> clasificar(List<int> jpg, {bool preferirLocal = true}) async {
    await baseLocal.inicializar();
    await clasificadorLocal.inicializar();

    if (preferirLocal) {
      return clasificadorLocal.clasificarImagenBytes(jpg);
    }

    try {
      final pedido = http.MultipartRequest('POST', Uri.parse('${Config.apiUrl}/api/ia/imagen/clasificar'))
        ..headers['Authorization'] = 'Bearer ${await sesion.token()}'
        ..files.add(http.MultipartFile.fromBytes('imagen', jpg, filename: 'foto.jpg'));
      final r = await http.Response.fromStream(await _http.send(pedido));
      final cuerpo = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
      if (r.statusCode != 200) {
        throw ErrorApi(cuerpo['codigo'] as String? ?? 'ERROR', cuerpo['mensaje'] as String? ?? 'Error ${r.statusCode}');
      }
      return Prediccion.desdeJson(cuerpo, baseLocal: baseLocal);
    } catch (_) {
      // Fallback automático a inferencia TFLite en el dispositivo cuando no hay red (modo avión)
      return clasificadorLocal.clasificarImagenBytes(jpg);
    }
  }

  /// Sincroniza el catálogo (`GET /api/inventario/productos`), existencias (`GET /api/inventario/stock`)
  /// y versión vigente del modelo (`GET /api/ia/modelos/latest`) hacia la base local SQLite.
  /// Devuelve `true` si sincronizó con el servidor o `false` si operó en modo avión con datos locales.
  Future<bool> sincronizarDatosOffline() async {
    await baseLocal.inicializar();
    await clasificadorLocal.inicializar();
    try {
      final token = await sesion.token();
      final headers = <String, String>{
        if (token.isNotEmpty) 'Authorization': 'Bearer $token',
      };

      final respProductos = await _http
          .get(Uri.parse('${Config.apiUrl}/api/inventario/productos'), headers: headers)
          .timeout(const Duration(seconds: 4));
      final respStock = await _http
          .get(Uri.parse('${Config.apiUrl}/api/inventario/stock'), headers: headers)
          .timeout(const Duration(seconds: 4));

      if (respProductos.statusCode != 200 || respStock.statusCode != 200) {
        return false;
      }

      final listaProdJson = jsonDecode(utf8.decode(respProductos.bodyBytes)) as List<dynamic>;
      final listaStockJson = jsonDecode(utf8.decode(respStock.bodyBytes)) as List<dynamic>;

      final productos = listaProdJson
          .whereType<Map<String, dynamic>>()
          .map(ProductoLocal.desdeJson)
          .toList();
      final stocks = listaStockJson
          .whereType<Map<String, dynamic>>()
          .map(StockLocal.desdeJson)
          .toList();

      String? versionRemota;
      try {
        final respModelo = await _http
            .get(Uri.parse('${Config.apiUrl}/api/ia/modelos/latest'), headers: headers)
            .timeout(const Duration(seconds: 3));
        if (respModelo.statusCode == 200) {
          final info = jsonDecode(utf8.decode(respModelo.bodyBytes)) as Map<String, dynamic>;
          versionRemota = info['version'] as String?;
          final etiquetasRemotas = (info['etiquetas'] as List<dynamic>?)?.map((e) => '$e').toList();
          if (versionRemota != null) {
            await clasificadorLocal.actualizarMetadatos(version: versionRemota, etiquetas: etiquetasRemotas);
          }
        }
      } catch (_) {}

      await baseLocal.guardarCatalogoYStock(productos, stocks, versionModelo: versionRemota);
      return true;
    } catch (_) {
      return false;
    }
  }
}
