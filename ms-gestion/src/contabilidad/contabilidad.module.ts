import { Module } from '@nestjs/common';
import { AnularIngreso } from './aplicacion/anular-ingreso.js';
import { RegistrarIngreso } from './aplicacion/registrar-ingreso.js';
import { INGRESO_REPOSITORY } from './dominio/ingreso.repository.js';
import { MongoIngresoRepository } from './infraestructura/mongo-ingreso.repository.js';
import { ContabilidadResolver } from './interfaces/contabilidad.resolver.js';

/**
 * Bounded context Contabilidad. CU02 – Ingresos de la Saga de ventas: registrarIngreso / anularIngreso,
 * idempotentes por operationId (colección ingresos).
 *
 * Capas (DDD): dominio/ → aplicacion/ → infraestructura/ · interfaces/
 */
@Module({
  providers: [
    ContabilidadResolver,
    RegistrarIngreso,
    AnularIngreso,
    { provide: INGRESO_REPOSITORY, useClass: MongoIngresoRepository },
  ],
})
export class ContabilidadModule {}
