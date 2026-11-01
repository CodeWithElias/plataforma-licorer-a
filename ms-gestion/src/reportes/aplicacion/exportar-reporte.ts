import { Inject, Injectable } from '@nestjs/common';
import { REPORTE_REPOSITORY, ReporteNoEncontrado, type ReporteRepository } from '../dominio/reporte.repository.js';
import { MotorPdf } from '../infraestructura/motor-pdf.js';
import type { FormatoReporte } from '../dominio/reporte.js';

export interface ArchivoReporteDto {
  formato: 'PDF' | 'XLSX';
  url: string;
}

@Injectable()
export class ExportarReporte {
  // Caché estática en memoria para descargas inmediatas
  private static readonly cache = new Map<string, { buffer: Buffer; mime: string }>();

  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly repo: ReporteRepository,
    private readonly motorPdf: MotorPdf,
  ) {}

  async ejecutar(id: string, formato: 'PDF' | 'XLSX'): Promise<ArchivoReporteDto> {
    const reporte = await this.repo.buscarPorId(id);
    if (!reporte) {
      throw new ReporteNoEncontrado(id);
    }

    if (formato === 'PDF') {
      const buffer = await this.motorPdf.generarBuffer(reporte);
      ExportarReporte.cache.set(`${id}:pdf`, {
        buffer,
        mime: 'application/pdf',
      });
    }

    const baseUrl = process.env.GESTION_BASE_URL || process.env.BASE_URL || 'http://ms-gestion:3000';
    const cleanBase = baseUrl.replace(/\/$/, '');
    const url = `${cleanBase}/reportes/descargar/${id}?formato=${formato.toLowerCase()}`;

    await this.repo.actualizarArchivos(id, [
      { formato: formato as FormatoReporte, ruta: url },
    ]);

    return {
      formato,
      url,
    };
  }

  async obtenerBuffer(id: string, formato: string): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const key = `${id}:${formato.toLowerCase()}`;
    const enCache = ExportarReporte.cache.get(key);
    if (enCache) {
      return {
        buffer: enCache.buffer,
        mime: enCache.mime,
        filename: `reporte-${id}.pdf`,
      };
    }

    const reporte = await this.repo.buscarPorId(id);
    if (!reporte) {
      throw new ReporteNoEncontrado(id);
    }

    const buffer = await this.motorPdf.generarBuffer(reporte);
    ExportarReporte.cache.set(key, { buffer, mime: 'application/pdf' });
    return {
      buffer,
      mime: 'application/pdf',
      filename: `reporte-${id}.pdf`,
    };
  }
}

