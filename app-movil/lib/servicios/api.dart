import 'dart:async';
import 'dart:convert';
import 'dart:io' show HttpException;

import 'package:http/http.dart' as http;

import '../config.dart';
import '../db/base_local.dart';
import 'cambios_stock.dart';
import 'clasificador_local.dart';
import 'fotos_s3.dart';
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

  static Future<Prediccion> desdeJson(Map<String, dynamic> j, {BaseLocal? baseLocal}) async {
    final etiqueta = j['etiqueta'] as String;
    final codigo = j['productoCodigo'] as String?;
    final itemLocal = codigo != null
        ? await baseLocal?.buscarPorCodigo(codigo)
        : await baseLocal?.buscarPorEtiqueta(etiqueta);
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
    final p = await _clasificar(jpg, preferirLocal: preferirLocal);
    await _guardarFoto(jpg, p);
    return p;
  }

  late final FotosS3 fotos = FotosS3(sesion, baseLocal, cliente: _http);

  /// Cada foto analizada va a la cola de S3; la subida corre aparte y nunca hace esperar ni falla el análisis.
  Future<void> _guardarFoto(List<int> jpg, Prediccion p) async {
    try {
      await fotos.encolar(jpg, etiqueta: p.etiqueta, confianza: p.confianza);
      unawaited(fotos.subirPendientes());
    } catch (_) {}
  }

  Future<Prediccion> _clasificar(List<int> jpg, {required bool preferirLocal}) async {
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
      return await Prediccion.desdeJson(cuerpo, baseLocal: baseLocal);
    } catch (_) {
      // Fallback automático a inferencia TFLite en el dispositivo cuando no hay red (modo avión)
      return clasificadorLocal.clasificarImagenBytes(jpg);
    }
  }

  /// Sincroniza el catálogo (`GET /api/inventario/productos`), existencias (`GET /api/inventario/stock`)
  /// y versión vigente del modelo (`GET /api/ia/modelos/latest`) hacia la base local SQLite.
  ///
  /// Todo o nada: si productos o stock no responden se siguen usando los datos locales (un catálogo sin su
  /// stock mostraría todo en 0). Devuelve si sincronizó y qué productos cambiaron de stock.
  Future<ResultadoSincronizacion> sincronizarDatosOffline() async {
    await baseLocal.inicializar();
    await clasificadorLocal.inicializar();
    try {
      final token = await sesion.token();
      final headers = <String, String>{
        if (token.isNotEmpty) 'Authorization': 'Bearer $token',
      };

      // En paralelo y con margen: cada llamada cruza gateway (Azure) → ms-inventario (AWS) → DynamoDB
      final respuestas = await Future.wait([
        _http.get(Uri.parse('${Config.apiUrl}/api/inventario/productos'), headers: headers),
        _http.get(Uri.parse('${Config.apiUrl}/api/inventario/stock'), headers: headers),
      ]).timeout(const Duration(seconds: 15));
      final respProductos = respuestas[0];
      final respStock = respuestas[1];

      if (respProductos.statusCode != 200 || respStock.statusCode != 200) {
        return ResultadoSincronizacion.sinConexion;
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

      // Se compara contra lo que había antes de guardar. La primera sincronización no avisa: lo anterior eran
      // las semillas de ejemplo, no el stock real.
      final yaSincronizo = await baseLocal.obtenerSyncInfo('ultima_sync') != null;
      final antes = await baseLocal.stockPorCodigo();
      await baseLocal.guardarCatalogoYStock(productos, stocks);

      final cambios = yaSincronizo
          ? calcularCambios(
              antes: antes,
              ahora: {for (final s in stocks) s.productoCodigo: s.cantidad},
              nombres: {for (final p in productos) p.codigo: p.nombre},
            )
          : const <CambioStock>[];
      return ResultadoSincronizacion(conectado: true, cambios: cambios);
    } catch (_) {
      return ResultadoSincronizacion.sinConexion;
    } finally {
      await actualizarModelo();   // aparte: un cajero no puede leer el stock, pero sí necesita el modelo al día
    }
  }

  /// Mantiene al día el modelo del teléfono: pregunta a ms-ia cuál es el vigente y, si es otro, lo descarga.
  /// Sirve para cualquier rol. Sin internet o si algo falla, sigue el modelo actual. true si cambió.
  Future<bool> actualizarModelo() async {
    try {
      await clasificadorLocal.inicializar();
      final headers = {'Authorization': 'Bearer ${await sesion.token()}'};
      final r = await _http
          .get(Uri.parse('${Config.apiUrl}/api/ia/modelos/latest'), headers: headers)
          .timeout(const Duration(seconds: 10));
      if (r.statusCode != 200) return false;
      final version = (jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>)['version'] as String?;
      if (version == null) return false;

      return await clasificadorLocal.actualizarModelo(
        version: version,
        // La URL se arma con el dominio público: la que trae /latest puede ser la interna de ms-ia
        descargar: (v, archivo) async {
          final d = await _http
              .get(Uri.parse('${Config.apiUrl}/api/ia/modelos/$v/$archivo'),
                  headers: {'Authorization': 'Bearer ${await sesion.token()}'})
              .timeout(const Duration(minutes: 3));
          if (d.statusCode != 200) throw HttpException('$archivo respondió ${d.statusCode}');
          return d.bodyBytes;
        },
      );
    } catch (_) {
      return false;
    }
  }
}

class ResultadoSincronizacion {
  const ResultadoSincronizacion({required this.conectado, this.cambios = const []});

  static const sinConexion = ResultadoSincronizacion(conectado: false);

  /// false: no se pudo hablar con el servidor y se siguen mostrando los datos locales
  final bool conectado;
  final List<CambioStock> cambios;
}
