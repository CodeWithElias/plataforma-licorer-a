import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './compartido/auth/auth.module.js';
import { MongoModule } from './compartido/mongo/mongo.module.js';
import { HealthController } from './health/health.controller.js';
import { SaludResolver } from './health/salud.resolver.js';
import { ComprasModule } from './compras/compras.module.js';
import { ContabilidadModule } from './contabilidad/contabilidad.module.js';
import { ProveedoresModule } from './proveedores/proveedores.module.js';
import { ReportesModule } from './reportes/reportes.module.js';

@Module({
  imports: [
    // Esquema primero: el contrato es schema.graphql (raíz del proyecto)
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: [join(process.cwd(), 'schema.graphql')],
      path: '/graphql',
      context: ({ req }: { req: unknown }) => ({ req }),   // el guard lee el token de req
    }),
    // Compartido
    MongoModule,
    AuthModule,
    // Bounded contexts (DDD)
    ProveedoresModule,
    ContabilidadModule,
    ComprasModule,
    ReportesModule,
  ],
  controllers: [HealthController],
  providers: [SaludResolver],
})
export class AppModule {}
