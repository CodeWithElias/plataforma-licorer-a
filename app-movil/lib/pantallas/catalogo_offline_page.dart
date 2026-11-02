import 'package:flutter/material.dart';

import '../db/base_local.dart';
import '../servicios/api.dart';

/// Pantalla de catálogo y existencias sin conexión (CU04 / R07: SQLite + TFLite local).
class CatalogoOfflinePage extends StatefulWidget {
  const CatalogoOfflinePage({super.key, required this.api});

  final Api api;

  @override
  State<CatalogoOfflinePage> createState() => _CatalogoOfflinePageState();
}

class _CatalogoOfflinePageState extends State<CatalogoOfflinePage> {
  String _busqueda = '';
  String _tipoSeleccionado = '';
  bool _sincronizando = false;
  bool? _ultimaSyncOnline;

  @override
  void initState() {
    super.initState();
    _cargarInicial();
  }

  Future<void> _cargarInicial() async {
    await widget.api.baseLocal.inicializar();
    await widget.api.clasificadorLocal.inicializar();
    if (mounted) setState(() {});
  }

  Future<void> _sincronizar() async {
    setState(() => _sincronizando = true);
    final ok = await widget.api.sincronizarDatosOffline();
    if (!mounted) return;
    setState(() {
      _sincronizando = false;
      _ultimaSyncOnline = ok;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Catálogo SQLite y modelo TFLite sincronizados con el servidor'
              : 'Sin conexión (Modo Avión): mostrando datos de la base SQLite local',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.api.baseLocal;
    final items = base.listarProductos(busqueda: _busqueda, tipo: _tipoSeleccionado);
    final tipos = base.tiposDisponibles();
    final versionModelo = base.obtenerSyncInfo('version_modelo') ?? widget.api.clasificadorLocal.version;
    final ultimaSync = base.obtenerSyncInfo('ultima_sync') ?? 'Semilla local';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Catálogo y stock sin conexión'),
        actions: [
          IconButton(
            tooltip: 'Sincronizar con servidor',
            onPressed: _sincronizando ? null : _sincronizar,
            icon: _sincronizando
                ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.sync),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Icon(
                  _ultimaSyncOnline == true ? Icons.cloud_done : Icons.airplanemode_active,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'SQLite local (${items.length} productos) · TFLite v$versionModelo\nÚltima sync: $ultimaSync',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Buscar por código, nombre o marca',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (valor) => setState(() => _busqueda = valor),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: const Text('Todos'),
                    selected: _tipoSeleccionado.isEmpty,
                    onSelected: (_) => setState(() => _tipoSeleccionado = ''),
                  ),
                ),
                for (final t in tipos)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(t),
                      selected: _tipoSeleccionado == t,
                      onSelected: (_) => setState(() => _tipoSeleccionado = t),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? const Center(child: Text('No hay productos que coincidan con la búsqueda.'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final item = items[idx];
                      return _TarjetaProductoOffline(item: item);
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _TarjetaProductoOffline extends StatelessWidget {
  const _TarjetaProductoOffline({required this.item});

  final ProductoConStock item;

  @override
  Widget build(BuildContext context) {
    final p = item.producto;
    final bajoStock = item.cantidad <= 15;
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Text(p.codigo.split('-').first),
        ),
        title: Text(p.nombre),
        subtitle: Text(
          '${p.codigo} · ${p.marca ?? p.tipo} · Clase TFLite: ${p.etiquetaModelo}\n'
          'Precio: Bs ${p.precio.toStringAsFixed(2)}',
        ),
        isThreeLine: true,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              'Stock: ${item.cantidad}',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: bajoStock ? Colors.orange.shade800 : Colors.green.shade700,
              ),
            ),
            const Text('unidades', style: TextStyle(fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

