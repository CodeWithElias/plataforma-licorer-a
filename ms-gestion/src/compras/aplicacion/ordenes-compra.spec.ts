import { type EstadoOrden, OrdenCompra, ProveedorNoDisponible, TransicionInvalida } from '../dominio/orden-compra.js';
import { NumeroDuplicado, type OrdenCompraRepository } from '../dominio/orden-compra.repository.js';
import { type Inventario, InventarioNoDisponible } from '../dominio/inventario.js';
import type { ProveedorRepository } from '../../proveedores/dominio/proveedor.repository.js';
import {
  AnularOrdenCompra, CrearOrdenCompra, EnviarOrdenCompra, RecepcionEnCurso, RecepcionIncompleta, RecibirOrdenCompra,
} from './ordenes-compra.casos-de-uso.js';

/** Guarda documentos planos, como Mongo: cada lectura arma una OrdenCompra nueva. */
class OrdenesEnMemoria implements OrdenCompraRepository {
  docs = new Map<string, { orden: OrdenCompra; estado: EstadoOrden; repuestas: number[]; recibiendo: boolean; fechaRecepcion: Date | null }>();
  duplicadosPendientes = 0;

  private leer(id: string) {
    const d = this.docs.get(id);
    return d
      ? OrdenCompra.desde({ ...d.orden, id, estado: d.estado, lineasRepuestas: [...d.repuestas], fechaRecepcion: d.fechaRecepcion })
      : null;
  }
  async listar() {
    return [...this.docs.keys()].map((id) => this.leer(id)!);
  }
  async buscarPorId(id: string) {
    return this.leer(id);
  }
  async guardar(o: OrdenCompra) {
    if (this.duplicadosPendientes-- > 0) throw new NumeroDuplicado();
    const guardada = o.conId(`id-${this.docs.size + 1}`);
    this.docs.set(guardada.id!, { orden: guardada, estado: guardada.estado, repuestas: [], recibiendo: false, fechaRecepcion: null });
    return guardada;
  }
  async cambiarEstado(id: string, desde: EstadoOrden, hacia: EstadoOrden, fechaRecepcion?: Date) {
    const d = this.docs.get(id);
    if (d?.estado !== desde) return false;
    d.estado = hacia;
    if (fechaRecepcion) d.fechaRecepcion = fechaRecepcion;
    return true;
  }
  async tomarRecepcion(id: string) {
    const d = this.docs.get(id);
    if (d?.estado !== 'ENVIADA' || d.recibiendo) return false;
    d.recibiendo = true;
    return true;
  }
  async soltarRecepcion(id: string) {
    this.docs.get(id)!.recibiendo = false;
  }
  async marcarLineaRepuesta(id: string, indice: number) {
    const d = this.docs.get(id)!;
    if (!d.repuestas.includes(indice)) d.repuestas.push(indice);
  }
}

class InventarioFalso implements Inventario {
  repuestos: { codigo: string; cantidad: number; token: string }[] = [];
  fallarCon = new Set<string>();
  async reponer(codigo: string, cantidad: number, token: string) {
    if (this.fallarCon.has(codigo)) throw new InventarioNoDisponible(`ms-inventario no repuso ${codigo}.`);
    this.repuestos.push({ codigo, cantidad, token });
  }
}

const proveedores = (activo: boolean | null) =>
  ({ buscarPorId: async () => (activo === null ? null : { activo }) }) as unknown as ProveedorRepository;

const pedido = { proveedorId: 'p1', origen: 'AGENTE' as const, lineas: [{ productoCodigo: 'ron-002', cantidad: 6, precioUnitario: 91.005 }] };
const dosLineas = {
  ...pedido,
  lineas: [
    { productoCodigo: 'RON-002', cantidad: 6, precioUnitario: 90 },
    { productoCodigo: 'WHI-003', cantidad: 12, precioUnitario: 150 },
  ],
};

async function ordenEn(repo: OrdenesEnMemoria, estado: 'BORRADOR' | 'ENVIADA', datos = pedido) {
  const o = await new CrearOrdenCompra(repo, proveedores(true)).ejecutar(datos);
  if (estado === 'ENVIADA') await new EnviarOrdenCompra(repo).ejecutar(o.id!);
  return o.id!;
}

describe('Compras (CU06)', () => {
  it('crea la orden en BORRADOR con número, total calculado y código normalizado', async () => {
    const repo = new OrdenesEnMemoria();
    const o = await new CrearOrdenCompra(repo, proveedores(true)).ejecutar(pedido);

    expect(o.id).toBe('id-1');
    expect(o.numero).toMatch(/^OC-\d{8}-\d{4}$/);
    expect(o.estado).toBe('BORRADOR');
    expect(o.lineas[0].productoCodigo).toBe('RON-002');
    expect(o.total).toBe(546.06);
  });

  it('no crea la orden si el proveedor no existe o está inactivo', async () => {
    await expect(new CrearOrdenCompra(new OrdenesEnMemoria(), proveedores(null)).ejecutar(pedido)).rejects.toThrow(ProveedorNoDisponible);
    await expect(new CrearOrdenCompra(new OrdenesEnMemoria(), proveedores(false)).ejecutar(pedido)).rejects.toThrow(ProveedorNoDisponible);
  });

  it('rechaza líneas inválidas', async () => {
    const crear = new CrearOrdenCompra(new OrdenesEnMemoria(), proveedores(true));
    await expect(crear.ejecutar({ ...pedido, lineas: [] })).rejects.toThrow('al menos una línea');
    await expect(crear.ejecutar({ ...pedido, lineas: [{ productoCodigo: 'X', cantidad: 0, precioUnitario: 1 }] })).rejects.toThrow('entero');
    await expect(crear.ejecutar({ ...pedido, lineas: [{ productoCodigo: 'X', cantidad: 1, precioUnitario: -1 }] })).rejects.toThrow('negativo');
  });

  it('si el número se repite lo intenta con otro', async () => {
    const repo = new OrdenesEnMemoria();
    repo.duplicadosPendientes = 2;
    await new CrearOrdenCompra(repo, proveedores(true)).ejecutar(pedido);
    expect(repo.docs.size).toBe(1);
  });
});

