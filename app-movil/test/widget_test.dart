import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_movil/db/base_local.dart';
import 'package:app_movil/main.dart';
import 'package:app_movil/pantallas/catalogo_offline_page.dart';
import 'package:app_movil/servicios/api.dart';
import 'package:app_movil/servicios/clasificador_local.dart';
import 'package:app_movil/servicios/sesion.dart';

List<int> _generarImagenSinteticaRgba(int rObj, int gObj, int bObj, {int tamano = 64}) {
  final rgba = List<int>.filled(tamano * tamano * 4, 255);
  final b0 = (tamano * 0.18).floor();
  final b1 = (tamano * 0.82).floor();
  for (var y = 0; y < tamano; y++) {
    for (var x = 0; x < tamano; x++) {
      final idx = (y * tamano + x) * 4;
      final dentro = y >= b0 && y < b1 && x >= b0 && x < b1;
      rgba[idx] = dentro ? rObj : 225;
      rgba[idx + 1] = dentro ? gObj : 225;
      rgba[idx + 2] = dentro ? bObj : 220;
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

void main() {
  testWidgets('sin sesión muestra la pantalla de login', (WidgetTester tester) async {
    await tester.pumpWidget(LicoreriaApp(sesion: Sesion()));

    expect(find.text('Licorería'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
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

  test('BaseLocal consulta catálogo y stock sin conexión (CU04 / R07)', () async {
    final base = BaseLocal(persistirEnDisco: false);
    final todos = base.listarProductos();
    expect(todos.length, 5);

    final pacena = base.buscarPorEtiqueta('pacena_620');
    expect(pacena, isNotNull);
    expect(pacena!.producto.codigo, 'CER-001');
    expect(pacena.cantidad, greaterThan(0));

    final cervezas = base.listarProductos(tipo: 'CERVEZA');
    expect(cervezas.length, 2);
  });

  test('ClasificadorLocal reconoce los 5 productos en modo avión con confianza >= 80 % (CU04 / R05)', () {
    final base = BaseLocal(persistirEnDisco: false);
    final clasificador = ClasificadorLocal(baseLocal: base);

    final casos = <({List<int> rgb, String etiqueta, String codigo})>[
      (rgb: [200, 160, 40], etiqueta: 'pacena_620', codigo: 'CER-001'),
      (rgb: [30, 90, 170], etiqueta: 'huari_620', codigo: 'CER-003'),
      (rgb: [25, 25, 25], etiqueta: 'casareal_negra', codigo: 'SIN-001'),
      (rgb: [180, 30, 40], etiqueta: 'jw_red', codigo: 'WHI-001'),
      (rgb: [140, 190, 220], etiqueta: 'absolut_750', codigo: 'VOD-001'),
    ];

    for (final c in casos) {
      final rgba = _generarImagenSinteticaRgba(c.rgb[0], c.rgb[1], c.rgb[2]);
      final pred = clasificador.clasificarRgba(rgba, 64, 64);
      expect(pred.etiqueta, c.etiqueta);
      expect(pred.productoCodigo, c.codigo);
      expect(pred.confianza, greaterThanOrEqualTo(0.8));
      expect(pred.modoOffline, isTrue);
      expect(pred.stockDisponible, greaterThan(0));
    }
  });

  testWidgets('CatalogoOfflinePage muestra productos y stock en modo avión', (WidgetTester tester) async {
    final base = BaseLocal(persistirEnDisco: false);
    final api = Api(
      Sesion(),
      baseLocal: base,
      clasificadorLocal: ClasificadorLocal(baseLocal: base),
    );

    await tester.pumpWidget(MaterialApp(home: CatalogoOfflinePage(api: api)));
    await tester.pump();

    expect(find.text('Catálogo y stock sin conexión'), findsOneWidget);
    expect(find.text('Cerveza Paceña 620 ml'), findsOneWidget);
    expect(find.text('Stock: 48'), findsOneWidget);
  });
}
