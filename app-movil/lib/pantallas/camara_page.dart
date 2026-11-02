import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../servicios/api.dart';

/// Vista de cámara (CU04 / R05): toma una foto y la clasifica en el teléfono con TFLite
/// cruzándola con el catálogo y stock de SQLite local (funciona en modo avión).
class CamaraPage extends StatefulWidget {
  const CamaraPage({super.key, required this.api});

  final Api api;

  @override
  State<CamaraPage> createState() => _CamaraPageState();
}

class _CamaraPageState extends State<CamaraPage> {
  CameraController? _camara;
  String? _error;
  bool _procesando = false;

  @override
  void initState() {
    super.initState();
    _abrir();
  }

  Future<void> _abrir() async {
    await widget.api.baseLocal.inicializar();
    await widget.api.clasificadorLocal.inicializar();
    try {
      final camaras = await availableCameras();
      if (camaras.isEmpty) {
        setState(() => _error = 'El dispositivo no tiene cámara física activa');
        return;
      }
      final trasera = camaras.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => camaras.first);
      final controlador = CameraController(trasera, ResolutionPreset.medium, enableAudio: false);
      await controlador.initialize();
      if (!mounted) return;
      setState(() => _camara = controlador);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudo abrir la cámara: $e');
    }
  }

  Future<void> _mostrarResultado(Prediccion p) async {
    if (!mounted) return;
    final detalles = <String>[
      'Código: ${p.productoCodigo ?? '—'}',
      'Clase TFLite: ${p.etiqueta}',
      'Confianza: ${(p.confianza * 100).toStringAsFixed(1)} %',
      if (p.precio != null) 'Precio: Bs ${p.precio!.toStringAsFixed(2)}',
      if (p.stockDisponible != null) 'Stock local (SQLite): ${p.stockDisponible} unidades',
      if (p.modelo != null) 'Modelo: ${p.modelo} (${p.modoOffline ? 'Local TFLite' : 'Servidor'})',
    ];
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(p.nombre ?? p.etiqueta),
        content: Text(detalles.join('\n')),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Aceptar'))],
      ),
    );
  }

  Future<void> _escanear() async {
    final camara = _camara;
    if (camara == null || _procesando) return;
    setState(() => _procesando = true);
    try {
      final foto = await camara.takePicture();
      final p = await widget.api.clasificar(await foto.readAsBytes());
      await _mostrarResultado(p);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  Future<void> _simularCapturaLocal(List<int> rgbObjeto) async {
    setState(() => _procesando = true);
    try {
      const tamano = 64;
      final rgba = List<int>.filled(tamano * tamano * 4, 255);
      final b0 = (tamano * 0.18).floor();
      final b1 = (tamano * 0.82).floor();
      for (var y = 0; y < tamano; y++) {
        for (var x = 0; x < tamano; x++) {
          final idx = (y * tamano + x) * 4;
          final dentro = y >= b0 && y < b1 && x >= b0 && x < b1;
          rgba[idx] = dentro ? rgbObjeto[0] : 225;
          rgba[idx + 1] = dentro ? rgbObjeto[1] : 225;
          rgba[idx + 2] = dentro ? rgbObjeto[2] : 220;
          rgba[idx + 3] = 255;
        }
      }
      final pred = widget.api.clasificadorLocal.clasificarRgba(rgba, tamano, tamano);
      await _mostrarResultado(pred);
    } finally {
      if (mounted) setState(() => _procesando = false);
    }
  }

  @override
  void dispose() {
    _camara?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final camara = _camara;
    return Scaffold(
      appBar: AppBar(title: const Text('Escanear producto (TFLite)')),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    const Text(
                      'Prueba de inferencia local TFLite (Modo Avión):',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: [
                        OutlinedButton(
                          onPressed: _procesando ? null : () => _simularCapturaLocal(const [200, 160, 40]),
                          child: const Text('Paceña 620'),
                        ),
                        OutlinedButton(
                          onPressed: _procesando ? null : () => _simularCapturaLocal(const [30, 90, 170]),
                          child: const Text('Huari 620'),
                        ),
                        OutlinedButton(
                          onPressed: _procesando ? null : () => _simularCapturaLocal(const [25, 25, 25]),
                          child: const Text('Casa Real Negra'),
                        ),
                        OutlinedButton(
                          onPressed: _procesando ? null : () => _simularCapturaLocal(const [180, 30, 40]),
                          child: const Text('JW Red Label'),
                        ),
                        OutlinedButton(
                          onPressed: _procesando ? null : () => _simularCapturaLocal(const [140, 190, 220]),
                          child: const Text('Absolut 750'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            )
          : camara == null
              ? const Center(child: CircularProgressIndicator())
              : Center(child: CameraPreview(camara)),
      floatingActionButton: camara == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _procesando ? null : _escanear,
              icon: _procesando
                  ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.camera_alt),
              label: Text(_procesando ? 'Reconociendo…' : 'Escanear'),
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
