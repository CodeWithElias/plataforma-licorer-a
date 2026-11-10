import { Inject, Injectable } from '@nestjs/common';
import { type Db, Decimal128, MongoServerError, ObjectId } from 'mongodb';
import { MONGO_DB } from '../../compartido/mongo/mongo.module.js';
import { type EstadoOrden, OrdenCompra, type OrigenOrden } from '../dominio/orden-compra.js';
import { NumeroDuplicado, type OrdenCompraRepository } from '../dominio/orden-compra.repository.js';

interface DocLinea {
  productoCodigo: string;
  cantidad: number;
  precioUnitario: Decimal128;
}

interface DocOrden {
  _id?: ObjectId;
  numero: string;
  proveedorId: ObjectId;
  fecha: Date;
  estado: EstadoOrden;
  origen: OrigenOrden;
  lineas: DocLinea[];
  total: Decimal128;
  lineasRepuestas?: number[];
  fechaRecepcion?: Date;
  /** Marca de la recepción en curso (ver tomarRecepcion) */
  recibiendoDesde?: Date;
}

const decimal = (n: number) => Decimal128.fromString(n.toFixed(2));

/** Un id mal formado es una orden que no existe, no un error del servidor. */
const objectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/** Colección `ordenes_compra` (validador e índice único en numero, ver db/gestion.js). */
@Injectable()
export class MongoOrdenCompraRepository implements OrdenCompraRepository {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private get coleccion() {
    return this.db.collection<DocOrden>('ordenes_compra');
  }

  async listar(estado?: EstadoOrden | null): Promise<OrdenCompra[]> {
    const docs = await this.coleccion.find(estado ? { estado } : {}).sort({ fecha: -1 }).toArray();
    return docs.map((d) => this.aOrden(d));
  }

  async buscarPorId(id: string): Promise<OrdenCompra | null> {
    const _id = objectId(id);
    const d = _id && (await this.coleccion.findOne({ _id }));
    return d ? this.aOrden(d) : null;
  }

  async guardar(orden: OrdenCompra): Promise<OrdenCompra> {
    try {
      const r = await this.coleccion.insertOne({
        numero: orden.numero,
        proveedorId: new ObjectId(orden.proveedorId),
        fecha: orden.fecha,
        estado: orden.estado,
        origen: orden.origen,
        lineas: orden.lineas.map((l) => ({ ...l, precioUnitario: decimal(l.precioUnitario) })),
        total: decimal(orden.total),
      });
      return orden.conId(r.insertedId.toHexString());
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) throw new NumeroDuplicado(orden.numero);
      throw e;
    }
  }

  async cambiarEstado(id: string, desde: EstadoOrden, hacia: EstadoOrden, fechaRecepcion?: Date): Promise<boolean> {
    const _id = objectId(id);
    if (!_id) return false;
    const r = await this.coleccion.updateOne(
      { _id, estado: desde },
      fechaRecepcion
        ? { $set: { estado: hacia, fechaRecepcion }, $unset: { recibiendoDesde: '' } }
        : { $set: { estado: hacia } },
    );
    return r.modifiedCount === 1;
  }

  async tomarRecepcion(id: string, vencimientoMs: number): Promise<boolean> {
    const _id = objectId(id);
    if (!_id) return false;
    const ahora = new Date();
    const r = await this.coleccion.updateOne(
      {
        _id,
        estado: 'ENVIADA',
        $or: [{ recibiendoDesde: { $exists: false } }, { recibiendoDesde: { $lt: new Date(ahora.getTime() - vencimientoMs) } }],
      },
      { $set: { recibiendoDesde: ahora } },
    );
    return r.modifiedCount === 1;
  }

  async soltarRecepcion(id: string): Promise<void> {
    const _id = objectId(id);
    if (_id) await this.coleccion.updateOne({ _id }, { $unset: { recibiendoDesde: '' } });
  }

  async marcarLineaRepuesta(id: string, indice: number): Promise<void> {
    const _id = objectId(id);
    if (_id) await this.coleccion.updateOne({ _id }, { $addToSet: { lineasRepuestas: indice } });
  }

  private aOrden(d: DocOrden): OrdenCompra {
    return OrdenCompra.desde({
      id: d._id!.toHexString(),
      numero: d.numero,
      proveedorId: d.proveedorId.toHexString(),
      fecha: d.fecha,
      estado: d.estado,
      origen: d.origen,
      lineas: d.lineas.map((l) => ({ ...l, precioUnitario: Number(l.precioUnitario.toString()) })),
      total: Number(d.total.toString()),
      lineasRepuestas: d.lineasRepuestas ?? [],
      fechaRecepcion: d.fechaRecepcion ?? null,
    });
  }
}
