import 'package:flutter/widgets.dart';
import 'package:workmanager/workmanager.dart';

import '../config.dart';
import 'api.dart';
import 'avisos_stock.dart';
import 'sesion.dart';

/// En segundo plano, aunque la app esté cerrada: sube a S3 las fotos que quedaron pendientes, descarga el
/// modelo nuevo si ms-ia publicó otro, sincroniza el stock y avisa lo que cambió.
///
/// Android no permite repetir una tarea más seguido que cada 15 minutos, y en ahorro de batería puede
/// retrasarla. Solo corre con internet y con sesión; el stock solo con rol GERENTE/ALMACEN.
class SincronizacionPeriodica {
  static const _nombre = 'sincronizar-stock';

  static Future<void> programar() async {
    await Workmanager().initialize(tareaEnSegundoPlano);
    await Workmanager().registerPeriodicTask(
      _nombre,
      _nombre,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(networkType: NetworkType.connected),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }
}

/// Punto de entrada de Android WorkManager: corre en un isolate aparte, sin la app en pantalla.
@pragma('vm:entry-point')
void tareaEnSegundoPlano() {
  Workmanager().executeTask((tarea, datos) async {
    try {
      WidgetsFlutterBinding.ensureInitialized();
      await Config.cargar();
      final sesion = Sesion();
      await sesion.restaurar();
      if (!sesion.iniciada) return true;

      final api = Api(sesion);
      await api.fotos.subirPendientes();   // fotos analizadas sin internet (cualquier rol)
      if (sesion.puedeVerStock) {
        final resultado = await api.sincronizarDatosOffline();   // incluye el modelo
        await AvisosStock().avisar(resultado.cambios);
      } else {
        await api.actualizarModelo();   // el cajero no sincroniza stock, pero sí usa el modelo
      }
      return true;
    } catch (_) {
      return true;   // se reintenta en el siguiente ciclo, no con el reintento inmediato de WorkManager
    }
  });
}
