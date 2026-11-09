import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:app_movil/config.dart';
import 'package:app_movil/db/base_local.dart';
import 'package:app_movil/main.dart';
import 'package:app_movil/pantallas/catalogo_offline_page.dart';
import 'package:app_movil/servicios/api.dart';
import 'package:app_movil/servicios/clasificador_local.dart';
import 'package:app_movil/servicios/sesion.dart';

/// Motor de prueba: recuerda lo que recibió y responde lo que se le indique, sin cargar la librería nativa de TFLite.
class _MotorFalso implements MotorModelo {
  _MotorFalso(this.salida);

  final List<double> salida;
  Float32List? recibido;

  @override
  List<double> ejecutar(Float32List rgb, int ancho, int alto) {
    recibido = rgb;
    return salida;
  }
}

/// SQLite real en memoria, con una base nueva en cada prueba. Sin isolate para que funcione dentro de testWidgets.
BaseLocal _baseDePrueba() => BaseLocal(fabrica: databaseFactoryFfiNoIsolate, ruta: inMemoryDatabasePath);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();

  testWidgets('sin sesión muestra la pantalla de login', (WidgetTester tester) async {
    await tester.pumpWidget(LicoreriaApp(sesion: Sesion()));

    expect(find.text('Licorería'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });

  test('Config lee el .env ignorando comentarios y líneas vacías', () {
    final v = Config.leerEnv('# comentario\r\n\nAPI_URL=http://192.168.1.35\nKEYCLOAK_REALM = licoreria\nSIN_IGUAL\n=x\nVACIA=\n');

    expect(v, {'API_URL': 'http://192.168.1.35', 'KEYCLOAK_REALM': 'licoreria', 'VACIA': ''});
  });

  test('lee usuario y roles del token', () {
    final payload = base64Url.encode(utf8.encode(jsonEncode({
      'preferred_username': 'almacen01',
      'realm_access': {'roles': ['ALMACEN']},
    }))).replaceAll('=', '');
    final claims = Sesion.claimsDe('x.$payload.y');
    expect(claims['preferred_username'], 'almacen01');
    expect((claims['realm_access'] as Map)['roles'], ['ALMACEN']);
  });

  test('BaseLocal consulta catálogo y stock en SQLite sin conexión (CU04 / R07)', () async {
    final base = _baseDePrueba();
    addTearDown(base.cerrar);

    expect((await base.listarProductos()).length, 5);

    final pacena = await base.buscarPorEtiqueta('pacena_620');
    expect(pacena!.producto.codigo, 'CER-001');
    expect(pacena.producto.precio, 12.0);   // igual al catálogo de ms-inventario
    expect(pacena.cantidad, 48);

    expect((await base.listarProductos(tipo: 'CERVEZA')).length, 2);
    expect((await base.listarProductos(busqueda: 'PACEÑA')).single.producto.codigo, 'CER-001');
    expect(await base.listarProductos(busqueda: 'no existe'), isEmpty);
    expect(await base.tiposDisponibles(), ['CERVEZA', 'SINGANI', 'VODKA', 'WHISKY']);
  });

  test('sincronizar actualiza SQLite y el JSON de ms-inventario conserva la etiqueta', () async {
    final base = _baseDePrueba();
    addTearDown(base.cerrar);

    final nuevo = ProductoLocal.desdeJson({'codigo': 'RON-002', 'nombre': 'Ron Abuelo', 'tipo': 'RON', 'precio': 130, 'etiquetaModelo': 'abuelo_anejo'});
    final stock = StockLocal.desdeJson({'productoCodigo': 'RON-002', 'cantidad': 9});
    await base.guardarCatalogoYStock([nuevo], [stock, StockLocal.desdeJson({'productoCodigo': 'NO-EXISTE', 'cantidad': 1})], versionModelo: 'v2');

    expect((await base.buscarPorEtiqueta('abuelo_anejo'))!.cantidad, 9);
    expect(await base.buscarPorCodigo('NO-EXISTE'), isNull);
    expect((await base.listarProductos()).length, 6);
    expect(await base.obtenerSyncInfo('version_modelo'), 'v2');
    expect(await base.obtenerSyncInfo('ultima_sync'), isNotNull);
  });

  test('ClasificadorLocal usa la salida del modelo y la cruza con el catálogo local (CU04 / R05)', () async {
    final base = _baseDePrueba();
    addTearDown(base.cerrar);
    final motor = _MotorFalso([0.01, 0.02, 0.03, 0.04, 0.90]);
    final clasificador = ClasificadorLocal(baseLocal: base, motor: motor);

    final pred = await clasificador.clasificarRgba([10, 20, 30, 255, 40, 50, 60, 255], 2, 1);

    expect(pred.etiqueta, 'pacena_620');
    expect(pred.productoCodigo, 'CER-001');
    expect(pred.confianza, 0.9);
    expect(pred.modoOffline, isTrue);
    expect(pred.stockDisponible, greaterThan(0));
    expect(motor.recibido, [10, 20, 30, 40, 50, 60]);   // píxeles RGB de 0 a 255, sin alfa
  });

  test('sin modelo cargado avisa en lugar de inventar un resultado', () async {
    final clasificador = ClasificadorLocal(baseLocal: _baseDePrueba());

    expect(clasificador.clasificarRgba([0, 0, 0, 255], 1, 1), throwsA(isA<ErrorApi>()));
  });

  testWidgets('CatalogoOfflinePage muestra productos y stock en modo avión', (WidgetTester tester) async {
    final base = _baseDePrueba();
    final api = Api(
      Sesion(),
      baseLocal: base,
      clasificadorLocal: ClasificadorLocal(baseLocal: base),
    );

    await tester.pumpWidget(MaterialApp(home: CatalogoOfflinePage(api: api)));
    // SQLite responde fuera del reloj simulado de testWidgets
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await tester.pump();

    expect(find.text('Catálogo y stock sin conexión'), findsOneWidget);
    expect(find.text('Cerveza Paceña 620 ml'), findsOneWidget);
    expect(find.text('Stock: 48'), findsOneWidget);
  });
}
