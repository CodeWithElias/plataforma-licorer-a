import 'dart:convert';

import 'package:flutter_appauth/flutter_appauth.dart';

import '../config.dart';

/// Sesión con Keycloak (cliente público app-movil, Authorization Code + PKCE, CU01).
/// Los endpoints se arman con API_URL en lugar de usar el discovery, así funcionan con la IP de la PC.
class Sesion {
  Sesion({FlutterAppAuth? appAuth}) : _appAuth = appAuth ?? const FlutterAppAuth();

  final FlutterAppAuth _appAuth;
  String? _accessToken;
  String? _refreshToken;
  String? _idToken;
  DateTime? _vence;
  Map<String, dynamic> _claims = const {};

  static const _servicio = AuthorizationServiceConfiguration(
    authorizationEndpoint: '${Config.apiUrl}/auth/realms/${Config.realm}/protocol/openid-connect/auth',
    tokenEndpoint: '${Config.apiUrl}/auth/realms/${Config.realm}/protocol/openid-connect/token',
    endSessionEndpoint: '${Config.apiUrl}/auth/realms/${Config.realm}/protocol/openid-connect/logout',
  );

  bool get iniciada => _accessToken != null;
  String get usuario => (_claims['preferred_username'] as String?) ?? '';
  List<String> get roles => List<String>.from((_claims['realm_access'] as Map?)?['roles'] ?? const []);

  Future<void> iniciar() async {
    final r = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        Config.clientId,
        Config.redirectUri,
        serviceConfiguration: _servicio,
        scopes: const ['openid', 'profile'],
        allowInsecureConnections: Config.apiUrl.startsWith('http://'),   // solo en la red local de desarrollo
      ),
    );
    _guardar(r.accessToken, r.refreshToken, r.idToken, r.accessTokenExpirationDateTime);
  }

  /// Token vigente; si vence en menos de 30 s lo renueva con el refresh token.
  Future<String> token() async {
    if (_accessToken == null) throw StateError('No hay sesión');
    if (_vence != null && DateTime.now().isAfter(_vence!.subtract(const Duration(seconds: 30))) && _refreshToken != null) {
      final r = await _appAuth.token(TokenRequest(
        Config.clientId,
        Config.redirectUri,
        serviceConfiguration: _servicio,
        refreshToken: _refreshToken,
        allowInsecureConnections: Config.apiUrl.startsWith('http://'),
      ));
      _guardar(r.accessToken, r.refreshToken ?? _refreshToken, r.idToken ?? _idToken, r.accessTokenExpirationDateTime);
    }
    return _accessToken!;
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
    _accessToken = _refreshToken = _idToken = null;
    _claims = const {};
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
