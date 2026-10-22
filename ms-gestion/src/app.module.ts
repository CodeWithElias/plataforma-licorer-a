import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HealthController } from './health/health.controller.js';
import { SaludResolver } from './health/salud.resolver.js';

@Module({
  imports: [
    // Esquema primero: el contrato es schema.graphql (raíz del proyecto)
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: [join(process.cwd(), 'schema.graphql')],
      path: '/graphql',
    }),
  ],
  controllers: [HealthController],
  providers: [SaludResolver],
})
export class AppModule {}
