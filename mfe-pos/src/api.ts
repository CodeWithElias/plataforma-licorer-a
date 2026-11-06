import { obtenerToken } from './auth';
import {
  eliminarVentaOffline,
  guardarCatalogoLocal,
  marcarVentaConError,
  obtenerCatalogoLocal,
  type VentaOfflineLocal,
} from './db/indexed-db';

/** Cliente de las APIs que usa el POS (contratos: ms-inventario y ms-ventas docs/openapi.yaml). */

const API_INVENTARIO = import.meta.env.VITE_API_INVENTARIO ?? '/api/inventario';
const API_VENTAS = import.meta.env.VITE_API_VENTAS ?? '/api/ventas';

export interface Producto {
  codigo: string;
  nombre: string;
  marca?: string;
  tipo: string;
  precio: number;
}

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'QR';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

export interface VentaCreada {
  id: string;
  numero: number;
  total: number;
  estado: string;
}

export interface ErrorApi {
  estado: number;
  codigo: string;
  mensaje: string;
  faltantes?: { productoCodigo: string; pedido: number; disponible: number }[];
}

export type ResultadoVenta = { ok: true; venta: VentaCreada } | { ok: false; error: ErrorApi };

export interface ResultadoSyncItem {
  operationId: string;
  resultado: 'OK' | 'DUPLICADO' | 'ERROR';
  ventaId?: string;
  numero?: number;
  estado?: string;
  mensaje?: string;
  motivo?: string;
}

export interface ResumenSincronizacion {
  total: number;
  exitosas: number;
  duplicadas: number;
  errores: number;
  detalles: ResultadoSyncItem[];
}

async function pedir(url: string, opciones: RequestInit = {}): Promise<Response> {
  const token = await obtenerToken();
  return fetch(url, { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } });
}

/** ¿Responde el servidor? La red del navegador puede estar bien y el gateway o ms-ventas caídos. */
export async function servidorDisponible(): Promise<boolean> {
  try {
    return (await fetch(`${API_VENTAS}/health`, { cache: 'no-store' })).ok;
  } catch {
    return false;
  }
}

export async function listarProductos(): Promise<Producto[]> {
  try {
    const r = await pedir(`${API_INVENTARIO}/productos`);
    if (r.ok) {
      const productos: Producto[] = await r.json();
      // Guardar en caché local para soporte offline
      await guardarCatalogoLocal(productos).catch(() => { });
      return productos;
    }
  } catch {
    // Si falla la red, intentar leer de la caché local
  }

  const enCache = await obtenerCatalogoLocal().catch(() => []);
  if (enCache.length > 0) {
    return enCache;
  }
  throw new Error('No se pudo cargar el catálogo y no hay datos en caché local');
}

/** CU02: la Saga corre en ms-ventas. El Idempotency-Key identifica la venta en los 3 servicios. */
export async function vender(items: ItemCarrito[], metodo: MetodoPago, idempotencyKey: string): Promise<ResultadoVenta> {
  let r: Response;
  try {
    r = await pedir(`${API_VENTAS}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        items: items.map((i) => ({ productoCodigo: i.producto.codigo, cantidad: i.cantidad })),
        pago: { metodo },
      }),
    });
  } catch {
    return { ok: false, error: { estado: 0, codigo: 'SIN_CONEXION', mensaje: 'Sin conexión con el servidor' } };
  }
  const cuerpo = await r.json().catch(() => ({}));
  if (r.ok) return { ok: true, venta: cuerpo as VentaCreada };
  return {
    ok: false,
    error: {
      estado: r.status,
      codigo: cuerpo.codigo ?? 'ERROR',
      mensaje: cuerpo.mensaje ?? `Error ${r.status}`,
      faltantes: cuerpo.faltantes,
    },
  };
}

/**
 * CU03: Sincroniza un lote de ventas offline con ms-ventas (/ventas/sync).
 * Cumple con la regla de depuración:
 * - OK / DUPLICADO -> Se eliminan de IndexedDB
 * - ERROR -> Se conservan y se marcan con el motivo
 */
export async function sincronizarVentasLote(ventas: VentaOfflineLocal[]): Promise<ResumenSincronizacion> {
  if (ventas.length === 0) {
    return { total: 0, exitosas: 0, duplicadas: 0, errores: 0, detalles: [] };
  }

  // Máximo 50 ventas por lote según contrato
  const lote = ventas.slice(0, 50).map((v) => ({
    operationId: v.operationId,
    items: v.items,
    pago: v.pago,
    fechaLocal: v.fechaLocal,
  }));

  const r = await pedir(`${API_VENTAS}/ventas/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lote),
  });

  if (!r.ok) {
    const errorCuerpo = await r.json().catch(() => ({}));
    throw new Error(errorCuerpo.mensaje ?? `Error de sincronización (${r.status})`);
  }

  const resultados: ResultadoSyncItem[] = await r.json();
  let exitosas = 0;
  let duplicadas = 0;
  let errores = 0;

  for (const res of resultados) {
    if (res.resultado === 'OK') {
      exitosas++;
      await eliminarVentaOffline(res.operationId);
    } else if (res.resultado === 'DUPLICADO') {
      duplicadas++;
      await eliminarVentaOffline(res.operationId);
    } else {
      errores++;
      await marcarVentaConError(res.operationId, res.motivo ?? res.mensaje ?? 'Error desconocido');
    }
  }

  return {
    total: resultados.length,
    exitosas,
    duplicadas,
    errores,
    detalles: resultados,
  };
}

export function totalCarrito(items: ItemCarrito[]): number {
  return Math.round(items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0) * 100) / 100;
}

/** Mensaje para el cajero según el código de error del contrato. */
export function mensajeDeVenta(e: ErrorApi, productos: Producto[] = []): string {
  const nombre = (codigo: string) => productos.find((p) => p.codigo === codigo)?.nombre ?? codigo;
  switch (e.codigo) {
    case 'SIN_STOCK':
      return (
        'Sin stock suficiente: ' +
        (e.faltantes ?? []).map((f) => `${nombre(f.productoCodigo)} (pediste ${f.pedido}, hay ${f.disponible})`).join('; ')
      );
    case 'SAGA_COMPENSADA':
      return 'No se pudo completar la venta y se revirtió automáticamente (stock liberado y pago reembolsado). Intenta de nuevo.';
    case 'PRODUCTO_NO_ENCONTRADO':
      return 'Un producto del carrito ya no existe en el catálogo.';
    case 'NO_AUTENTICADO':
      return 'La sesión venció. Vuelve a iniciar sesión.';
    case 'SIN_PERMISO':
      return 'Tu usuario no tiene permiso para vender.';
    case 'SIN_CONEXION':
      return 'Sin conexión con el servidor. Puedes cobrar en modo Offline.';
    default:
      return e.mensaje;
  }
}
