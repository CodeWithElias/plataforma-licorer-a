/// Un producto cuyo stock cambió entre la última sincronización y la actual.
class CambioStock {
  const CambioStock({required this.codigo, required this.nombre, required this.antes, required this.ahora});

  final String codigo;
  final String nombre;
  final int antes;
  final int ahora;

  int get diferencia => ahora - antes;
  bool get subio => diferencia > 0;

  /// "Whisky Johnnie Walker Red Label: 1 → 13 (+12)"
  String get texto => '$nombre: $antes → $ahora (${subio ? '+' : ''}$diferencia)';
}

/// Compara el stock guardado en el teléfono con el que llegó del servidor.
///
/// Solo cuenta productos que ya estaban en el teléfono: uno nuevo en el catálogo no es una subida de stock.
/// Ordena las subidas primero y, dentro de cada grupo, por el tamaño del cambio.
List<CambioStock> calcularCambios({
  required Map<String, int> antes,
  required Map<String, int> ahora,
  required Map<String, String> nombres,
}) {
  final cambios = <CambioStock>[
    for (final MapEntry(key: codigo, value: cantidad) in ahora.entries)
      if (antes.containsKey(codigo) && antes[codigo] != cantidad)
        CambioStock(codigo: codigo, nombre: nombres[codigo] ?? codigo, antes: antes[codigo]!, ahora: cantidad),
  ];
  cambios.sort((a, b) {
    if (a.subio != b.subio) return a.subio ? -1 : 1;
    return b.diferencia.abs().compareTo(a.diferencia.abs());
  });
  return cambios;
}
