import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:app_movil/db/base_local.dart';
import 'package:app_movil/servicios/clasificador_local.dart';

/// El "modelo" es un archivo de texto `clases=N;entrada=224`: así la prueba decide qué tan válido es.
class _MotorDeArchivo implements MotorModelo {
  _MotorDeArchivo(this.clases, this.lado);

  @override
  final int clases;
  final int lado;
  bool cerrado = false;

  static Future<MotorModelo> cargar(File f) async {
    final datos = Map.fromEntries((await f.readAsString()).split(';').map((x) {
      final kv = x.split('=');
      return MapEntry(kv[0], int.parse(kv[1]));
    }));
    return _MotorDeArchivo(datos['clases']!, datos['entrada'] ?? 224);
  }

  @override
  List<int> get entrada => [1, lado, lado, 3];

  @override
  List<double> ejecutar(Float32List rgb, int ancho, int alto) => List.filled(clases, 0);

  @override
  void cerrar() => cerrado = true;
}

/// Servidor falso de ms-ia: archivos por versión y registro de lo que se pidió.
class _ServidorModelos {
  final archivos = <String, List<int>>{};
  final pedidos = <String>[];

  void publicar(String version, {required int clases, required List<String> etiquetas, int entrada = 224}) {
    archivos['$version/modelo.tflite'] = utf8.encode('clases=$clases;entrada=$entrada');
    archivos['$version/etiquetas.txt'] = utf8.encode('${etiquetas.join('\n')}\n');
  }

  Future<List<int>> descargar(String version, String archivo) async {
    pedidos.add('$version/$archivo');
    return archivos['$version/$archivo'] ?? (throw const HttpException('404'));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();

  late Directory dir;
  late BaseLocal base;
  late _ServidorModelos servidor;

  ClasificadorLocal nuevoClasificador() => ClasificadorLocal(
        baseLocal: base,
        motor: _MotorDeArchivo(5, 224),   // el "del APK"
        cargarArchivo: _MotorDeArchivo.cargar,
        carpetaModelos: () async => Directory(p.join(dir.path, 'modelos')),
      );

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('modelos_test');
    base = BaseLocal(fabrica: databaseFactoryFfiNoIsolate, ruta: p.join(dir.path, 'app.db'));
    servidor = _ServidorModelos();
  });

  tearDown(() async {
    await base.cerrar();
    await dir.delete(recursive: true);
  });

  test('descarga el modelo nuevo, lo valida y lo pone en uso con sus etiquetas', () async {
    final c = nuevoClasificador();
    servidor.publicar('v2', clases: 6, etiquetas: ['a', 'b', 'c', 'd', 'e', 'nuevo_ron']);

    expect(await c.actualizarModelo(version: 'v2', descargar: servidor.descargar), isTrue);
    expect(c.version, 'v2');
    expect(c.etiquetas.last, 'nuevo_ron');
    expect(await base.obtenerSyncInfo(ClasificadorLocal.claveModeloDescargado), 'v2');
  });

  test('si ya tiene la versión vigente no descarga nada', () async {
    final c = nuevoClasificador();
    servidor.publicar('v2', clases: 5, etiquetas: ['a', 'b', 'c', 'd', 'e']);
    await c.actualizarModelo(version: 'v2', descargar: servidor.descargar);
    servidor.pedidos.clear();

    expect(await c.actualizarModelo(version: 'v2', descargar: servidor.descargar), isFalse);
    expect(servidor.pedidos, isEmpty);
  });

  test('un modelo que no coincide con sus etiquetas se descarta y sigue el anterior', () async {
    final c = nuevoClasificador();
    await c.inicializar();
    final anterior = c.version;
    servidor.publicar('v3', clases: 7, etiquetas: ['a', 'b']);   // 7 salidas para 2 etiquetas
    servidor.publicar('v4', clases: 2, etiquetas: ['a', 'b'], entrada: 300);   // imagen de otro tamaño

    expect(await c.actualizarModelo(version: 'v3', descargar: servidor.descargar), isFalse);
    expect(await c.actualizarModelo(version: 'v4', descargar: servidor.descargar), isFalse);
    expect(c.version, anterior);
    expect(await Directory(p.join(dir.path, 'modelos')).list().toList(), isEmpty);   // sin restos de la descarga
  });

  test('si la descarga falla a mitad sigue el modelo actual', () async {
    final c = nuevoClasificador();
    await c.inicializar();
    final anterior = c.version;
    servidor.archivos['v5/etiquetas.txt'] = utf8.encode('a\nb\n');   // falta modelo.tflite

    expect(await c.actualizarModelo(version: 'v5', descargar: servidor.descargar), isFalse);
    expect(c.version, anterior);
  });

  test('al volver a abrir la app usa el modelo descargado, sin internet', () async {
    servidor.publicar('v2', clases: 3, etiquetas: ['x', 'y', 'z']);
    await nuevoClasificador().actualizarModelo(version: 'v2', descargar: servidor.descargar);

    final reabierto = ClasificadorLocal(
      baseLocal: base,
      cargarArchivo: _MotorDeArchivo.cargar,
      carpetaModelos: () async => Directory(p.join(dir.path, 'modelos')),
    );
    await reabierto.inicializar();

    expect(reabierto.version, 'v2');
    expect(reabierto.etiquetas, ['x', 'y', 'z']);
  });

  test('solo guarda la versión en uso: borra las anteriores', () async {
    final c = nuevoClasificador();
    servidor.publicar('v2', clases: 2, etiquetas: ['a', 'b']);
    servidor.publicar('v3', clases: 2, etiquetas: ['a', 'b']);

    await c.actualizarModelo(version: 'v2', descargar: servidor.descargar);
    await c.actualizarModelo(version: 'v3', descargar: servidor.descargar);

    final carpetas = await Directory(p.join(dir.path, 'modelos')).list().map((e) => p.basename(e.path)).toList();
    expect(carpetas, ['v3']);
  });
}
