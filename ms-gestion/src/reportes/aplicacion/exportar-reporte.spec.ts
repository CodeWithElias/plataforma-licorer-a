import { describe, it, expect, beforeEach } from 'vitest';
import { Reporte } from '../dominio/reporte.js';
import { ReporteNoEncontrado, type ReporteRepository } from '../dominio/reporte.repository.js';
import { MotorPdf } from '../infraestructura/motor-pdf.js';
import { ExportarReporte } from './exportar-reporte.js';

class ReporteRepositoryEnMemoria implements ReporteRepository {
  reportes = new Map<string, Reporte>();

  async buscarPorId(id: string): Promise<Reporte | null> {
    return this.reportes.get(id) ?? null;
  }

  async listar(): Promise<Reporte[]> {
    return [...this.reportes.values()];
  }

  async guardar(reporte: Reporte): Promise<Reporte> {
    this.reportes.set(reporte.id!, reporte);
    return reporte;
  }

  async actualizarArchivos(id: string, archivos: { formato: any; ruta: string }[]): Promise<void> {
    const r = this.reportes.get(id);
    if (r) {
      this.reportes.set(
        id,
        new Reporte({
          ...r,
          archivos: [...r.archivos, ...archivos],
        }),
      );
    }
  }
}

describe('ExportarReporte (CU07)', () => {
  let repo: ReporteRepositoryEnMemoria;
  let motorPdf: MotorPdf;
  let casoDeUso: ExportarReporte;

  const reporteEjemplo = new Reporte({
    id: 'rep-test-01',
    consulta: 'Ventas del día 2026-11-01 por producto',
    columnas: ['producto', 'cantidad', 'monto'],
    datos: [
      { producto: 'Paceña Pilsener 620ml', cantidad: 12, monto: 180 },
      { producto: 'Singani Los Parrales 750ml', cantidad: 3, monto: 210 },
    ],
    tipoGrafico: 'barras',
    resumen: 'Total recaudado Bs 390 en 15 unidades comercializadas.',
    creadoPor: 'agente-ia',
    fecha: new Date('2026-11-01T23:00:00.000Z'),
  });

  beforeEach(() => {
    repo = new ReporteRepositoryEnMemoria();
    repo.guardar(reporteEjemplo);
    motorPdf = new MotorPdf();
    casoDeUso = new ExportarReporte(repo, motorPdf);
  });

  it('exporta el reporte a formato PDF generando una URL válida', async () => {
    const res = await casoDeUso.ejecutar('rep-test-01', 'PDF');
    expect(res.formato).toBe('PDF');
    expect(res.url).toContain('/reportes/descargar/rep-test-01?formato=pdf');
  });

  it('obtiene el buffer binario en formato PDF para descarga', async () => {
    await casoDeUso.ejecutar('rep-test-01', 'PDF');
    const descarga = await casoDeUso.obtenerBuffer('rep-test-01', 'PDF');
    expect(descarga.mime).toBe('application/pdf');
    expect(descarga.filename).toBe('reporte-rep-test-01.pdf');
    expect(descarga.buffer).toBeInstanceOf(Buffer);
    expect(descarga.buffer.length).toBeGreaterThan(100);
    // Firma mágica del estándar PDF: %PDF-
    expect(descarga.buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('falla con ReporteNoEncontrado si el reporte solicitado no existe', async () => {
    await expect(casoDeUso.ejecutar('rep-inexistente', 'PDF')).rejects.toBeInstanceOf(
      ReporteNoEncontrado,
    );
  });
});

