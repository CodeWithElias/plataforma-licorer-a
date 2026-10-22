import 'package:flutter/material.dart';

// URLs del sistema. Se pasan al compilar/ejecutar:
//   flutter run --dart-define=API_URL=http://192.168.1.10
const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2');
const keycloakRealm = String.fromEnvironment('KEYCLOAK_REALM', defaultValue: 'licoreria');
const keycloakClientId = String.fromEnvironment('KEYCLOAK_CLIENT_ID', defaultValue: 'app-movil');

void main() {
  runApp(const LicoreriaApp());
}

class LicoreriaApp extends StatelessWidget {
  const LicoreriaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Licorería',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7A1F2B)),
      ),
      home: const InicioPage(),
    );
  }
}

// Pantalla inicial. Aquí van login (flutter_appauth), cámara con TFLite y catálogo offline (CU04).
class InicioPage extends StatelessWidget {
  const InicioPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Licorería'),
        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.qr_code_scanner, size: 64),
              SizedBox(height: 16),
              Text('App móvil', style: TextStyle(fontSize: 22)),
              SizedBox(height: 8),
              Text('Servidor: $apiUrl', textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
