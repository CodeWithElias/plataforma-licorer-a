import { Nit } from '../dominio/nit.js';
import { NitDuplicado, Proveedor, ProveedorNoEncontrado } from '../dominio/proveedor.js';
import type { ProveedorRepository } from '../dominio/proveedor.repository.js';
import { CrearProveedor, EditarProveedor, ListarProveedores } from './proveedores.casos-de-uso.js';

class ProveedoresEnMemoria implements ProveedorRepository {
  datos = new Map<string, Proveedor>();
  async listar(activo?: boolean | null) {
    return [...this.datos.values()].filter((p) => activo === undefined || activo === null || p.activo === activo);
  }
  async buscarPorId(id: string) {
    return this.datos.get(id) ?? null;
  }
  async guardar(p: Proveedor) {
    if ([...this.datos.values()].some((x) => x.nit.igualA(p.nit))) throw new NitDuplicado(p.nit.valor);
    const guardado = p.conId(`p${this.datos.size + 1}`);
    this.datos.set(guardado.id!, guardado);
    return guardado;
  }
  async actualizar(p: Proveedor) {
    this.datos.set(p.id!, p);
  }
}

describe('Nit (value object)', () => {
  it('acepta dígitos y quita separadores', () => expect(Nit.de('1023-456.789').valor).toBe('1023456789'));
  it('rechaza letras o muy corto', () => {
    expect(() => Nit.de('ABC123')).toThrow('El NIT');
    expect(() => Nit.de('123')).toThrow('El NIT');
  });
});

describe('Proveedores (CU05)', () => {
  let repo: ProveedoresEnMemoria;
  const datos = { nit: '1023456789', razonSocial: 'Cervecería Boliviana Nacional', productos: ['cer-001', 'CER-001', 'cer-002'] };

  beforeEach(() => (repo = new ProveedoresEnMemoria()));

  it('crea un proveedor activo con productos sin repetir y en mayúsculas', async () => {
    const p = await new CrearProveedor(repo).ejecutar(datos);
    expect(p.activo).toBe(true);
    expect(p.productos).toEqual(['CER-001', 'CER-002']);
  });

  it('no permite dos proveedores con el mismo NIT', async () => {
    await new CrearProveedor(repo).ejecutar(datos);
    await expect(new CrearProveedor(repo).ejecutar(datos)).rejects.toMatchObject({ codigo: 'NIT_DUPLICADO' });
  });

  it('exige razón social y email válido', () => {
    expect(() => Proveedor.crear({ ...datos, razonSocial: ' ' })).toThrow('razón social');
    expect(() => Proveedor.crear({ ...datos, contacto: { email: 'no-es-email' } })).toThrow('email');
  });

  it('edita y desactiva un proveedor; la lista filtra por activo', async () => {
    const p = await new CrearProveedor(repo).ejecutar(datos);
    const editado = await new EditarProveedor(repo).ejecutar(p.id!, { ...datos, razonSocial: 'CBN S.A.', activo: false });
    expect(editado.razonSocial).toBe('CBN S.A.');
    expect(await new ListarProveedores(repo).ejecutar(true)).toHaveLength(0);
    expect(await new ListarProveedores(repo).ejecutar(false)).toHaveLength(1);
  });

  it('editar uno inexistente responde PROVEEDOR_NO_ENCONTRADO', async () => {
    await expect(new EditarProveedor(repo).ejecutar('x', datos)).rejects.toBeInstanceOf(ProveedorNoEncontrado);
  });
});
