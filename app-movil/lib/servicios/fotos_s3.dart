import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import '../db/base_local.dart';
import 'firma_aws.dart';
import 'sesion.dart';

/// Sube a Amazon S3 las fotos que se analizan con el modelo, directo desde el teléfono (sin pasar por los
/// microservicios).
///
/// Credenciales: Cognito Identity Pool recibe el id_token de Keycloak y devuelve credenciales temporales de AWS
/// cuyo rol solo permite `s3:PutObject` en `fotos/*`. La app no lleva ninguna llave de AWS.
///
/// Sin internet la foto queda en una cola local (archivo + fila en SQLite) y se sube después: al analizar la
/// siguiente foto o en la tarea de segundo plano. El análisis nunca espera a la subida.
class FotosS3 {
  FotosS3(this.sesion, this.baseLocal, {http.Client? cliente}) : _http = cliente ?? http.Client();

  final Sesion sesion;
  final BaseLocal baseLocal;
  final http.Client _http;
  CredencialesAws? _credenciales;

  /// Tope de la cola: si el teléfono pasa mucho tiempo sin internet no se llena su almacenamiento.
  static const maxPendientes = 200;
  static bool _subiendo = false;

  /// Guarda la foto en la cola local. No usa la red.
  Future<void> encolar(List<int> jpg, {required String etiqueta, required double confianza}) async {
    if (!Config.subirFotos) return;
    if (await baseLocal.contarFotosPendientes() >= maxPendientes) return;

    final id = _nuevoId();
    final carpeta = Directory(p.join((await getApplicationSupportDirectory()).path, 'fotos_pendientes'));
    await carpeta.create(recursive: true);
    final archivo = File(p.join(carpeta.path, '$id.jpg'));
    await archivo.writeAsBytes(jpg, flush: true);

    await baseLocal.encolarFoto(FotoPendiente(
      id: id,
      archivo: archivo.path,
      etiqueta: etiqueta,
      confianza: confianza,
      usuario: sesion.usuario.isEmpty ? 'desconocido' : sesion.usuario,
      creadaEn: DateTime.now(),
    ));
  }

  /// Sube lo que haya en la cola. Se detiene al primer error (lo normal es que no haya internet) y lo que
  /// falte queda para el próximo intento. Devuelve cuántas fotos subió.
  Future<int> subirPendientes() async {
    if (!Config.subirFotos || !sesion.iniciada || _subiendo) return 0;
    _subiendo = true;
    var subidas = 0;
    try {
      for (final foto in await baseLocal.fotosPendientes()) {
        final archivo = File(foto.archivo);
        if (!await archivo.exists()) {
          await baseLocal.quitarFoto(foto.id);   // el sistema borró el archivo: no hay nada que subir
          continue;
        }
        await _subir(foto, await archivo.readAsBytes());
        await baseLocal.quitarFoto(foto.id);
        await archivo.delete();
        subidas++;
        debugPrint('FotosS3: subida ${claveS3(foto)}');
      }
    } catch (e) {
      // Sin internet o credenciales rechazadas: se reintenta después. Se ve con: adb logcat | findstr FotosS3
      debugPrint('FotosS3: no se pudo subir ($subidas subidas): $e');
    } finally {
      _subiendo = false;
    }
    return subidas;
  }

  /// fotos/2026-11-10/almacen1/20261110T153012Z-a1b2c3d4.jpg
  static String claveS3(FotoPendiente f) {
    final dia = f.creadaEn.toUtc().toIso8601String().substring(0, 10);
    return 'fotos/$dia/${_seguro(f.usuario)}/${f.id}.jpg';
  }

  Future<void> _subir(FotoPendiente foto, List<int> jpg) async {
    final cred = await _credencialesVigentes();
    final host = '${Config.s3Bucket}.s3.${Config.awsRegion}.amazonaws.com';
    final ruta = '/${claveS3(foto)}';
    final ahora = DateTime.now();
    final hash = sha256Hex(jpg);

    final cabeceras = <String, String>{
      'host': host,
      'content-type': 'image/jpeg',
      'x-amz-content-sha256': hash,
      'x-amz-date': fechaAmz(ahora),
      'x-amz-security-token': ?cred.sessionToken,
      // Lo que predijo el modelo, para revisar y reentrenar
      'x-amz-meta-etiqueta': _seguro(foto.etiqueta),
      'x-amz-meta-confianza': foto.confianza.toStringAsFixed(4),
      'x-amz-meta-usuario': _seguro(foto.usuario),
      'x-amz-meta-creada-en': foto.creadaEn.toUtc().toIso8601String(),
    };
    cabeceras['authorization'] = firmarSigV4(
      metodo: 'PUT',
      ruta: ruta,
      cabeceras: cabeceras,
      hashCuerpo: hash,
      credenciales: cred,
      region: Config.awsRegion,
      servicio: 's3',
      fecha: ahora,
    );

    final r = await _http
        .put(Uri.https(host, ruta), headers: cabeceras..remove('host'), body: jpg)
        .timeout(const Duration(seconds: 60));
    if (r.statusCode == 403) _credenciales = null;   // pudieron vencer: se piden otras en el próximo intento
    if (r.statusCode != 200) throw HttpException('S3 respondió ${r.statusCode}: ${r.body}');
  }

  /// Credenciales temporales de Cognito a cambio del id_token de Keycloak (flujo "enhanced" del Identity Pool).
  Future<CredencialesAws> _credencialesVigentes() async {
    final actuales = _credenciales;
    if (actuales != null && actuales.vigentes) return actuales;

    await sesion.token();   // si el token venció lo renueva, y con él el id_token
    final idToken = sesion.idToken ?? (throw StateError('La sesión no tiene id_token'));
    final logins = {Config.proveedorOidc: idToken};

    final id = await _cognito('GetId', {'IdentityPoolId': Config.cognitoIdentityPoolId, 'Logins': logins});
    final r = await _cognito('GetCredentialsForIdentity', {'IdentityId': id['IdentityId'], 'Logins': logins});
    final c = r['Credentials'] as Map<String, dynamic>;
    return _credenciales = CredencialesAws(
      accessKeyId: c['AccessKeyId'] as String,
      secretKey: c['SecretKey'] as String,
      sessionToken: c['SessionToken'] as String?,
      expiran: DateTime.fromMillisecondsSinceEpoch(((c['Expiration'] as num) * 1000).toInt()),
    );
  }

  /// Las llamadas a Cognito Identity para obtener credenciales no van firmadas: se autentican con el token.
  Future<Map<String, dynamic>> _cognito(String accion, Map<String, Object?> cuerpo) async {
    final r = await _http
        .post(
          Uri.https('cognito-identity.${Config.awsRegion}.amazonaws.com', '/'),
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityService.$accion',
          },
          body: jsonEncode(cuerpo),
        )
        .timeout(const Duration(seconds: 15));
    if (r.statusCode != 200) throw HttpException('Cognito $accion respondió ${r.statusCode}: ${r.body}');
    return jsonDecode(r.body) as Map<String, dynamic>;
  }

  /// Solo letras, números, `-`, `_` y `.`: así la clave de S3 y los metadatos no necesitan codificación.
  static String _seguro(String texto) => texto.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');

  static String _nuevoId() {
    final azar = Random.secure();
    final sufijo = List.generate(4, (_) => azar.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    return '${fechaAmz(DateTime.now())}-$sufijo';
  }
}
