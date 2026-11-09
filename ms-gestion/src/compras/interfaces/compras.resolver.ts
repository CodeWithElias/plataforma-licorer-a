import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles } from '../../compartido/auth/decoradores.js';
import { conErroresGraphql } from '../../compartido/interfaces/errores-graphql.js';
import { CrearOrdenCompra, ListarOrdenesCompra } from '../aplicacion/ordenes-compra.casos-de-uso.js';
import type { EstadoOrden, LineaOrden, OrdenCompra, OrigenOrden } from '../dominio/orden-compra.js';

/** CU06 – Órdenes de compra. La mutation la llama el agente con el token de n8n (rol GERENTE). */
@Roles('GERENTE', 'ADMIN')
@Resolver('OrdenCompra')
export class ComprasResolver {
  constructor(
    private readonly crear: CrearOrdenCompra,
    private readonly listar: ListarOrdenesCompra,
  ) {}

  @Query()
  ordenesCompra(@Args('estado') estado?: EstadoOrden | null) {
    return conErroresGraphql(async () => (await this.listar.ejecutar(estado)).map(aGraphql));
  }

  @Mutation()
  crearOrdenCompra(@Args('input') input: { proveedorId: string; origen: OrigenOrden; lineas: LineaOrden[] }) {
    return conErroresGraphql(async () => aGraphql(await this.crear.ejecutar(input)));
  }
}

function aGraphql(o: OrdenCompra) {
  return {
    id: o.id,
    numero: o.numero,
    proveedorId: o.proveedorId,
    fecha: o.fecha.toISOString(),
    estado: o.estado,
    origen: o.origen,
    lineas: o.lineas,
    total: o.total,
  };
}
