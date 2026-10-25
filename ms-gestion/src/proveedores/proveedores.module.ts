import { Module } from '@nestjs/common';
import { CrearProveedor, EditarProveedor, ListarProveedores, ObtenerProveedor } from './aplicacion/proveedores.casos-de-uso.js';
import { PROVEEDOR_REPOSITORY } from './dominio/proveedor.repository.js';
import { MongoProveedorRepository } from './infraestructura/mongo-proveedor.repository.js';
import { ProveedoresResolver } from './interfaces/proveedores.resolver.js';

/**
 * Bounded context Proveedores. CU05 – Gestionar proveedores: agregado Proveedor, value object NIT,
 * repositorio Mongo (colección proveedores).
 *
 * Capas (DDD): dominio/ → aplicacion/ → infraestructura/ · interfaces/
 */
@Module({
  providers: [
    ProveedoresResolver,
    ListarProveedores,
    ObtenerProveedor,
    CrearProveedor,
    EditarProveedor,
    { provide: PROVEEDOR_REPOSITORY, useClass: MongoProveedorRepository },
  ],
})
export class ProveedoresModule {}
