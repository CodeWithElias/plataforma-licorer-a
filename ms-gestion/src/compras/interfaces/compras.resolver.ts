import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles, TokenActual } from '../../compartido/auth/decoradores.js';
import { conErroresGraphql } from '../../compartido/interfaces/errores-graphql.js';
import {
  AnularOrdenCompra, CrearOrdenCompra, EnviarOrdenCompra, ListarOrdenesCompra, RecibirOrdenCompra,
} from '../aplicacion/ordenes-compra.casos-de-uso.js';
import type { EstadoOrden, LineaOrden, OrdenCompra, OrigenOrden } from '../dominio/orden-compra.js';

/** CU06 – Órdenes de compra. crearOrdenCompra la llama el agente con el token de n8n (rol GERENTE). */
@Roles('GERENTE', 'ADMIN')
@Resolver('OrdenCompra')
export class ComprasResolver {
  constructor(
    private readonly crear: CrearOrdenCompra,
    private readonly listar: ListarOrdenesCompra,
    private readonly enviar: EnviarOrdenCompra,
    private readonly anular: AnularOrdenCompra,
    private readonly recibir: RecibirOrdenCompra,
  ) {}

  @Query()
  ordenesCompra(@Args('estado') estado?: EstadoOrden | null) {
    return conErroresGraphql(async () => (await this.listar.ejecutar(estado)).map(aGraphql));
  }

  @Mutation()
  crearOrdenCompra(@Args('input') input: { proveedorId: string; origen: OrigenOrden; lineas: LineaOrden[] }) {
    return conErroresGraphql(async () => aGraphql(await this.crear.ejecutar(input)));
  }

  @Mutation()
  enviarOrdenCompra(@Args('id') id: string) {
    return conErroresGraphql(async () => aGraphql(await this.enviar.ejecutar(id)));
  }

  @Mutation()
  anularOrdenCompra(@Args('id') id: string) {
    return conErroresGraphql(async () => aGraphql(await this.anular.ejecutar(id)));
  }

  // Solo GERENTE: el token se reenvía a ms-inventario, que exige GERENTE o ALMACEN para reponer stock
  @Roles('GERENTE')
  @Mutation()
  recibirOrdenCompra(@Args('id') id: string, @TokenActual() token: string) {
    return conErroresGraphql(async () => aGraphql(await this.recibir.ejecutar(id, token)));
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
    fechaRecepcion: o.fechaRecepcion?.toISOString() ?? null,
    lineasRepuestas: o.lineasRepuestas,
  };
}
