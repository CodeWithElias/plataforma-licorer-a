import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:app_movil/main.dart';
import 'package:app_movil/servicios/sesion.dart';

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
}
