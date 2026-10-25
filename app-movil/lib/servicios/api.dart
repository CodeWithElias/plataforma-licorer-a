import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import 'sesion.dart';

/// Resultado de POST /api/ia/imagen/clasificar (contrato: ms-ia/docs/openapi.yaml).
class Prediccion {
  Prediccion({required this.etiqueta, required this.confianza, this.productoCodigo, this.nombre});

  final String etiqueta;
  final double confianza;
  final String? productoCodigo;
  final String? nombre;

  factory Prediccion.desdeJson(Map<String, dynamic> j) => Prediccion(
        etiqueta: j['etiqueta'] as String,
        confianza: (j['confianza'] as num).toDouble(),
        productoCodigo: j['productoCodigo'] as String?,
        nombre: j['nombre'] as String?,
      );
}

class ErrorApi implements Exception {
  ErrorApi(this.codigo, this.mensaje);
  final String codigo;
  final String mensaje;
  @override
  String toString() => mensaje;
}

class Api {
  Api(this.sesion, {http.Client? cliente}) : _http = cliente ?? http.Client();

  final Sesion sesion;
  final http.Client _http;

  /// Envía la foto a ms-ia (semana 2). En la semana 3 la clasificación pasa a hacerse en el teléfono con TFLite.
  Future<Prediccion> clasificar(List<int> jpg) async {
    final pedido = http.MultipartRequest('POST', Uri.parse('${Config.apiUrl}/api/ia/imagen/clasificar'))
      ..headers['Authorization'] = 'Bearer ${await sesion.token()}'
      ..files.add(http.MultipartFile.fromBytes('imagen', jpg, filename: 'foto.jpg'));
    final r = await http.Response.fromStream(await _http.send(pedido));
    final cuerpo = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
    if (r.statusCode != 200) {
      throw ErrorApi(cuerpo['codigo'] as String? ?? 'ERROR', cuerpo['mensaje'] as String? ?? 'Error ${r.statusCode}');
    }
    return Prediccion.desdeJson(cuerpo);
  }
}
