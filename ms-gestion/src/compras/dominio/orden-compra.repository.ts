import type { EstadoOrden, OrdenCompra } from './orden-compra.js';

export const ORDEN_COMPRA_REPOSITORY = Symbol('OrdenCompraRepository');

/** Otra orden ya tiene ese número. */
export class NumeroDuplicado extends Error {}

export interface OrdenCompraRepository {
  listar(estado?: EstadoOrden | null): Promise<OrdenCompra[]>;
  /** @throws NumeroDuplicado */
  guardar(orden: OrdenCompra): Promise<OrdenCompra>;
}
