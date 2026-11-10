import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

import '../db/base_local.dart';
import 'api.dart';

/// Motor que corre el modelo: recibe píxeles RGB de 0 a 255 de una imagen y devuelve una probabilidad por etiqueta.
abstract class MotorModelo {
  List<double> ejecutar(Float32List rgb, int ancho, int alto);

  /// Cuántas probabilidades devuelve (una por etiqueta).
  int get clases;

  /// Forma de la imagen que recibe, p. ej. [1, 224, 224, 3].
  List<int> get entrada;

  void cerrar();
}

/// Descarga un archivo de una versión del modelo del servidor (`modelo.tflite` o `etiquetas.txt`).
typedef DescargarArchivoModelo = Future<List<int>> Function(String version, String archivo);

/// Motor real: el intérprete de TensorFlow Lite.
class MotorTflite implements MotorModelo {
  MotorTflite(this._interprete);

  final Interpreter _interprete;

  /// El que viene dentro del APK.
  static Future<MotorTflite> cargar() async =>
      MotorTflite(await Interpreter.fromAsset('assets/modelos/modelo.tflite'));

  /// Uno descargado del servidor.
  static Future<MotorModelo> cargarArchivo(File archivo) async => MotorTflite(Interpreter.fromFile(archivo));

  @override
  int get clases => _interprete.getOutputTensor(0).shape.last;

  @override
  List<int> get entrada => _interprete.getInputTensor(0).shape;

  @override
  void cerrar() => _interprete.close();

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
///
/// El modelo se mantiene al día solo: al sincronizar, si ms-ia tiene otra versión, se descarga, se valida y
/// reemplaza al anterior ([actualizarModelo]). Queda guardado en el teléfono, así que sigue funcionando sin
/// internet. Si no hay ninguno descargado (instalación nueva) se usa el que viene dentro del APK.
class ClasificadorLocal {
  ClasificadorLocal({
    BaseLocal? baseLocal,
    MotorModelo? motor,
    Future<MotorModelo> Function(File)? cargarArchivo,
    Future<Directory> Function()? carpetaModelos,
  })  : _base = baseLocal ?? BaseLocal(),
        _cargarArchivo = cargarArchivo ?? MotorTflite.cargarArchivo,
        _carpetaModelos = carpetaModelos ?? _carpetaPorDefecto {
    _motor = motor;
  }

  final BaseLocal _base;
  final Future<MotorModelo> Function(File) _cargarArchivo;
  final Future<Directory> Function() _carpetaModelos;
  MotorModelo? _motor;
  String? _errorModelo;
  bool _actualizando = false;

  /// Clave de sync_info con la versión descargada que está en uso.
  static const claveModeloDescargado = 'modelo_descargado';

  static Future<Directory> _carpetaPorDefecto() async =>
      Directory(p.join((await getApplicationSupportDirectory()).path, 'modelos'));

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

    // Primero el último descargado del servidor; si falta o está dañado, el del APK
    if (_motor == null && await _cargarDescargado()) {
      _cargado = true;
      return;
    }

    if (_motor == null) {
      try {
        _motor = await MotorTflite.cargar();
      } catch (e) {
        _errorModelo = 'No se pudo cargar el modelo TFLite: $e';
      }
    }

    try {
      final lineas = _leerEtiquetas(await rootBundle.loadString('assets/modelos/etiquetas.txt'));
      if (lineas.isNotEmpty) _etiquetas = lineas;
    } catch (_) {}

    try {
      final info = jsonDecode(await rootBundle.loadString('assets/modelos/latest.json')) as Map<String, dynamic>;
      if (info['version'] is String) _version = info['version'] as String;
    } catch (_) {}

    _cargado = true;
  }

