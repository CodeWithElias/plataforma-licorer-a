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

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Orden de compra a un proveedor (CU06). Regla: total = suma de cantidad × precio unitario de sus líneas. */
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
  static desde(d: { id: string; numero: string; proveedorId: string; fecha: Date; estado: EstadoOrden; origen: OrigenOrden; lineas: LineaOrden[]; total: number }): OrdenCompra {
    return new OrdenCompra(d.id, d.numero, d.proveedorId, d.fecha, d.estado, d.origen, d.lineas, d.total);
  }

  conId(id: string): OrdenCompra {
    return new OrdenCompra(id, this.numero, this.proveedorId, this.fecha, this.estado, this.origen, this.lineas, this.total);
  }
}
