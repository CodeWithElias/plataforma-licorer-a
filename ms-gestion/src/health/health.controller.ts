import { Controller, Get, HttpStatus, OnModuleDestroy, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MongoClient } from 'mongodb';

/**
 * GET /health: estado del servicio y de su conexión a MongoDB (Atlas).
 */
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private cliente?: MongoClient;

  @Get()
  async health(@Res({ passthrough: true }) res: Response) {
    const mongodb = await this.estadoMongo();
    const up = mongodb.status === 'UP';
    res.status(up ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: up ? 'UP' : 'DOWN', servicio: 'ms-gestion', components: { mongodb } };
  }

  async onModuleDestroy() {
    await this.cliente?.close();
  }

  private async estadoMongo() {
    const url = process.env.MONGO_URL;
    if (!url) return { status: 'DOWN', error: 'Falta MONGO_URL' };
    try {
      this.cliente ??= new MongoClient(url, { serverSelectionTimeoutMS: 5000 });
      const db = this.cliente.db(process.env.MONGO_DB ?? 'gestion');
      await db.command({ ping: 1 });
      const colecciones = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
      return { status: 'UP', base: db.databaseName, colecciones };
    } catch (e) {
      return { status: 'DOWN', error: e instanceof Error ? e.message : String(e) };
    }
  }
}
