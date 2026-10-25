import type { Proveedor } from './proveedor.js';

export const PROVEEDOR_REPOSITORY = Symbol('ProveedorRepository');

export interface ProveedorRepository {
  listar(activo?: boolean | null): Promise<Proveedor[]>;
  buscarPorId(id: string): Promise<Proveedor | null>;
  /** @throws NitDuplicado */
  guardar(proveedor: Proveedor): Promise<Proveedor>;
  /** @throws NitDuplicado */
  actualizar(proveedor: Proveedor): Promise<void>;
}
