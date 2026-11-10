import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'cambios_stock.dart';

/// Notificaciones locales (las genera la propia app, sin servidor de push) cuando cambia el stock.
///
/// Una sola notificación por sincronización, con un renglón por producto: si se vendieron 10 productos no
/// llegan 10 avisos. Cada nueva sincronización reemplaza a la anterior (mismo id).
class AvisosStock {
  AvisosStock({FlutterLocalNotificationsPlugin? plugin}) : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  bool _listo = false;

  static const _idNotificacion = 1001;
  static const _maxRenglones = 6;

  Future<void> inicializar() async {
    if (_listo) return;
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
    );
    _listo = true;
  }

  /// Android 13+ pide permiso para mostrar notificaciones. Solo se puede pedir con la app en pantalla.
  Future<void> pedirPermiso() async {
    await inicializar();
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  Future<void> avisar(List<CambioStock> cambios) async {
    if (cambios.isEmpty) return;
    await inicializar();

    final subidas = cambios.where((c) => c.subio).length;
    final bajadas = cambios.length - subidas;
    final titulo = cambios.length == 1
        ? (cambios.first.subio ? 'Subió el stock' : 'Bajó el stock')
        : 'Cambió el stock de ${cambios.length} productos';
    final resumen = [
      if (subidas > 0) '$subidas ${subidas == 1 ? 'subió' : 'subieron'}',
      if (bajadas > 0) '$bajadas ${bajadas == 1 ? 'bajó' : 'bajaron'}',
    ].join(' · ');

    final renglones = cambios.take(_maxRenglones).map((c) => c.texto).toList();
    if (cambios.length > _maxRenglones) renglones.add('y ${cambios.length - _maxRenglones} más…');

    await _plugin.show(
      id: _idNotificacion,
      title: titulo,
      body: cambios.length == 1 ? cambios.first.texto : resumen,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          'cambios_stock',
          'Cambios de stock',
          channelDescription: 'Avisa cuando sube o baja el stock de los productos',
          styleInformation: InboxStyleInformation(renglones, contentTitle: titulo, summaryText: resumen),
        ),
      ),
    );
  }
}
