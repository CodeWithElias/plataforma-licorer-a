import 'package:flutter/material.dart';

import '../servicios/api.dart';
import '../servicios/sesion.dart';
import 'camara_page.dart';

class InicioPage extends StatelessWidget {
  const InicioPage({super.key, required this.sesion, required this.api, required this.alCerrar});

  final Sesion sesion;
  final Api api;
  final VoidCallback alCerrar;

  @override
  Widget build(BuildContext context) {
    final roles = sesion.roles.where((r) => const ['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN'].contains(r)).join(', ');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Licorería'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await sesion.cerrar();
              alCerrar();
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(leading: const Icon(Icons.person), title: Text(sesion.usuario), subtitle: Text(roles.isEmpty ? 'Sin rol' : roles)),
          const SizedBox(height: 8),
          Card(
            child: ListTile(
              leading: const Icon(Icons.qr_code_scanner),
              title: const Text('Escanear producto'),
              subtitle: const Text('Reconoce la botella con la cámara'),
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CamaraPage(api: api))),
            ),
          ),
          const Card(
            child: ListTile(
              enabled: false,
              leading: Icon(Icons.inventory_2),
              title: Text('Catálogo y stock sin conexión'),
              subtitle: Text('Semana 3: SQLite + modelo TFLite en el teléfono'),
            ),
          ),
        ],
      ),
    );
  }
}
