import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:app_movil/db/base_local.dart';
import 'package:app_movil/servicios/fotos_s3.dart';

FotoPendiente _foto(String id, DateTime cuando, {String usuario = 'almacen01'}) => FotoPendiente(
      id: id,
      archivo: '/tmp/$id.jpg',
      etiqueta: 'pacena_620',
      confianza: 0.93,
      usuario: usuario,
      creadaEn: cuando,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();

  test('la clave de S3 agrupa por día y usuario, sin caracteres que haya que codificar', () {
    final f = _foto('20261110T153012Z-a1b2c3d4', DateTime.utc(2026, 11, 10, 15, 30), usuario: 'josé pérez');

    expect(FotosS3.claveS3(f), 'fotos/2026-11-10/jos__p_rez/20261110T153012Z-a1b2c3d4.jpg');
  });

  test('la cola de fotos guarda, lista de la más antigua a la más nueva y quita', () async {
    final base = BaseLocal(fabrica: databaseFactoryFfiNoIsolate, ruta: inMemoryDatabasePath);
    await base.encolarFoto(_foto('b', DateTime.utc(2026, 11, 10, 12)));
    await base.encolarFoto(_foto('a', DateTime.utc(2026, 11, 10, 9)));

    expect((await base.fotosPendientes()).map((f) => f.id), ['a', 'b']);
    expect((await base.fotosPendientes()).first.confianza, 0.93);
    expect(await base.contarFotosPendientes(), 2);

    await base.quitarFoto('a');
    expect((await base.fotosPendientes()).map((f) => f.id), ['b']);
    await base.cerrar();
  });

  test('un teléfono con la base de la versión 1 gana la cola de fotos sin perder su stock', () async {
    final dir = await Directory.systemTemp.createTemp('licoreria_test');
    final ruta = p.join(dir.path, 'v1.db');
    final fabrica = databaseFactoryFfiNoIsolate;

    // Base como la dejaba la app anterior: versión 1, sin foto_pendiente
    final v1 = await fabrica.openDatabase(ruta, options: OpenDatabaseOptions(version: 1, onCreate: (db, _) async {
      await db.execute('CREATE TABLE producto (codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, marca TEXT, tipo TEXT, '
          'precio REAL NOT NULL, etiqueta_modelo TEXT NOT NULL)');
      await db.execute('CREATE TABLE stock (producto_codigo TEXT PRIMARY KEY, cantidad INTEGER NOT NULL, actualizado_en TEXT NOT NULL)');
      await db.execute('CREATE TABLE sync_info (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
      await db.insert('producto', {'codigo': 'WHI-003', 'nombre': 'Whisky', 'tipo': 'WHISKY', 'precio': 200, 'etiqueta_modelo': 'x'});
      await db.insert('stock', {'producto_codigo': 'WHI-003', 'cantidad': 13, 'actualizado_en': '2026-11-10'});
    }));
    await v1.close();

    final base = BaseLocal(fabrica: fabrica, ruta: ruta);
    expect(await base.stockPorCodigo(), {'WHI-003': 13});
    await base.encolarFoto(_foto('a', DateTime.utc(2026, 11, 10)));
    expect(await base.contarFotosPendientes(), 1);

    await base.cerrar();
    await dir.delete(recursive: true);
  });
}