describe('Ciclo de la orden de compra (CU06)', () => {
  it('envía un borrador y no deja enviarlo dos veces', async () => {
    const repo = new OrdenesEnMemoria();
    const id = await ordenEn(repo, 'BORRADOR');

    expect((await new EnviarOrdenCompra(repo).ejecutar(id)).estado).toBe('ENVIADA');
    await expect(new EnviarOrdenCompra(repo).ejecutar(id)).rejects.toThrow(TransicionInvalida);
  });

  it('anula un borrador o una enviada, pero no una recibida', async () => {
    const repo = new OrdenesEnMemoria();
    expect((await new AnularOrdenCompra(repo).ejecutar(await ordenEn(repo, 'BORRADOR'))).estado).toBe('ANULADA');
    expect((await new AnularOrdenCompra(repo).ejecutar(await ordenEn(repo, 'ENVIADA'))).estado).toBe('ANULADA');

    const recibida = await ordenEn(repo, 'ENVIADA');
    await new RecibirOrdenCompra(repo, new InventarioFalso()).ejecutar(recibida, 't');
    await expect(new AnularOrdenCompra(repo).ejecutar(recibida)).rejects.toThrow(TransicionInvalida);
  });

  it('recibir suma cada línea al stock con el token del gerente y deja la orden RECIBIDA', async () => {
    const repo = new OrdenesEnMemoria();
    const inventario = new InventarioFalso();
    const id = await ordenEn(repo, 'ENVIADA', dosLineas);

    const o = await new RecibirOrdenCompra(repo, inventario).ejecutar(id, 'token-gerente');

    expect(o.estado).toBe('RECIBIDA');
    expect(o.fechaRecepcion).toBeInstanceOf(Date);
    expect(inventario.repuestos).toEqual([
      { codigo: 'RON-002', cantidad: 6, token: 'token-gerente' },
      { codigo: 'WHI-003', cantidad: 12, token: 'token-gerente' },
    ]);
  });

  it('solo se recibe una orden enviada', async () => {
    const repo = new OrdenesEnMemoria();
    const inventario = new InventarioFalso();
    await expect(new RecibirOrdenCompra(repo, inventario).ejecutar(await ordenEn(repo, 'BORRADOR'), 't')).rejects.toThrow(TransicionInvalida);

    const id = await ordenEn(repo, 'ENVIADA');
    await new RecibirOrdenCompra(repo, inventario).ejecutar(id, 't');
    await expect(new RecibirOrdenCompra(repo, inventario).ejecutar(id, 't')).rejects.toThrow(TransicionInvalida);
    expect(inventario.repuestos).toHaveLength(1);   // la segunda no sumó otra vez
  });

  it('si ms-inventario falla a mitad, al reintentar solo suma las líneas que faltaban', async () => {
    const repo = new OrdenesEnMemoria();
    const inventario = new InventarioFalso();
    const id = await ordenEn(repo, 'ENVIADA', dosLineas);

    inventario.fallarCon.add('WHI-003');
    await expect(new RecibirOrdenCompra(repo, inventario).ejecutar(id, 't')).rejects.toThrow(RecepcionIncompleta);
    expect((await repo.buscarPorId(id))!.estado).toBe('ENVIADA');

    inventario.fallarCon.clear();
    expect((await new RecibirOrdenCompra(repo, inventario).ejecutar(id, 't')).estado).toBe('RECIBIDA');
    expect(inventario.repuestos.map((r) => r.codigo)).toEqual(['RON-002', 'WHI-003']);   // RON-002 una sola vez
  });

  it('si la primera línea falla, devuelve el error de ms-inventario y la orden sigue ENVIADA', async () => {
    const repo = new OrdenesEnMemoria();
    const inventario = new InventarioFalso();
    inventario.fallarCon.add('RON-002');
    const id = await ordenEn(repo, 'ENVIADA');

    await expect(new RecibirOrdenCompra(repo, inventario).ejecutar(id, 't')).rejects.toThrow(InventarioNoDisponible);
    expect((await repo.buscarPorId(id))!.estado).toBe('ENVIADA');
    expect(repo.docs.get(id)!.recibiendo).toBe(false);   // se soltó para poder reintentar
  });

  it('no deja registrar dos recepciones a la vez', async () => {
    const repo = new OrdenesEnMemoria();
    const id = await ordenEn(repo, 'ENVIADA');
    repo.docs.get(id)!.recibiendo = true;   // otra petición la está recibiendo

    await expect(new RecibirOrdenCompra(repo, new InventarioFalso()).ejecutar(id, 't')).rejects.toThrow(RecepcionEnCurso);
  });
});
