import { Module } from '@nestjs/common';
import { ProveedoresModule } from '../proveedores/proveedores.module.js';
import {
  AnularOrdenCompra, CrearOrdenCompra, EnviarOrdenCompra, ListarOrdenesCompra, RecibirOrdenCompra,
} from './aplicacion/ordenes-compra.casos-de-uso.js';
import { INVENTARIO } from './dominio/inventario.js';
import { ORDEN_COMPRA_REPOSITORY } from './dominio/orden-compra.repository.js';
import { HttpInventario } from './infraestructura/http-inventario.js';
import { MongoOrdenCompraRepository } from './infraestructura/mongo-orden-compra.repository.js';
import { ComprasResolver } from './interfaces/compras.resolver.js';

/**
 * Bounded context Compras. CU06 – Órdenes de compra (manuales o creadas por el agente de reabastecimiento) (colección ordenes_compra).
 *
 * Capas (DDD): dominio/ → aplicacion/ → infraestructura/ · interfaces/
 */
@Module({
  imports: [ProveedoresModule],
  providers: [
    ComprasResolver,
    CrearOrdenCompra,
    ListarOrdenesCompra,
    EnviarOrdenCompra,
    AnularOrdenCompra,
    RecibirOrdenCompra,
    { provide: ORDEN_COMPRA_REPOSITORY, useClass: MongoOrdenCompraRepository },
    { provide: INVENTARIO, useClass: HttpInventario },
  ],
})
export class ComprasModule {}
