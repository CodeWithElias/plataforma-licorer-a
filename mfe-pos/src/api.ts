import { obtenerToken } from './auth'

/** Cliente de las APIs que usa el POS (contratos: ms-inventario y ms-ventas docs/openapi.yaml). */

const API_INVENTARIO = import.meta.env.VITE_API_INVENTARIO ?? '/api/inventario'
const API_VENTAS = import.meta.env.VITE_API_VENTAS ?? '/api/ventas'

export interface Producto {
  codigo: string
  nombre: string
  marca?: string
  tipo: string
  precio: number
}

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'QR'

export interface ItemCarrito {
  producto: Producto
  cantidad: number
}

export interface VentaCreada {
  id: string
  numero: number
  total: number
  estado: string
}

export interface ErrorApi {
  estado: number
  codigo: string
  mensaje: string
  faltantes?: { productoCodigo: string; pedido: number; disponible: number }[]
}

export type ResultadoVenta = { ok: true; venta: VentaCreada } | { ok: false; error: ErrorApi }

async function pedir(url: string, opciones: RequestInit = {}): Promise<Response> {
  const token = await obtenerToken()
  return fetch(url, { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } })
}

export async function listarProductos(): Promise<Producto[]> {
  const r = await pedir(`${API_INVENTARIO}/productos`)
  if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status})`)
  return r.json()
}

/** CU02: la Saga corre en ms-ventas. El Idempotency-Key identifica la venta en los 3 servicios. */
export async function vender(items: ItemCarrito[], metodo: MetodoPago, idempotencyKey: string): Promise<ResultadoVenta> {
  let r: Response
  try {
    r = await pedir(`${API_VENTAS}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        items: items.map((i) => ({ productoCodigo: i.producto.codigo, cantidad: i.cantidad })),
        pago: { metodo },
      }),
    })
  } catch {
    return { ok: false, error: { estado: 0, codigo: 'SIN_CONEXION', mensaje: 'Sin conexión con el servidor' } }
  }
  const cuerpo = await r.json().catch(() => ({}))
  if (r.ok) return { ok: true, venta: cuerpo as VentaCreada }
  return { ok: false, error: { estado: r.status, codigo: cuerpo.codigo ?? 'ERROR', mensaje: cuerpo.mensaje ?? `Error ${r.status}`, faltantes: cuerpo.faltantes } }
}

export function totalCarrito(items: ItemCarrito[]): number {
  return Math.round(items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0) * 100) / 100
}

/** Mensaje para el cajero según el código de error del contrato. */
export function mensajeDeVenta(e: ErrorApi, productos: Producto[] = []): string {
  const nombre = (codigo: string) => productos.find((p) => p.codigo === codigo)?.nombre ?? codigo
  switch (e.codigo) {
    case 'SIN_STOCK':
      return 'Sin stock suficiente: ' + (e.faltantes ?? []).map((f) => `${nombre(f.productoCodigo)} (pediste ${f.pedido}, hay ${f.disponible})`).join('; ')
    case 'SAGA_COMPENSADA':
      return 'No se pudo completar la venta y se revirtió automáticamente (stock liberado y pago reembolsado). Intenta de nuevo.'
    case 'PRODUCTO_NO_ENCONTRADO':
      return 'Un producto del carrito ya no existe en el catálogo.'
    case 'NO_AUTENTICADO':
      return 'La sesión venció. Vuelve a iniciar sesión.'
    case 'SIN_PERMISO':
      return 'Tu usuario no tiene permiso para vender.'
    case 'SIN_CONEXION':
      return 'Sin conexión con el servidor. La venta no se registró.'
    default:
      return e.mensaje
  }
}
