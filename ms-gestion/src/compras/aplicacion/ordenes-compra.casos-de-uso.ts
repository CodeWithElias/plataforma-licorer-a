import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PROVEEDOR_REPOSITORY, type ProveedorRepository } from '../../proveedores/dominio/proveedor.repository.js';
import { ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';
import { INVENTARIO, type Inventario } from '../dominio/inventario.js';
import {
  type EstadoOrden, type LineaOrden, OrdenCompra, OrdenNoEncontrada, type OrigenOrden, ProveedorNoDisponible,
} from '../dominio/orden-compra.js';
import { NumeroDuplicado, ORDEN_COMPRA_REPOSITORY, type OrdenCompraRepository } from '../dominio/orden-compra.repository.js';

export class RecepcionEnCurso extends ErrorDeDominio {
  constructor(numero: string) {
    super('RECEPCION_EN_CURSO', `La recepción de la orden ${numero} ya se está registrando; espera un momento y actualiza.`);
  }
}

export class RecepcionIncompleta extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('RECEPCION_INCOMPLETA', mensaje);
  }
}

const INTENTOS_NUMERO = 3;

/** OC-AAAAMMDD-NNNN. El índice único de `numero` resuelve el caso raro de que se repita. */
function nuevoNumero(ahora: Date): string {
  const dia = ahora.toISOString().slice(0, 10).replaceAll('-', '');
  return `OC-${dia}-${String(randomInt(10000)).padStart(4, '0')}`;
}

/** CU06: la crea el agente de reabastecimiento (tool MCP crear_orden_compra) o el gerente. */
@Injectable()
export class CrearOrdenCompra {
  constructor(
    @Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository,
    @Inject(PROVEEDOR_REPOSITORY) private readonly proveedores: ProveedorRepository,
  ) {}

  async ejecutar(datos: { proveedorId: string; origen: OrigenOrden; lineas: LineaOrden[] }): Promise<OrdenCompra> {
    const ahora = new Date();
    OrdenCompra.nueva(datos, 'validacion', ahora);   // valida antes de consultar al proveedor

    const proveedor = await this.proveedores.buscarPorId(datos.proveedorId);
    if (!proveedor?.activo) throw new ProveedorNoDisponible(datos.proveedorId);

    for (let intento = 1; ; intento++) {
      try {
        return await this.ordenes.guardar(OrdenCompra.nueva(datos, nuevoNumero(ahora), ahora));
      } catch (e) {
        if (!(e instanceof NumeroDuplicado) || intento === INTENTOS_NUMERO) throw e;
      }
    }
  }
}

@Injectable()
export class ListarOrdenesCompra {
  constructor(@Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository) {}

  ejecutar(estado?: EstadoOrden | null): Promise<OrdenCompra[]> {
    return this.ordenes.listar(estado);
  }
}

async function buscar(ordenes: OrdenCompraRepository, id: string): Promise<OrdenCompra> {
  return (await ordenes.buscarPorId(id)) ?? Promise.reject(new OrdenNoEncontrada(id));
}

/**
 * Aplica una transición simple (enviar o anular). La escritura es condicional al estado leído: si otra
 * petición cambió la orden entre medio, se vuelve a leer y la regla del dominio da el error correcto.
 */
async function cambiar(ordenes: OrdenCompraRepository, id: string, transicion: (o: OrdenCompra) => OrdenCompra): Promise<OrdenCompra> {
  const orden = await buscar(ordenes, id);
  const nueva = transicion(orden);
  if (!(await ordenes.cambiarEstado(id, orden.estado, nueva.estado))) {
    transicion(await buscar(ordenes, id));   // lanza TransicionInvalida con el estado actual
  }
  return buscar(ordenes, id);
}

/** CU06: el gerente revisó la orden (p. ej. la que creó el agente) y la manda al proveedor. */
@Injectable()
export class EnviarOrdenCompra {
  constructor(@Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository) {}

  ejecutar(id: string): Promise<OrdenCompra> {
    return cambiar(this.ordenes, id, (o) => o.enviar());
  }
}

@Injectable()
export class AnularOrdenCompra {
  constructor(@Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository) {}

  ejecutar(id: string): Promise<OrdenCompra> {
    return cambiar(this.ordenes, id, (o) => o.anular());
  }
}

/** Una recepción que se cortó (p. ej. se reinició el servicio) libera la orden pasado este tiempo. */
const VENCIMIENTO_RECEPCION_MS = 2 * 60_000;

/**
 * CU06 (cierre): llegó la mercadería. Suma cada línea al stock de ms-inventario y deja la orden RECIBIDA.
 *
 * Si ms-inventario falla a mitad de camino, la orden sigue ENVIADA con las líneas ya sumadas marcadas: al
 * reintentar solo se suman las que faltan.
 */
@Injectable()
export class RecibirOrdenCompra {
  constructor(
    @Inject(ORDEN_COMPRA_REPOSITORY) private readonly ordenes: OrdenCompraRepository,
    @Inject(INVENTARIO) private readonly inventario: Inventario,
  ) {}

  async ejecutar(id: string, token: string): Promise<OrdenCompra> {
    const orden = await buscar(this.ordenes, id);
    orden.validarRecepcion();
    if (!(await this.ordenes.tomarRecepcion(id, VENCIMIENTO_RECEPCION_MS))) {
      (await buscar(this.ordenes, id)).validarRecepcion();   // ya la recibió otra petición
      throw new RecepcionEnCurso(orden.numero);
    }

    try {
      const actual = await buscar(this.ordenes, id);   // releída: puede traer líneas de un intento anterior
      const pendientes = actual.lineasPorReponer();
      for (const [i, { indice, linea }] of pendientes.entries()) {
        try {
          await this.inventario.reponer(linea.productoCodigo, linea.cantidad, token);
        } catch (e) {
          const hechas = actual.lineas.length - pendientes.length + i;
          if (e instanceof ErrorDeDominio && hechas > 0) {
            throw new RecepcionIncompleta(`${e.message} Se sumaron ${hechas} de ${actual.lineas.length} productos; vuelve a registrar la recepción para sumar los que faltan.`);
          }
          throw e;
        }
        await this.ordenes.marcarLineaRepuesta(id, indice);
      }
      await this.ordenes.cambiarEstado(id, 'ENVIADA', 'RECIBIDA', new Date());
    } finally {
      await this.ordenes.soltarRecepcion(id);
    }
    return buscar(this.ordenes, id);
  }
}
