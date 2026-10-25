import { DatosInvalidos, ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';
import { Nit } from './nit.js';

export interface Contacto {
  nombre?: string;
  telefono?: string;
  email?: string;
}

export interface DatosProveedor {
  nit: string;
  razonSocial: string;
  contacto?: Contacto | null;
  productos?: string[] | null;
  activo?: boolean | null;
}

export class ProveedorNoEncontrado extends ErrorDeDominio {
  constructor(id: string) {
    super('PROVEEDOR_NO_ENCONTRADO', `No existe el proveedor ${id}`);
  }
}

export class NitDuplicado extends ErrorDeDominio {
  constructor(nit: string) {
    super('NIT_DUPLICADO', `Ya existe un proveedor con NIT ${nit}`);
  }
}

/** Agregado Proveedor (CU05). Los productos son códigos de ms-inventario. */
export class Proveedor {
  private constructor(
    readonly id: string | null,
    readonly nit: Nit,
    readonly razonSocial: string,
    readonly contacto: Contacto | null,
    readonly productos: string[],
    readonly activo: boolean,
  ) {}

  static crear(datos: DatosProveedor): Proveedor {
    return Proveedor.validar(null, datos);
  }

  static desde(id: string, datos: DatosProveedor): Proveedor {
    return new Proveedor(id, Nit.de(datos.nit), datos.razonSocial, datos.contacto ?? null, datos.productos ?? [], datos.activo ?? true);
  }

  editar(datos: DatosProveedor): Proveedor {
    return Proveedor.validar(this.id, { ...datos, activo: datos.activo ?? this.activo });
  }

  conId(id: string): Proveedor {
    return new Proveedor(id, this.nit, this.razonSocial, this.contacto, this.productos, this.activo);
  }

  private static validar(id: string | null, datos: DatosProveedor): Proveedor {
    const razonSocial = (datos.razonSocial ?? '').trim();
    if (!razonSocial) throw new DatosInvalidos('La razón social es obligatoria');
    const email = datos.contacto?.email?.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new DatosInvalidos('El email de contacto no es válido');
    const productos = [...new Set((datos.productos ?? []).map((p) => p.trim().toUpperCase()).filter(Boolean))];
    return new Proveedor(id, Nit.de(datos.nit), razonSocial, datos.contacto ?? null, productos, datos.activo ?? true);
  }
}
