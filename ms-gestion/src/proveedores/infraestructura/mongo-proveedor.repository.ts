import { Inject, Injectable } from '@nestjs/common';
import { type Db, type Filter, MongoServerError, ObjectId } from 'mongodb';
import { MONGO_DB } from '../../compartido/mongo/mongo.module.js';
import { type Contacto, NitDuplicado, Proveedor } from '../dominio/proveedor.js';
import type { ProveedorRepository } from '../dominio/proveedor.repository.js';

interface DocProveedor {
  _id?: ObjectId;
  nit: string;
  razonSocial: string;
  contacto?: Contacto;
  productos: string[];
  activo: boolean;
}

/** Colección `proveedores` (índice único en nit, ver db/gestion.js). */
@Injectable()
export class MongoProveedorRepository implements ProveedorRepository {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private get coleccion() {
    return this.db.collection<DocProveedor>('proveedores');
  }

  async listar(activo?: boolean | null): Promise<Proveedor[]> {
    const filtro: Filter<DocProveedor> = activo === undefined || activo === null ? {} : { activo };
    const docs = await this.coleccion.find(filtro).sort({ razonSocial: 1 }).toArray();
    return docs.map((d) => this.aProveedor(d));
  }

  async buscarPorId(id: string): Promise<Proveedor | null> {
    if (!ObjectId.isValid(id)) return null;
    const doc = await this.coleccion.findOne({ _id: new ObjectId(id) });
    return doc ? this.aProveedor(doc) : null;
  }

  async guardar(p: Proveedor): Promise<Proveedor> {
    try {
      const r = await this.coleccion.insertOne(this.aDoc(p));
      return p.conId(r.insertedId.toHexString());
    } catch (e) {
      throw this.traducir(e, p);
    }
  }

  async actualizar(p: Proveedor): Promise<void> {
    try {
      await this.coleccion.updateOne({ _id: new ObjectId(p.id!) }, { $set: this.aDoc(p) });
    } catch (e) {
      throw this.traducir(e, p);
    }
  }

  private aDoc(p: Proveedor): DocProveedor {
    const doc: DocProveedor = { nit: p.nit.valor, razonSocial: p.razonSocial, productos: p.productos, activo: p.activo };
    if (p.contacto) {
      // El validador de Mongo no acepta null en los campos opcionales
      doc.contacto = Object.fromEntries(Object.entries(p.contacto).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    }
    return doc;
  }

  private aProveedor(d: DocProveedor): Proveedor {
    return Proveedor.desde(d._id!.toHexString(), d);
  }

  private traducir(e: unknown, p: Proveedor): unknown {
    return e instanceof MongoServerError && e.code === 11000 ? new NitDuplicado(p.nit.valor) : e;
  }
}
