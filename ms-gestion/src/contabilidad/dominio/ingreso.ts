import { DatosInvalidos, ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';

export type EstadoIngreso = 'ACTIVO' | 'ANULADO';

export class IngresoNoEncontrado extends ErrorDeDominio {
  constructor(operationId: string) {
    super('INGRESO_NO_ENCONTRADO', `No existe un ingreso con operationId ${operationId}`);
  }
}

/**
 * Ingreso de caja de una venta (paso 3 de la Saga). Se identifica por el operationId de la venta,
 * así registrar o anular dos veces el mismo no tiene efecto (idempotencia).
 */
export class Ingreso {
  private constructor(
    readonly id: string | null,
    readonly operationId: string,
    readonly ventaId: string,
    readonly monto: number,
    readonly fecha: Date,
    readonly estado: EstadoIngreso,
  ) {}

  static registrar(datos: { operationId: string; ventaId: string; monto: number }, ahora = new Date()): Ingreso {
    if (!datos.operationId?.trim()) throw new DatosInvalidos('operationId es obligatorio');
    if (!datos.ventaId?.trim()) throw new DatosInvalidos('ventaId es obligatorio');
    if (!(datos.monto > 0)) throw new DatosInvalidos('El monto debe ser mayor a 0');
    return new Ingreso(null, datos.operationId, datos.ventaId, Math.round(datos.monto * 100) / 100, ahora, 'ACTIVO');
  }

  /** Reconstruye un ingreso guardado. */
  static desde(datos: { id: string; operationId: string; ventaId: string; monto: number; fecha: Date; estado: EstadoIngreso }): Ingreso {
    return new Ingreso(datos.id, datos.operationId, datos.ventaId, datos.monto, datos.fecha, datos.estado);
  }

  /** Compensación de la Saga. Anular uno ya anulado no cambia nada. */
  anular(): Ingreso {
    return this.estado === 'ANULADO'
      ? this
      : new Ingreso(this.id, this.operationId, this.ventaId, this.monto, this.fecha, 'ANULADO');
  }

  conId(id: string): Ingreso {
    return new Ingreso(id, this.operationId, this.ventaId, this.monto, this.fecha, this.estado);
  }
}
