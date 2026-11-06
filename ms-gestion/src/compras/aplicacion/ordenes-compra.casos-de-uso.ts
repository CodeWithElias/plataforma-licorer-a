import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PROVEEDOR_REPOSITORY, type ProveedorRepository } from '../../proveedores/dominio/proveedor.repository.js';
import { type EstadoOrden, type LineaOrden, OrdenCompra, type OrigenOrden, ProveedorNoDisponible } from '../dominio/orden-compra.js';
import { NumeroDuplicado, ORDEN_COMPRA_REPOSITORY, type OrdenCompraRepository } from '../dominio/orden-compra.repository.js';

const INTENTOS_NUMERO = 3;

/** OC-AAAAMMDD-NNNN. El índice único de `numero` resuelve el caso raro de que se repita. */
function nuevoNumero(ahora: Date): string {
  const dia = ahora.toISOString().slice(0, 10).replaceAll('-', '');
  return `OC-${dia}-${String(randomInt(10000)).padStart(4, '0')}`;
}

/** CU06: la crea el agente de reabastecimiento (tool MCP crear_orden_compra) o el gerente. */
@Injectable()
export class CrearOrdenCompra {
  constructor(
    @Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository,
    @Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository,
  ) {}

  async ejecutar(datos: { proveedorId: string; origen: OrigenOrden; lineas: LineaOrden[] }): Promise<OrdenCompra> {
    const ahora = new Date();
    OrdenCompra.nueva(datos, 'validacion', ahora);   // valida antes de consultar al proveedor

    const proveedor = await this.proveedores.buscarPorId(datos.proveedorId);
    if (!proveedor?.activo) throw new ProveedorNoDisponible(datos.proveedorId);

    for (let intento = 1; ; intento++) {
      try {
        return await this.ordenes.guardar(OrdenCompra.nueva(datos, nuevoNumero(ahora), ahora));
      } catch (e) {
        if (!(e instanceof NumeroDuplicado) || intento === INTENTOS_NUMERO) throw e;
      }
    }
  }
}

@Injectable()
export class ListarOrdenesCompra {
  constructor(@Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository) {}

  ejecutar(estado?: EstadoOrden | null): Promise<OrdenCompra[]> {
    return this.ordenes.listar(estado);
  }
}
