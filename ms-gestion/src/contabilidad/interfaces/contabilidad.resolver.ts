import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Roles } from '../../compartido/auth/decoradores.js';
import { conErroresGraphql } from '../../compartido/interfaces/errores-graphql.js';
import { AnularIngreso } from '../aplicacion/anular-ingreso.js';
import { RegistrarIngreso } from '../aplicacion/registrar-ingreso.js';
import type { Ingreso } from '../dominio/ingreso.js';

/** Mutations que llama ms-ventas en la Saga (reenvía el token del cajero). */
@Resolver('Ingreso')
export class ContabilidadResolver {
  constructor(
    private readonly registrar: RegistrarIngreso,
    private readonly anular: AnularIngreso,
  ) {}

  @Roles('CAJERO')
  @Mutation()
  registrarIngreso(@Args('input') input: { operationId: string; ventaId: string; monto: number }) {
    return conErroresGraphql(async () => aGraphql(await this.registrar.ejecutar(input)));
  }

  @Roles('CAJERO')
  @Mutation()
  anularIngreso(@Args('operationId') operationId: string) {
    return conErroresGraphql(async () => aGraphql(await this.anular.ejecutar(operationId)));
  }
}

function aGraphql(i: Ingreso) {
  return { id: i.id, operationId: i.operationId, ventaId: i.ventaId, monto: i.monto, fecha: i.fecha.toISOString(), estado: i.estado };
}
