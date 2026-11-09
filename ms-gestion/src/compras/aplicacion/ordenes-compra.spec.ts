import { OrdenCompra, ProveedorNoDisponible } from '../dominio/orden-compra.js';
import { NumeroDuplicado, type OrdenCompraRepository } from '../dominio/orden-compra.repository.js';
import type { ProveedorRepository } from '../../proveedores/dominio/proveedor.repository.js';
import { CrearOrdenCompra } from './ordenes-compra.casos-de-uso.js';

class OrdenesEnMemoria implements OrdenCompraRepository {
  datos: OrdenCompra[] = [];
  duplicadosPendientes = 0;
  async listar() {
    return this.datos;
  }
  async guardar(o: OrdenCompra) {
    if (this.duplicadosPendientes-- > 0) throw new NumeroDuplicado();
    const guardada = o.conId(`id-${this.datos.length + 1}`);
    this.datos.push(guardada);
    return guardada;
  }
}

const proveedores = (activo: boolean | null) =>
  ({ buscarPorId: async () => (activo === null ? null : { activo }) }) as unknown as ProveedorRepository;

const pedido = { proveedorId: 'p1', origen: 'AGENTE' as const, lineas: [{ productoCodigo: 'ron-002', cantidad: 6, precioUnitario: 91.005 }] };

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
    expect(repo.datos).toHaveLength(1);
  });
});
