import { Inject, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { REPORTE_REPOSITORY, ReporteNoEncontrado, type ReporteRepository } from '../dominio/reporte.repository.js';
import { MotorPdf } from '../infraestructura/motor-pdf.js';
import { Reporte, type FormatoReporte } from '../dominio/reporte.js';

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

    const buffer = formato === 'PDF' ? await this.motorPdf.generarBuffer(reporte) : this.generarXlsx(reporte);
    ExportarReporte.cache.set(`${id}:${formato.toLowerCase()}`, {
      buffer,
      mime: formato === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const baseUrl = process.env.GESTION_BASE_URL || process.env.BASE_URL || '';
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
        filename: `reporte-${id}.${formato.toLowerCase() === 'xlsx' ? 'xlsx' : 'pdf'}`,
      };
    }

    const reporte = await this.repo.buscarPorId(id);
    if (!reporte) {
      throw new ReporteNoEncontrado(id);
    }

    const esXlsx = formato.toLowerCase() === 'xlsx';
    const buffer = esXlsx ? this.generarXlsx(reporte) : await this.motorPdf.generarBuffer(reporte);
    const mime = esXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
    ExportarReporte.cache.set(key, { buffer, mime });
    return {
      buffer,
      mime,
      filename: `reporte-${id}.${esXlsx ? 'xlsx' : 'pdf'}`,
    };
  }

  private generarXlsx(reporte: Reporte): Buffer {
    const columnas = reporte.columnas.length > 0 ? reporte.columnas : Object.keys(reporte.datos[0] ?? {});
    const filas = reporte.datos.map((fila) => columnas.map((columna) => fila[columna] ?? ''));
    const hoja = XLSX.utils.aoa_to_sheet([columnas, ...filas]);
    hoja['!cols'] = columnas.map((columna) => ({ wch: Math.max(columna.length + 2, 16) }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
    return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
