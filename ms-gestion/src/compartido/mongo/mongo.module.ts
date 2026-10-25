import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

/** Token de inyección de la base `gestion`: `@Inject(MONGO_DB) private db: Db`. */
export const MONGO_DB = Symbol('MONGO_DB');
const MONGO_CLIENTE = Symbol('MONGO_CLIENTE');

@Injectable()
class CierreMongo implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENTE) private readonly cliente: MongoClient) {}

  async onApplicationShutdown() {
    await this.cliente.close();
  }
}

/**
 * Conexión compartida a MongoDB (Atlas). La conexión se abre en la primera operación,
 * así el servicio arranca aunque Atlas tarde en responder.
 * Los repositorios de cada bounded context reciben la base con @Inject(MONGO_DB).
 */
@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENTE,
      useFactory: () => new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017', { serverSelectionTimeoutMS: 5000 }),
    },
    {
      provide: MONGO_DB,
      inject: [MONGO_CLIENTE],
      useFactory: (cliente: MongoClient): Db => cliente.db(process.env.MONGO_DB ?? 'gestion'),
    },
    CierreMongo,
  ],
  exports: [MONGO_DB],
})
export class MongoModule {}
