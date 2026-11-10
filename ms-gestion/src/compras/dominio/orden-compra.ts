import { DatosInvalidos, ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';

export type EstadoOrden = 'BORRADOR' | 'ENVIADA' | 'RECIBIDA' | 'ANULADA';
export type OrigenOrden = 'MANUAL' | 'AGENTE';

export interface LineaOrden {
  productoCodigo: string;
  cantidad: number;
  precioUnitario: number;
}

export class ProveedorNoDisponible extends ErrorDeDominio {
  constructor(proveedorId: string) {
    super('PROVEEDOR_NO_DISPONIBLE', `El proveedor ${proveedorId} no existe o está inactivo`);
  }
}

export class OrdenNoEncontrada extends ErrorDeDominio {
  constructor(id: string) {
    super('ORDEN_NO_ENCONTRADA', `No existe la orden de compra ${id}`);
  }
}

export class TransicionInvalida extends ErrorDeDominio {
  constructor(numero: string, estado: EstadoOrden, accion: string) {
    super('TRANSICION_INVALIDA', `La orden ${numero} está ${estado.toLowerCase()} y no se puede ${accion}`);
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Orden de compra a un proveedor (CU06). Regla: total = suma de cantidad × precio unitario de sus líneas.
 *
 * Ciclo de vida: BORRADOR → ENVIADA → RECIBIDA. Se puede ANULAR mientras no se haya recibido.
 * Al recibirla se suma su mercadería al stock de ms-inventario, línea por línea; `lineasRepuestas` guarda
 * los índices de las líneas ya sumadas para que un reintento no las sume dos veces.
 */
export class OrdenCompra {
  private constructor(
    readonly id: string | null,
    readonly numero: string,
    readonly proveedorId: string,
    readonly fecha: Date,
    readonly estado: EstadoOrden,
    readonly origen: OrigenOrden,
    readonly lineas: LineaOrden[],
    readonly total: number,
    readonly lineasRepuestas: number[] = [],
    readonly fechaRecepcion: Date | null = null,
  ) {}

  /** Toda orden nace en BORRADOR, también la del agente: el gerente la revisa antes de enviarla. */
  static nueva(datos: { proveedorId: string; origen: OrigenOrden; lineas: LineaOrden[] }, numero: string, ahora = new Date()): OrdenCompra {
    if (!datos.proveedorId?.trim()) throw new DatosInvalidos('proveedorId es obligatorio');
    if (!datos.lineas?.length) throw new DatosInvalidos('La orden debe tener al menos una línea');

    const lineas = datos.lineas.map((l) => {
      const productoCodigo = l.productoCodigo?.trim().toUpperCase();
      if (!productoCodigo) throw new DatosInvalidos('productoCodigo es obligatorio');
      if (!Number.isInteger(l.cantidad) || l.cantidad < 1) throw new DatosInvalidos(`La cantidad de ${productoCodigo} debe ser un entero mayor a 0`);
      if (!(l.precioUnitario >= 0)) throw new DatosInvalidos(`El precio de ${productoCodigo} no puede ser negativo`);
      return { productoCodigo, cantidad: l.cantidad, precioUnitario: redondear(l.precioUnitario) };
    });
    const total = redondear(lineas.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0));
    return new OrdenCompra(null, numero, datos.proveedorId, ahora, 'BORRADOR', datos.origen, lineas, total);
  }

  /** Reconstruye una orden guardada. */
  static desde(d: {
    id: string; numero: string; proveedorId: string; fecha: Date; estado: EstadoOrden; origen: OrigenOrden;
    lineas: LineaOrden[]; total: number; lineasRepuestas?: number[]; fechaRecepcion?: Date | null;
  }): OrdenCompra {
    return new OrdenCompra(d.id, d.numero, d.proveedorId, d.fecha, d.estado, d.origen, d.lineas, d.total,
      d.lineasRepuestas ?? [], d.fechaRecepcion ?? null);
  }

  conId(id: string): OrdenCompra {
    return this.con({ id });
  }

  /** El gerente la manda al proveedor. */
  enviar(): OrdenCompra {
    if (this.estado !== 'BORRADOR') throw new TransicionInvalida(this.numero, this.estado, 'enviar');
    return this.con({ estado: 'ENVIADA' });
  }

  /** Se cancela: no hubo compra. Una orden recibida ya movió el stock y no se puede anular. */
  anular(): OrdenCompra {
    if (this.estado !== 'BORRADOR' && this.estado !== 'ENVIADA') throw new TransicionInvalida(this.numero, this.estado, 'anular');
    return this.con({ estado: 'ANULADA' });
  }

  /** Solo se recibe lo que se pidió al proveedor. */
  validarRecepcion(): void {
    if (this.estado !== 'ENVIADA') throw new TransicionInvalida(this.numero, this.estado, 'recibir');
  }

  /** Líneas cuya mercadería todavía no se sumó al stock (con su índice). */
  lineasPorReponer(): { indice: number; linea: LineaOrden }[] {
    return this.lineas
      .map((linea, indice) => ({ indice, linea }))
      .filter(({ indice }) => !this.lineasRepuestas.includes(indice));
  }

  private con(cambios: Partial<{ id: string; estado: EstadoOrden }>): OrdenCompra {
    return new OrdenCompra(cambios.id ?? this.id, this.numero, this.proveedorId, this.fecha, cambios.estado ?? this.estado,
      this.origen, this.lineas, this.total, this.lineasRepuestas, this.fechaRecepcion);
  }
}
