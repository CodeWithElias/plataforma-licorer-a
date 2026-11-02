/**
 * Capa de persistencia local con IndexedDB nativo (sin dependencias externas).
 * Implementa almacenamiento seguro y transaccional para:
 * 1. Cola de ventas offline (CU03)
 * 2. Catálogo local de productos en caché
 */

import { type ItemCarrito, type MetodoPago, type Producto } from '../api';

export interface VentaOfflineLocal {
  operationId: string;
  items: { productoCodigo: string; cantidad: number }[];
  pago: { metodo: MetodoPago };
  fechaLocal: string;
  total: number;
  creadoEn: number;
  estadoSync: 'PENDIENTE' | 'ERROR';
  motivoError?: string;
  detalleItems?: { codigo: string; nombre: string; cantidad: number; precio: number }[];
}

const DB_NOMBRE = 'licoreria_pos_db';
const DB_VERSION = 1;
const STORE_VENTAS = 'ventasOffline';
const STORE_CATALOGO = 'catalogoLocal';

function abrirBd(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno'));
      return;
    }

    const request = window.indexedDB.open(DB_NOMBRE, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_VENTAS)) {
        const storeVentas = db.createObjectStore(STORE_VENTAS, { keyPath: 'operationId' });
        storeVentas.createIndex('creadoEn', 'creadoEn', { unique: false });
        storeVentas.createIndex('estadoSync', 'estadoSync', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CATALOGO)) {
        const storeCat = db.createObjectStore(STORE_CATALOGO, { keyPath: 'codigo' });
        storeCat.createIndex('tipo', 'tipo', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Guarda una venta en la cola local de IndexedDB cuando no hay conexión. */
export async function guardarVentaOffline(
  items: ItemCarrito[],
  metodo: MetodoPago,
  operationId: string,
  total: number,
): Promise<VentaOfflineLocal> {
  const db = await abrirBd();
  const venta: VentaOfflineLocal = {
    operationId,
    items: items.map((i) => ({ productoCodigo: i.producto.codigo, cantidad: i.cantidad })),
    pago: { metodo },
    fechaLocal: new Date().toISOString(),
    total,
    creadoEn: Date.now(),
    estadoSync: 'PENDIENTE',
    detalleItems: items.map((i) => ({
      codigo: i.producto.codigo,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
    })),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite');
    const store = tx.objectStore(STORE_VENTAS);
    const req = store.put(venta);

    req.onsuccess = () => resolve(venta);
    req.onerror = () => reject(req.error);
  });
}

/** Obtiene todas las ventas pendientes de sincronización ordenadas por fecha. */
export async function listarVentasOffline(): Promise<VentaOfflineLocal[]> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readonly');
    const store = tx.objectStore(STORE_VENTAS);
    const req = store.getAll();

    req.onsuccess = () => {
      const res = (req.result as VentaOfflineLocal[]) || [];
      // Ordenar cronológicamente (las más antiguas primero)
      res.sort((a, b) => a.creadoEn - b.creadoEn);
      resolve(res);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Cantidad de ventas en cola pendientes de sincronizar. */
export async function contarVentasOffline(): Promise<number> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readonly');
    const store = tx.objectStore(STORE_VENTAS);
    const req = store.count();

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Elimina una venta ya confirmada por el servidor tras la sincronización. */
export async function eliminarVentaOffline(operationId: string): Promise<void> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite');
    const store = tx.objectStore(STORE_VENTAS);
    const req = store.delete(operationId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Actualiza el estado de una venta cuando el servidor devuelve un error de validación/stock. */
export async function marcarVentaConError(operationId: string, motivo: string): Promise<void> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite');
    const store = tx.objectStore(STORE_VENTAS);
    const getReq = store.get(operationId);

    getReq.onsuccess = () => {
      const venta = getReq.result as VentaOfflineLocal;
      if (!venta) {
        resolve();
        return;
      }
      venta.estadoSync = 'ERROR';
      venta.motivoError = motivo;
      const putReq = store.put(venta);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Guarda el catálogo de productos en caché para posibilitar navegación offline. */
export async function guardarCatalogoLocal(productos: Producto[]): Promise<void> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOGO, 'readwrite');
    const store = tx.objectStore(STORE_CATALOGO);
    store.clear(); // Reemplazar con el catálogo fresco
    for (const prod of productos) {
      store.put(prod);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lee el catálogo desde la caché local cuando ms-inventario no responde. */
export async function obtenerCatalogoLocal(): Promise<Producto[]> {
  const db = await abrirBd();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOGO, 'readonly');
    const store = tx.objectStore(STORE_CATALOGO);
    const req = store.getAll();

    req.onsuccess = () => resolve((req.result as Producto[]) || []);
    req.onerror = () => reject(req.error);
  });
}

