import 'package:flutter/services.dart' show rootBundle;

/// Configuración de la app. Sale de `app-movil/.env`, que viaja dentro de la app como asset, así basta con
/// `flutter run`. Un `--dart-define` tiene prioridad sobre el archivo.
class Config {
  static const _apiUrlDefinida = String.fromEnvironment('API_URL');
  static const _realmDefinido = String.fromEnvironment('KEYCLOAK_REALM');
  static const _clientIdDefinido = String.fromEnvironment('KEYCLOAK_CLIENT_ID');

  static Map<String, String> _archivo = const {};

  /// Lee `.env`. Se llama una vez al iniciar la app, antes de usar cualquier valor.
  static Future<void> cargar() async {
    try {
      _archivo = leerEnv(await rootBundle.loadString('.env'));
    } catch (_) {
      _archivo = const {};   // sin archivo se usan los valores por defecto
    }
  }

  /// Pares `CLAVE=valor` de un `.env`, sin comentarios ni líneas en blanco.
  static Map<String, String> leerEnv(String texto) {
    final valores = <String, String>{};
    for (final linea in texto.split(RegExp(r'\r?\n'))) {
      final limpia = linea.trim();
      final igual = limpia.indexOf('=');
      if (limpia.startsWith('#') || igual < 1) continue;
      valores[limpia.substring(0, igual).trim()] = limpia.substring(igual + 1).trim();
    }
    return valores;
  }

  static String _valor(String definido, String clave, String porDefecto) {
    if (definido.isNotEmpty) return definido;
    final delArchivo = _archivo[clave];
    return delArchivo == null || delArchivo.isEmpty ? porDefecto : delArchivo;
  }

  /// Nginx de la PC donde corre docker compose (emulador Android: http://10.0.2.2).
  static String get apiUrl => _valor(_apiUrlDefinida, 'API_URL', 'http://10.0.2.2');
  static String get realm => _valor(_realmDefinido, 'KEYCLOAK_REALM', 'licoreria');
  static String get clientId => _valor(_clientIdDefinido, 'KEYCLOAK_CLIENT_ID', 'app-movil');

  /// Debe coincidir con appAuthRedirectScheme (Android) y CFBundleURLSchemes (iOS).
  static const redirectUri = 'com.licoreria.app:/oauth2redirect';

  static String get keycloakBase => '$apiUrl/auth/realms/$realm/protocol/openid-connect';
}
