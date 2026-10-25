import { Inject, Injectable } from '@nestjs/common';
import { Ingreso } from '../dominio/ingreso.js';
import { INGRESO_REPOSITORY, IngresoDuplicado, type IngresoRepository } from '../dominio/ingreso.repository.js';

/** Paso 3 de la Saga de ventas. Idempotente: si el operationId ya existe devuelve ese ingreso. */
@Injectable()
export class RegistrarIngreso {
  constructor(@Inject(INGRESO_REPOSITORY) private readonly ingresos: IngresoRepository) {}

  async ejecutar(datos: { operationId: string; ventaId: string; monto: number }): Promise<Ingreso> {
    const existente = await this.ingresos.buscarPorOperationId(datos.operationId);
    if (existente) return existente;

    try {
      return await this.ingresos.guardar(Ingreso.registrar(datos));
    } catch (e) {
      // Dos peticiones con el mismo operationId a la vez: gana la primera
      if (e instanceof IngresoDuplicado) {
        return (await this.ingresos.buscarPorOperationId(datos.operationId))!;
      }
      throw e;
    }
  }
}
