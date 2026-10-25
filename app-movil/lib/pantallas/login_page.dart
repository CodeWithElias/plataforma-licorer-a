import 'package:flutter/material.dart';

import '../config.dart';
import '../servicios/sesion.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.sesion, required this.alIniciar});

  final Sesion sesion;
  final VoidCallback alIniciar;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  bool _cargando = false;
  String? _error;

  Future<void> _iniciar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      await widget.sesion.iniciar();
      widget.alIniciar();
    } catch (e) {
      setState(() => _error = 'No se pudo iniciar sesión: $e');
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.local_bar, size: 72, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 12),
              const Text('Licorería', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600)),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: _cargando ? null : _iniciar,
                icon: const Icon(Icons.login),
                label: Text(_cargando ? 'Abriendo…' : 'Iniciar sesión'),
              ),
              const SizedBox(height: 12),
              Text('Servidor: ${Config.apiUrl}', style: Theme.of(context).textTheme.bodySmall),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error), textAlign: TextAlign.center),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
