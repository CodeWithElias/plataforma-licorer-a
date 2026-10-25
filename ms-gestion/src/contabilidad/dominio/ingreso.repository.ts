import type { Ingreso } from './ingreso.js';

export const INGRESO_REPOSITORY = Symbol('IngresoRepository');

/** Otro proceso ya guardó un ingreso con el mismo operationId. */
export class IngresoDuplicado extends Error {}

export interface IngresoRepository {
  buscarPorOperationId(operationId: string): Promise<Ingreso | null>;
  /** Inserta un ingreso nuevo. @throws IngresoDuplicado si el operationId ya existe */
  guardar(ingreso: Ingreso): Promise<Ingreso>;
  actualizarEstado(ingreso: Ingreso): Promise<void>;
}
