import 'package:flutter/material.dart';

import 'config.dart';
import 'pantallas/inicio_page.dart';
import 'pantallas/login_page.dart';
import 'servicios/api.dart';
import 'servicios/sesion.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Config.cargar();
  runApp(LicoreriaApp(sesion: Sesion()));
}

class LicoreriaApp extends StatefulWidget {
  const LicoreriaApp({super.key, required this.sesion});

  final Sesion sesion;

  @override
  State<LicoreriaApp> createState() => _LicoreriaAppState();
}

class _LicoreriaAppState extends State<LicoreriaApp> {
  late final Api _api = Api(widget.sesion);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Licorería',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7A1F2B))),
      home: widget.sesion.iniciada
          ? InicioPage(sesion: widget.sesion, api: _api, alCerrar: () => setState(() {}))
          : LoginPage(sesion: widget.sesion, alIniciar: () => setState(() {})),
    );
  }
}
