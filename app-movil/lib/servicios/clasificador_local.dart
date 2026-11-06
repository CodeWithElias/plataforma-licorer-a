import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show rootBundle;
import 'package:tflite_flutter/tflite_flutter.dart';

import '../db/base_local.dart';
import 'api.dart';

/// Motor que corre el modelo: recibe píxeles RGB de 0 a 255 de una imagen y devuelve una probabilidad por etiqueta.
abstract class MotorModelo {
  List<double> ejecutar(Float32List rgb, int ancho, int alto);
}

/// Motor real: el intérprete de TensorFlow Lite sobre `assets/modelos/modelo.tflite`.
class MotorTflite implements MotorModelo {
  MotorTflite(this._interprete);

  final Interpreter _interprete;

  static Future<MotorTflite> cargar() async =>
      MotorTflite(await Interpreter.fromAsset('assets/modelos/modelo.tflite'));

  @override
  List<double> ejecutar(Float32List rgb, int ancho, int alto) {
    final imagen = List.generate(
      alto,
      (y) => List.generate(ancho, (x) {
        final i = (y * ancho + x) * 3;
        return [rgb[i], rgb[i + 1], rgb[i + 2]];
      }),
    );
    final clases = _interprete.getOutputTensor(0).shape.last;
    final salida = [List<double>.filled(clases, 0)];
    _interprete.run([imagen], salida);
    return salida.first;
  }
}

/// Clasificador en el teléfono con TensorFlow Lite (CU04 / R05). La inferencia corre en el dispositivo y el
/// resultado se cruza con el catálogo local, así funciona en modo avión sin conexión a `ms-ia`.
class ClasificadorLocal {
  ClasificadorLocal({BaseLocal? baseLocal, MotorModelo? motor}) : _base = baseLocal ?? BaseLocal() {
    _motor = motor;
  }

  final BaseLocal _base;
  MotorModelo? _motor;
  String? _errorModelo;

  static const int tamanoEntrada = 224;
  static const String versionPorDefecto = 'sin versión';

  /// Orden de salida del modelo (`assets/modelos/etiquetas.txt` lo reemplaza al cargar).
  static const List<String> etiquetasPorDefecto = [
    'absolut_750',
    'casareal_negra',
    'huari_620',
    'jw_red',
    'pacena_620',
  ];

  String _version = versionPorDefecto;
  List<String> _etiquetas = List<String>.from(etiquetasPorDefecto);
  bool _cargado = false;

  String get version => _version;
  List<String> get etiquetas => List<String>.unmodifiable(_etiquetas);

  /// Carga el modelo y sus metadatos. Un modelo inválido no impide usar la app: el error sale al clasificar.
  Future<void> inicializar() async {
    if (_cargado) return;
    await _base.inicializar();

    if (_motor == null) {
      try {
        _motor = await MotorTflite.cargar();
      } catch (e) {
        _errorModelo = 'No se pudo cargar el modelo TFLite: $e';
      }
    }

    try {
      final txt = await rootBundle.loadString('assets/modelos/etiquetas.txt');
      final lineas = txt.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
      if (lineas.isNotEmpty) _etiquetas = lineas;
    } catch (_) {}

    try {
      final info = jsonDecode(await rootBundle.loadString('assets/modelos/latest.json')) as Map<String, dynamic>;
      if (info['version'] is String) _version = info['version'] as String;
    } catch (_) {}

    _cargado = true;
  }

  /// Etiquetas y versión del servidor, para mostrarlas. El modelo solo cambia al actualizar los assets de la app.
  Future<void> actualizarMetadatos({required String version, List<String>? etiquetas}) async {
    await _base.guardarSyncInfo('version_modelo_servidor', version);
  }

  /// Pasa un buffer RGBA a los píxeles RGB de 0 a 255 que espera el modelo (él mismo hace el escalado).
  static Float32List rgbDesdeRgba(List<int> rgba, int ancho, int alto) {
    final rgb = Float32List(ancho * alto * 3);
    for (var i = 0; i < ancho * alto; i++) {
      rgb[i * 3] = rgba[i * 4].toDouble();
      rgb[i * 3 + 1] = rgba[i * 4 + 1].toDouble();
      rgb[i * 3 + 2] = rgba[i * 4 + 2].toDouble();
    }
    return rgb;
  }

  /// Clasifica un buffer RGBA ya decodificado y cruza la etiqueta con el catálogo local.
  Future<Prediccion> clasificarRgba(List<int> rgba, int ancho, int alto) async {
    final motor = _motor;
    if (motor == null) {
      throw ErrorApi('MODELO_NO_DISPONIBLE', _errorModelo ?? 'El modelo todavía no está cargado');
    }
    final probs = motor.ejecutar(rgbDesdeRgba(rgba, ancho, alto), ancho, alto);

    var mejor = 0;
    for (var i = 1; i < probs.length; i++) {
      if (probs[i] > probs[mejor]) mejor = i;
    }
    final etiqueta = mejor < _etiquetas.length ? _etiquetas[mejor] : 'clase_$mejor';
    final item = await _base.buscarPorEtiqueta(etiqueta);

    return Prediccion(
      etiqueta: etiqueta,
      confianza: (probs[mejor] * 10000).round() / 10000.0,
      productoCodigo: item?.producto.codigo ?? mapaEtiquetaACodigo[etiqueta],
      nombre: item?.producto.nombre,
      precio: item?.producto.precio,
      stockDisponible: item?.cantidad,
      modelo: _version,
      modoOffline: true,
    );
  }

  /// Decodifica la foto de la cámara, la lleva al tamaño del modelo y la clasifica.
  Future<Prediccion> clasificarImagenBytes(List<int> bytesImagen) async {
    await inicializar();
    final codec = await ui.instantiateImageCodec(
      Uint8List.fromList(bytesImagen),
      targetWidth: tamanoEntrada,
      targetHeight: tamanoEntrada,
    );
    final frame = await codec.getNextFrame();
    final datos = await frame.image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (datos == null) {
      throw ErrorApi('IMAGEN_INVALIDA', 'No se pudo leer la foto');
    }
    return clasificarRgba(datos.buffer.asUint8List(), frame.image.width, frame.image.height);
  }
}
