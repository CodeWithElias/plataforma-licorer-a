import { ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';

export const INVENTARIO = Symbol('Inventario');

export class InventarioNoDisponible extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('INVENTARIO_NO_DISPONIBLE', mensaje);
  }
}

/** Puerto hacia ms-inventario: entrada de mercadería al recibir una orden de compra. */
export interface Inventario {
  /**
   * Suma unidades al stock del producto (POST /stock/{codigo}/reposiciones).
   * @param token token del gerente; ms-inventario exige rol GERENTE o ALMACEN
   * @throws InventarioNoDisponible
   */
  reponer(productoCodigo: string, cantidad: number, token: string): Promise<void>;
}
