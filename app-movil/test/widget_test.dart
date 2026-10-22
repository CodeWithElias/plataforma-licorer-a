import 'package:flutter_test/flutter_test.dart';

import 'package:app_movil/main.dart';

void main() {
  testWidgets('muestra la pantalla inicial', (WidgetTester tester) async {
    await tester.pumpWidget(const LicoreriaApp());

    expect(find.text('Licorería'), findsOneWidget);
    expect(find.text('App móvil'), findsOneWidget);
  });
}
