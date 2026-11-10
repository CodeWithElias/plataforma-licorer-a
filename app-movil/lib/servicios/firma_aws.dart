import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Credenciales temporales de AWS (las entrega Cognito; duran 1 hora).
class CredencialesAws {
  const CredencialesAws({required this.accessKeyId, required this.secretKey, this.sessionToken, this.expiran});

  final String accessKeyId;
  final String secretKey;
  final String? sessionToken;
  final DateTime? expiran;

  /// Con 5 minutos de margen, para no firmar con credenciales a punto de vencer.
  bool get vigentes => expiran == null || DateTime.now().isBefore(expiran!.subtract(const Duration(minutes: 5)));
}

String sha256Hex(List<int> datos) => sha256.convert(datos).toString();

List<int> _hmac(List<int> clave, String texto) => Hmac(sha256, clave).convert(utf8.encode(texto)).bytes;

String _fecha(DateTime t) =>
    '${t.year.toString().padLeft(4, '0')}${t.month.toString().padLeft(2, '0')}${t.day.toString().padLeft(2, '0')}';

/// 20130524T000000Z
String fechaAmz(DateTime t) {
  final u = t.toUtc();
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${_fecha(u)}T${dos(u.hour)}${dos(u.minute)}${dos(u.second)}Z';
}

/// Firma AWS Signature Version 4 (https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html).
///
/// [cabeceras] debe traer `host`, `x-amz-date` y `x-amz-content-sha256`; se firman todas. [ruta] ya debe venir
/// codificada (aquí solo se usan claves con letras, números, `-`, `_`, `.` y `/`). Devuelve la cabecera
/// `Authorization` completa.
String firmarSigV4({
  required String metodo,
  required String ruta,
  required Map<String, String> cabeceras,
  required String hashCuerpo,
  required CredencialesAws credenciales,
  required String region,
  required String servicio,
  required DateTime fecha,
}) {
  final normalizadas = {for (final e in cabeceras.entries) e.key.toLowerCase(): e.value.trim()};
  final nombres = normalizadas.keys.toList()..sort();
  final firmadas = nombres.join(';');
  final canonicas = nombres.map((n) => '$n:${normalizadas[n]}\n').join();

  final solicitudCanonica = [metodo, ruta, '', canonicas, firmadas, hashCuerpo].join('\n');
  final alcance = '${_fecha(fecha.toUtc())}/$region/$servicio/aws4_request';
  final textoAFirmar = ['AWS4-HMAC-SHA256', fechaAmz(fecha), alcance, sha256Hex(utf8.encode(solicitudCanonica))].join('\n');

  var clave = _hmac(utf8.encode('AWS4${credenciales.secretKey}'), _fecha(fecha.toUtc()));
  clave = _hmac(clave, region);
  clave = _hmac(clave, servicio);
  clave = _hmac(clave, 'aws4_request');
  final firma = Hmac(sha256, clave).convert(utf8.encode(textoAFirmar)).toString();

  return 'AWS4-HMAC-SHA256 Credential=${credenciales.accessKeyId}/$alcance, SignedHeaders=$firmadas, Signature=$firma';
}
