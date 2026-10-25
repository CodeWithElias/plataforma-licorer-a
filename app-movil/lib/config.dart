/// Configuración de la app. Se pasa al ejecutar o compilar: flutter run --dart-define-from-file=.env
class Config {
  /// Nginx de la PC donde corre docker compose (emulador Android: http://10.0.2.2).
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2');
  static const realm = String.fromEnvironment('KEYCLOAK_REALM', defaultValue: 'licoreria');
  static const clientId = String.fromEnvironment('KEYCLOAK_CLIENT_ID', defaultValue: 'app-movil');

  /// Debe coincidir con appAuthRedirectScheme (Android) y CFBundleURLSchemes (iOS).
  static const redirectUri = 'com.licoreria.app:/oauth2redirect';

  static String get keycloakBase => '$apiUrl/auth/realms/$realm/protocol/openid-connect';
}
