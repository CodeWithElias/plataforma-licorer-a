import { Inject, Injectable } from '@nestjs/common';
import { type Ingreso, IngresoNoEncontrado } from '../dominio/ingreso.js';
import { INGRESO_REPOSITORY, type IngresoRepository } from '../dominio/ingreso.repository.js';

/**
 * Compensación del paso 3 de la Saga. Idempotente: anular uno ya anulado no cambia nada.
 * Si no existe responde INGRESO_NO_ENCONTRADO, que ms-ventas toma como compensación hecha.
 */
@Injectable()
export class AnularIngreso {
  constructor(@Inject(INGRESO_REPOSITORY) private readonly ingresos: IngresoRepository) {}

  async ejecutar(operationId: string): Promise<Ingreso> {
    const ingreso = await this.ingresos.buscarPorOperationId(operationId);
    if (!ingreso) throw new IngresoNoEncontrado(operationId);
    if (ingreso.estado === 'ANULADO') return ingreso;

    const anulado = ingreso.anular();
    await this.ingresos.actualizarEstado(anulado);
    return anulado;
  }
}
