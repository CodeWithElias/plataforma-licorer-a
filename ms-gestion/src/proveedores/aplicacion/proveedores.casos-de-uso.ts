import { Inject, Injectable } from '@nestjs/common';
import { type DatosProveedor, Proveedor, ProveedorNoEncontrado } from '../dominio/proveedor.js';
import { PROVEEDOR_REPOSITORY, type ProveedorRepository } from '../dominio/proveedor.repository.js';

@Injectable()
export class ListarProveedores {
  constructor(@Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository) {}

  ejecutar(activo?: boolean | null): Promise<Proveedor[]> {
    return this.proveedores.listar(activo);
  }
}

@Injectable()
export class ObtenerProveedor {
  constructor(@Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository) {}

  async ejecutar(id: string): Promise<Proveedor> {
    return (await this.proveedores.buscarPorId(id)) ?? Promise.reject(new ProveedorNoEncontrado(id));
  }
}

@Injectable()
export class CrearProveedor {
  constructor(@Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository) {}

  ejecutar(datos: DatosProveedor): Promise<Proveedor> {
    return this.proveedores.guardar(Proveedor.crear(datos));   // NIT_DUPLICADO lo detecta el índice único
  }
}

@Injectable()
export class EditarProveedor {
  constructor(@Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository) {}

  async ejecutar(id: string, datos: DatosProveedor): Promise<Proveedor> {
    const actual = await this.proveedores.buscarPorId(id);
    if (!actual) throw new ProveedorNoEncontrado(id);
    const editado = actual.editar(datos);
    await this.proveedores.actualizar(editado);
    return editado;
  }
}
