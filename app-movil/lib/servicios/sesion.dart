import 'dart:convert';

import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

/// Sesión con Keycloak (cliente público app-movil, Authorization Code + PKCE, CU01).
/// Los endpoints se arman con API_URL en lugar de usar el discovery, así funcionan con la IP de la PC.
///
/// La sesión se guarda cifrada en el dispositivo: al volver a abrir la app no se pide login (que requiere
/// internet). Solo se borra al cerrar sesión. Se pide `offline_access` para que el refresh token no caduque
/// con la inactividad de la sesión web de Keycloak.
///
/// El token se renueva con un POST directo al endpoint de Keycloak (no con flutter_appauth) para que también
/// funcione en la tarea de segundo plano que sincroniza el stock, donde no hay pantalla.
class Sesion {
  Sesion({FlutterAppAuth? appAuth, FlutterSecureStorage? almacen, http.Client? cliente})
      : _appAuth = appAuth ?? const FlutterAppAuth(),
        _almacen = almacen ?? const FlutterSecureStorage(),
        _http = cliente ?? http.Client();

  final FlutterAppAuth _appAuth;
  final FlutterSecureStorage _almacen;
  final http.Client _http;
  static const _claves = (access: 'sesion_access', refresh: 'sesion_refresh', id: 'sesion_id', vence: 'sesion_vence');
  String? _accessToken;
  String? _refreshToken;
  String? _idToken;
  DateTime? _vence;
  Map<String, dynamic> _claims = const {};

  static final _servicio = AuthorizationServiceConfiguration(
    authorizationEndpoint: '${Config.keycloakBase}/auth',
    tokenEndpoint: '${Config.keycloakBase}/token',
    endSessionEndpoint: '${Config.keycloakBase}/logout',
  );

  bool get iniciada => _accessToken != null;

  /// id_token de Keycloak: Cognito lo cambia por credenciales temporales de AWS (fotos a S3).
  /// Llamar antes a [token] para que esté renovado.
  String? get idToken => _idToken;
  String get usuario => (_claims['preferred_username'] as String?) ?? '';
  List<String> get roles => List<String>.from((_claims['realm_access'] as Map?)?['roles'] ?? const []);

  /// GET /stock de ms-inventario exige uno de estos roles: sin él no se puede sincronizar el stock.
  bool get puedeVerStock => roles.any((r) => r == 'GERENTE' || r == 'ALMACEN');

  Future<void> iniciar() async {
    final r = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        Config.clientId,
        Config.redirectUri,
        serviceConfiguration: _servicio,
        scopes: const ['openid', 'profile', 'offline_access'],
        allowInsecureConnections: Config.apiUrl.startsWith('http://'),   // solo en la red local de desarrollo
      ),
    );
    _guardar(r.accessToken, r.refreshToken, r.idToken, r.accessTokenExpirationDateTime);
    await _persistir();
  }

  /// Recupera la sesión guardada al abrir la app. No usa la red: funciona sin internet.
  Future<void> restaurar() async {
    try {
      final access = await _almacen.read(key: _claves.access);
      if (access == null) return;
      final vence = await _almacen.read(key: _claves.vence);
      _guardar(
        access,
        await _almacen.read(key: _claves.refresh),
        await _almacen.read(key: _claves.id),
        vence == null ? null : DateTime.tryParse(vence),
      );
    } catch (_) {
      // Almacén ilegible (p. ej. se restauró un respaldo en otro equipo): se pide login otra vez
      await _olvidar();
    }
  }

  /// Token vigente; si vence en menos de 30 s lo renueva con el refresh token.
  Future<String> token() async {
    if (_accessToken == null) throw StateError('No hay sesión');
    if (_vence != null && DateTime.now().isAfter(_vence!.subtract(const Duration(seconds: 30))) && _refreshToken != null) {
      await _renovar();
    }
    return _accessToken!;
  }

  Future<void> _renovar() async {
    final r = await _http.post(
      Uri.parse('${Config.keycloakBase}/token'),
      body: {'grant_type': 'refresh_token', 'client_id': Config.clientId, 'refresh_token': _refreshToken!},
    ).timeout(const Duration(seconds: 15));
    if (r.statusCode != 200) {
      // 400 invalid_grant: el refresh token ya no sirve (sesión revocada en Keycloak)
      throw StateError('No se pudo renovar la sesión (${r.statusCode})');
    }
    final j = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>;
    final segundos = (j['expires_in'] as num?)?.toInt();
    _guardar(
      j['access_token'] as String,
      (j['refresh_token'] as String?) ?? _refreshToken,
      (j['id_token'] as String?) ?? _idToken,
      segundos == null ? null : DateTime.now().add(Duration(seconds: segundos)),
    );
    await _persistir();
  }

  Future<void> cerrar() async {
    if (_idToken != null) {
      try {
        await _appAuth.endSession(EndSessionRequest(
          idTokenHint: _idToken,
          postLogoutRedirectUrl: Config.redirectUri,
          serviceConfiguration: _servicio,
          allowInsecureConnections: Config.apiUrl.startsWith('http://'),
        ));
      } catch (_) {
        // Si Keycloak no responde, igual se olvida la sesión local
      }
    }
    await _olvidar();
  }

  Future<void> _persistir() async {
    await _almacen.write(key: _claves.access, value: _accessToken);
    await _almacen.write(key: _claves.refresh, value: _refreshToken);
    await _almacen.write(key: _claves.id, value: _idToken);
    await _almacen.write(key: _claves.vence, value: _vence?.toIso8601String());
  }

  Future<void> _olvidar() async {
    _accessToken = _refreshToken = _idToken = null;
    _vence = null;
    _claims = const {};
    try {
      await _almacen.deleteAll();
    } catch (_) {}
  }

  void _guardar(String? access, String? refresh, String? id, DateTime? vence) {
    _accessToken = access;
    _refreshToken = refresh;
    _idToken = id;
    _vence = vence;
    _claims = access == null ? const {} : claimsDe(access);
  }

  /// Lee el payload del JWT (sin verificar: la firma la validan los microservicios).
  static Map<String, dynamic> claimsDe(String jwt) {
    final partes = jwt.split('.');
    if (partes.length != 3) return const {};
    return jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(partes[1])))) as Map<String, dynamic>;
  }
}
