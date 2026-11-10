import type { EstadoOrden, OrdenCompra } from './orden-compra.js';

export const ORDEN_COMPRA_REPOSITORY = Symbol('OrdenCompraRepository');

/** Otra orden ya tiene ese número. */
export class NumeroDuplicado extends Error {}

export interface OrdenCompraRepository {
  listar(estado?: EstadoOrden | null): Promise<OrdenCompra[]>;
  buscarPorId(id: string): Promise<OrdenCompra | null>;
  /** @throws NumeroDuplicado */
  guardar(orden: OrdenCompra): Promise<OrdenCompra>;
  /**
   * Cambia el estado solo si sigue en `desde` (escritura condicional): si otra petición la cambió antes,
   * devuelve false y no toca nada.
   */
  cambiarEstado(id: string, desde: EstadoOrden, hacia: EstadoOrden, fechaRecepcion?: Date): Promise<boolean>;
  /**
   * Toma la recepción de la orden para que dos clics seguidos no sumen el stock dos veces. Devuelve false si
   * otra recepción está en curso. Una toma de hace más de `vencimientoMs` se considera abandonada.
   */
  tomarRecepcion(id: string, vencimientoMs: number): Promise<boolean>;
  soltarRecepcion(id: string): Promise<void>;
  /** Registra que la línea `indice` ya se sumó al stock. */
  marcarLineaRepuesta(id: string, indice: number): Promise<void>;
}
