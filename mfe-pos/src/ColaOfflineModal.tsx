import { useEffect, useState } from 'react';
import { sincronizarVentasLote, type ResumenSincronizacion } from './api';
import { listarVentasOffline, type VentaOfflineLocal, eliminarVentaOffline } from './db/indexed-db';

interface ColaOfflineModalProps {
  abierto: boolean;
  onCerrar: () => void;
  onActualizado: () => void;
}

export function ColaOfflineModal({ abierto, onCerrar, onActualizado }: ColaOfflineModalProps) {
  const [ventas, setVentas] = useState<VentaOfflineLocal[]>([]);
  const [cargando, setCargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [resumen, setResumen] = useState<ResumenSincronizacion | null>(null);
  const [errorSync, setErrorSync] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    listarVentasOffline()
      .then(setVentas)
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    if (abierto) {
      setResumen(null);
      setErrorSync(null);
      cargar();
    }
  }, [abierto]);

  if (!abierto) return null;

  /** Las ventas con error no se borran solas: el cajero decide cuando ya las resolvió. */
  const descartar = async (operationId: string) => {
    await eliminarVentaOffline(operationId);
    cargar();
    onActualizado();
  };

  const ejecutarSincronizacion = async () => {
    setSincronizando(true);
    setErrorSync(null);
    setResumen(null);
    try {
      const res = await sincronizarVentasLote(ventas);
      setResumen(res);
      cargar();
      onActualizado();
    } catch (e: any) {
      setErrorSync(e.message ?? 'No se pudo sincronizar el lote');
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="pos-modal-fondo" onClick={onCerrar}>
      <div className="pos-modal-cuerpo" onClick={(e) => e.stopPropagation()}>
        <header className="pos-modal-header">
          <div>
            <h3>Cola de ventas offline</h3>
            <small style={{ color: 'var(--lila-600)', fontWeight: 600 }}>CU03 – IndexedDB nativo e Idempotencia</small>
          </div>
          <button className="pos-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">&times;</button>
        </header>

        <div className="pos-modal-contenido">
          {errorSync && (
            <div className="pos-alerta error" style={{ marginBottom: '1rem' }}>
              <strong>Error al sincronizar</strong>
              <span>{errorSync}</span>
            </div>
          )}

          {resumen && (
            <div className="pos-alerta ok" style={{ marginBottom: '1rem' }}>
              <strong>Sincronización finalizada</strong>
              <span>
                {resumen.exitosas} guardadas con éxito, {resumen.duplicadas} ya registradas, {resumen.errores} con error.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.8rem' }}>
            <span style={{ color: 'var(--gris)', fontSize: '.88rem' }}>
              Total en cola local: <strong>{ventas.length}</strong> ventas
            </span>
            <button
              type="button"
              className="pos-btn-secundario"
              onClick={ejecutarSincronizacion}
              disabled={sincronizando || ventas.length === 0}
              style={{ height: '36px', fontSize: '.82rem' }}
            >
              {sincronizando ? 'Sincronizando…' : '⚡ Sincronizar lote'}
            </button>
          </div>

          {cargando ? (
            <p style={{ color: 'var(--gris)', textAlign: 'center', padding: '1rem' }}>Cargando registros locales…</p>
          ) : ventas.length === 0 ? (
            <p style={{ color: 'var(--gris-claro)', textAlign: 'center', padding: '2rem 1rem' }}>
              No hay ventas pendientes en la cola local. Todas están al día.
            </p>
          ) : (
            <table className="pos-tabla-cola">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Ítems</th>
                  <th>Pago</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.operationId}>
                    <td>{new Date(v.fechaLocal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{v.items.reduce((s, i) => s + i.cantidad, 0)} un.</td>
                    <td>{v.pago.metodo}</td>
                    <td><strong>Bs {v.total.toFixed(2)}</strong></td>
                    <td>
                      {v.estadoSync === 'PENDIENTE' ? (
                        <span style={{ color: 'var(--lila-600)', fontWeight: 600 }}>Pendiente</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--rojo)', fontWeight: 600 }} title={v.motivoError}>
                            Error ({v.motivoError})
                          </span>{' '}
                          <button type="button" className="pos-modal-cerrar" style={{ width: 'auto', height: 'auto', fontSize: '.78rem' }} onClick={() => descartar(v.operationId)}>
                            Descartar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="pos-modal-footer">
          <button type="button" className="pos-btn-secundario" onClick={onCerrar}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}

