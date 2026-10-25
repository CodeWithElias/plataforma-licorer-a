import { Inject, Injectable } from '@nestjs/common';
import { type Db, Decimal128, MongoServerError, ObjectId } from 'mongodb';
import { MONGO_DB } from '../../compartido/mongo/mongo.module.js';
import { Ingreso, type EstadoIngreso } from '../dominio/ingreso.js';
import { IngresoDuplicado, type IngresoRepository } from '../dominio/ingreso.repository.js';

interface DocIngreso {
  _id?: ObjectId;
  operationId: string;
  ventaId: string;
  monto: Decimal128;
  fecha: Date;
  estado: EstadoIngreso;
}

/** Colección `ingresos` (índice único en operationId, ver db/gestion.js). */
@Injectable()
export class MongoIngresoRepository implements IngresoRepository {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private get coleccion() {
    return this.db.collection<DocIngreso>('ingresos');
  }

  async buscarPorOperationId(operationId: string): Promise<Ingreso | null> {
    const doc = await this.coleccion.findOne({ operationId });
    return doc ? this.aIngreso(doc) : null;
  }

  async guardar(ingreso: Ingreso): Promise<Ingreso> {
    try {
      const r = await this.coleccion.insertOne({
        operationId: ingreso.operationId,
        ventaId: ingreso.ventaId,
        monto: Decimal128.fromString(ingreso.monto.toFixed(2)),
        fecha: ingreso.fecha,
        estado: ingreso.estado,
      });
      return ingreso.conId(r.insertedId.toHexString());
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) throw new IngresoDuplicado(ingreso.operationId);
      throw e;
    }
  }

  async actualizarEstado(ingreso: Ingreso): Promise<void> {
    await this.coleccion.updateOne({ operationId: ingreso.operationId }, { $set: { estado: ingreso.estado } });
  }

  private aIngreso(doc: DocIngreso): Ingreso {
    return Ingreso.desde({
      id: doc._id!.toHexString(),
      operationId: doc.operationId,
      ventaId: doc.ventaId,
      monto: Number(doc.monto.toString()),
      fecha: doc.fecha,
      estado: doc.estado,
    });
  }
}
