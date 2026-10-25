import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Db } from 'mongodb';
import { Publico } from '../compartido/auth/decoradores.js';
import { MONGO_DB } from '../compartido/mongo/mongo.module.js';

/**
 * GET /health: estado del servicio y de su conexión a MongoDB (Atlas). No exige token.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  @Publico()
  @Get()
  async health(@Res({ passthrough: true }) res: Response) {
    const mongodb = await this.estadoMongo();
    const up = mongodb.status === 'UP';
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: up ? 'UP' : 'DOWN', servicio: 'ms-gestion', components: { mongodb } };
  }

  private async estadoMongo() {
    if (!process.env.MONGO_URL) return { status: 'DOWN', error: 'Falta MONGO_URL' };
    try {
      await this.db.command({ ping: 1 });
      const colecciones = (await this.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
      return { status: 'UP', base: this.db.databaseName, colecciones };
    } catch (e) {
      return { status: 'DOWN', error: e instanceof Error ? e.message : String(e) };
    }
  }
}
