import 'package:flutter_test/flutter_test.dart';

import 'package:app_movil/servicios/cambios_stock.dart';

void main() {
  const nombres = {'WHI-003': 'Whisky Red Label', 'CER-001': 'Paceña', 'RON-002': 'Ron Abuelo', 'VOD-001': 'Absolut'};

  test('detecta subidas y bajadas, y no cuenta lo que no cambió', () {
    final cambios = calcularCambios(
      antes: {'WHI-003': 1, 'CER-001': 48, 'RON-002': 10},
      ahora: {'WHI-003': 13, 'CER-001': 45, 'RON-002': 10},
      nombres: nombres,
    );

    expect(cambios.map((c) => c.codigo), ['WHI-003', 'CER-001']);
    expect(cambios[0].subio, isTrue);
    expect(cambios[0].texto, 'Whisky Red Label: 1 → 13 (+12)');
    expect(cambios[1].subio, isFalse);
    expect(cambios[1].texto, 'Paceña: 48 → 45 (-3)');
  });

  test('un producto nuevo en el catálogo no es un cambio de stock', () {
    final cambios = calcularCambios(antes: {'CER-001': 48}, ahora: {'CER-001': 48, 'VOD-001': 20}, nombres: nombres);

    expect(cambios, isEmpty);
  });

  test('ordena las subidas primero y luego por tamaño del cambio', () {
    final cambios = calcularCambios(
      antes: {'WHI-003': 10, 'CER-001': 48, 'RON-002': 10, 'VOD-001': 5},
      ahora: {'WHI-003': 12, 'CER-001': 20, 'RON-002': 30, 'VOD-001': 4},
      nombres: nombres,
    );

    expect(cambios.map((c) => c.codigo), ['RON-002', 'WHI-003', 'CER-001', 'VOD-001']);
  });

  test('sin nombre en el catálogo usa el código', () {
    final cambios = calcularCambios(antes: {'X-1': 1}, ahora: {'X-1': 2}, nombres: const {});

    expect(cambios.single.texto, 'X-1: 1 → 2 (+1)');
  });
}
