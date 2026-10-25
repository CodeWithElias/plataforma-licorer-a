import { Ingreso, IngresoNoEncontrado } from '../dominio/ingreso.js';
import { IngresoDuplicado, type IngresoRepository } from '../dominio/ingreso.repository.js';
import { AnularIngreso } from './anular-ingreso.js';
import { RegistrarIngreso } from './registrar-ingreso.js';

class IngresosEnMemoria implements IngresoRepository {
  datos = new Map<string, Ingreso>();
  async buscarPorOperationId(op: string) {
    return this.datos.get(op) ?? null;
  }
  async guardar(i: Ingreso) {
    if (this.datos.has(i.operationId)) throw new IngresoDuplicado();
    const guardado = i.conId(`id-${this.datos.size + 1}`);
    this.datos.set(i.operationId, guardado);
    return guardado;
  }
  async actualizarEstado(i: Ingreso) {
    this.datos.set(i.operationId, i);
  }
}

describe('Contabilidad (Saga, paso 3)', () => {
  let repo: IngresosEnMemoria;
  let registrar: RegistrarIngreso;
  let anular: AnularIngreso;
  const datos = { operationId: 'op-1', ventaId: 'venta-1', monto: 72 };

  beforeEach(() => {
    repo = new IngresosEnMemoria();
    registrar = new RegistrarIngreso(repo);
    anular = new AnularIngreso(repo);
  });

  it('registra un ingreso ACTIVO', async () => {
    const i = await registrar.ejecutar(datos);
    expect(i.estado).toBe('ACTIVO');
    expect(i.id).toBe('id-1');
  });

  it('registrar dos veces el mismo operationId devuelve el mismo ingreso', async () => {
    const a = await registrar.ejecutar(datos);
    const b = await registrar.ejecutar(datos);
    expect(b.id).toBe(a.id);
    expect(repo.datos.size).toBe(1);
  });

  it('rechaza montos no positivos', async () => {
    await expect(registrar.ejecutar({ ...datos, monto: 0 })).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });

  it('anular deja el ingreso ANULADO y repetirlo no cambia nada', async () => {
    await registrar.ejecutar(datos);
    expect((await anular.ejecutar('op-1')).estado).toBe('ANULADO');
    expect((await anular.ejecutar('op-1')).estado).toBe('ANULADO');
  });

  it('anular uno inexistente responde INGRESO_NO_ENCONTRADO', async () => {
    await expect(anular.ejecutar('no-existe')).rejects.toBeInstanceOf(IngresoNoEncontrado);
  });
});
