import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../servicios/api.dart';

/// Vista de cámara (CU04): toma una foto y la clasifica con ms-ia.
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
    try {
      final camaras = await availableCameras();
      if (camaras.isEmpty) {
        setState(() => _error = 'El dispositivo no tiene cámara');
        return;
      }
      final trasera = camaras.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => camaras.first);
      final controlador = CameraController(trasera, ResolutionPreset.medium, enableAudio: false);
      await controlador.initialize();
      if (!mounted) return;
      setState(() => _camara = controlador);
    } catch (e) {
      setState(() => _error = 'No se pudo abrir la cámara: $e');
    }
  }

  Future<void> _escanear() async {
    final camara = _camara;
    if (camara == null || _procesando) return;
    setState(() => _procesando = true);
    try {
      final foto = await camara.takePicture();
      final p = await widget.api.clasificar(await foto.readAsBytes());
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(p.nombre ?? p.etiqueta),
          content: Text('Código: ${p.productoCodigo ?? '—'}\nConfianza: ${(p.confianza * 100).toStringAsFixed(1)} %'),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Aceptar'))],
        ),
      );
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
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
      appBar: AppBar(title: const Text('Escanear producto')),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : camara == null
              ? const Center(child: CircularProgressIndicator())
              : Center(child: CameraPreview(camara)),
      floatingActionButton: camara == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _procesando ? null : _escanear,
              icon: _procesando ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.camera_alt),
              label: Text(_procesando ? 'Reconociendo…' : 'Escanear'),
            ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
