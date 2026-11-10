import 'package:flutter/material.dart';

import 'config.dart';
import 'pantallas/inicio_page.dart';
import 'pantallas/login_page.dart';
import 'servicios/api.dart';
import 'servicios/avisos_stock.dart';
import 'servicios/sesion.dart';
import 'servicios/sincronizacion_periodica.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Config.cargar();
  final sesion = Sesion();
  await sesion.restaurar();   // si ya había iniciado sesión antes, entra directo (sin internet)
  try {
    await SincronizacionPeriodica.programar();   // revisa el stock cada 15 min aunque la app esté cerrada
  } catch (_) {
    // Sin WorkManager la app funciona igual; solo no avisa con la app cerrada
  }
  runApp(LicoreriaApp(sesion: sesion));
}

class LicoreriaApp extends StatefulWidget {
  const LicoreriaApp({super.key, required this.sesion});

  final Sesion sesion;

  @override
  State<LicoreriaApp> createState() => _LicoreriaAppState();
}

class _LicoreriaAppState extends State<LicoreriaApp> {
  late final Api _api = Api(widget.sesion);
  final _avisos = AvisosStock();

  @override
  void initState() {
    super.initState();
    if (widget.sesion.iniciada) {
      _pedirPermisoDeAvisos();
      _api.actualizarModelo();   // sin esperar: si ms-ia publicó otro modelo, se descarga en segundo plano
    }
  }

  /// Solo a quien puede ver el stock: a un cajero no le llegarían avisos.
  void _pedirPermisoDeAvisos() {
    if (widget.sesion.puedeVerStock) _avisos.pedirPermiso().catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Licorería',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF7A1F2B))),
      home: widget.sesion.iniciada
          ? InicioPage(sesion: widget.sesion, api: _api, avisos: _avisos, alCerrar: () => setState(() {}))
          : LoginPage(
              sesion: widget.sesion,
              alIniciar: () {
                setState(() {});
                _pedirPermisoDeAvisos();
                _api.actualizarModelo();
              },
            ),
    );
  }
}