  /// Si [version] (la vigente en ms-ia) no es la que usa el teléfono, descarga ese modelo, lo valida y lo pone
  /// en uso. Devuelve true si cambió de modelo.
  ///
  /// Un modelo que no se puede cargar, o cuya cantidad de salidas no coincide con sus etiquetas, se descarta y
  /// se sigue con el actual. Se descarga a una carpeta temporal y solo se pone en uso completo y validado.
  Future<bool> actualizarModelo({required String version, required DescargarArchivoModelo descargar}) async {
    await inicializar();
    if (version.isEmpty || version == _version || _actualizando) return false;
    _actualizando = true;
    final raiz = await _carpetaModelos();
    final temporal = Directory(p.join(raiz.path, '.descarga-$version-${Random().nextInt(1 << 32)}'));
    try {
      await temporal.create(recursive: true);
      final etiquetas = _leerEtiquetas(utf8.decode(await descargar(version, 'etiquetas.txt')));
      await File(p.join(temporal.path, 'etiquetas.txt')).writeAsString(etiquetas.join('\n'), flush: true);
      await File(p.join(temporal.path, 'modelo.tflite')).writeAsBytes(await descargar(version, 'modelo.tflite'), flush: true);

      final nuevo = await _validar(File(p.join(temporal.path, 'modelo.tflite')), etiquetas);

      final destino = Directory(p.join(raiz.path, version));
      if (await destino.exists()) await destino.delete(recursive: true);
      await temporal.rename(destino.path);

      final anterior = _motor;
      _motor = nuevo;
      _etiquetas = etiquetas;
      _version = version;
      _errorModelo = null;
      anterior?.cerrar();
      await _base.guardarSyncInfo(claveModeloDescargado, version);
      await _base.guardarSyncInfo('version_modelo', version);
      await _borrarOtrasVersiones(raiz, version);
      debugPrint('Modelo: actualizado a la versión $version (${etiquetas.length} etiquetas)');
      return true;
    } catch (e) {
      debugPrint('Modelo: no se pudo actualizar a $version, se sigue con $_version: $e');
      if (await temporal.exists()) await temporal.delete(recursive: true);
      return false;
    } finally {
      _actualizando = false;
    }
  }

  /// Carga el modelo descargado que estaba en uso. false si no hay o no sirve.
  Future<bool> _cargarDescargado() async {
    final version = await _base.obtenerSyncInfo(claveModeloDescargado);
    if (version == null) return false;
    try {
      final carpeta = p.join((await _carpetaModelos()).path, version);
      final etiquetas = _leerEtiquetas(await File(p.join(carpeta, 'etiquetas.txt')).readAsString());
      _motor = await _validar(File(p.join(carpeta, 'modelo.tflite')), etiquetas);
      _etiquetas = etiquetas;
      _version = version;
      return true;
    } catch (e) {
      debugPrint('Modelo: el descargado ($version) no se pudo cargar, se usa el del APK: $e');
      return false;
    }
  }

  /// Carga el archivo y comprueba que encaje con la app: imagen de entrada del tamaño esperado y una salida
  /// por etiqueta. Si no encaja lo cierra y lanza el error.
  Future<MotorModelo> _validar(File archivo, List<String> etiquetas) async {
    if (etiquetas.isEmpty) throw const FormatException('etiquetas.txt está vacío');
    final motor = await _cargarArchivo(archivo);
    final entrada = motor.entrada;
    final entradaOk = entrada.length == 4 && entrada[1] == tamanoEntrada && entrada[2] == tamanoEntrada && entrada[3] == 3;
    if (!entradaOk || motor.clases != etiquetas.length) {
      motor.cerrar();
      throw FormatException('El modelo recibe $entrada y da ${motor.clases} salidas para ${etiquetas.length} etiquetas');
    }
    return motor;
  }

  static List<String> _leerEtiquetas(String texto) =>
      texto.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();

  /// Solo se guarda la versión en uso: cada modelo pesa varios MB.
  static Future<void> _borrarOtrasVersiones(Directory raiz, String enUso) async {
    await for (final e in raiz.list()) {
      if (e is Directory && p.basename(e.path) != enUso && !p.basename(e.path).startsWith('.descarga-')) {
        await e.delete(recursive: true);
      }
    }
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
