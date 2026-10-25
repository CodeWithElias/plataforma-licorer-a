import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../../compartido/auth/decoradores.js';
import { conErroresGraphql } from '../../compartido/interfaces/errores-graphql.js';
import { CrearProveedor, EditarProveedor, ListarProveedores, ObtenerProveedor } from '../aplicacion/proveedores.casos-de-uso.js';
import type { DatosProveedor, Proveedor } from '../dominio/proveedor.js';

/** CU05 – Gestionar proveedores (GERENTE o ADMIN). */
@Roles('GERENTE', 'ADMIN')
@Resolver('Proveedor')
export class ProveedoresResolver {
  constructor(
    private readonly listar: ListarProveedores,
    private readonly obtener: ObtenerProveedor,
    private readonly crear: CrearProveedor,
    private readonly editar: EditarProveedor,
  ) {}

  @Query()
  proveedores(@Args('activo') activo?: boolean) {
    return conErroresGraphql(async () => (await this.listar.ejecutar(activo)).map(aGraphql));
  }

  @Query()
  proveedor(@Args('id') id: string) {
    return conErroresGraphql(async () => aGraphql(await this.obtener.ejecutar(id)));
  }

  @Mutation()
  crearProveedor(@Args('input') input: DatosProveedor) {
    return conErroresGraphql(async () => aGraphql(await this.crear.ejecutar(input)));
  }

  @Mutation()
  editarProveedor(@Args('id') id: string, @Args('input') input: DatosProveedor) {
    return conErroresGraphql(async () => aGraphql(await this.editar.ejecutar(id, input)));
  }
}

function aGraphql(p: Proveedor) {
  return { id: p.id, nit: p.nit.valor, razonSocial: p.razonSocial, contacto: p.contacto, productos: p.productos, activo: p.activo };
}
