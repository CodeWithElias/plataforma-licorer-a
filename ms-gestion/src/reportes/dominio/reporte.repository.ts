import { Reporte, type FormatoReporte } from './reporte.js';

export const REPORTE_REPOSITORY = 'REPORTE_REPOSITORY';

export class ReporteNoEncontrado extends Error {
  constructor(id: string) {
    super(`Reporte no encontrado: ${id}`);
    this.name = 'ReporteNoEncontrado';
  }
}

export interface ReporteRepository {
  buscarPorId(id: string): Promise<Reporte | null>;
  listar(): Promise<Reporte[]>;
  guardar(reporte: Reporte): Promise<Reporte>;
  actualizarArchivos(id: string, archivos: { formato: FormatoReporte; ruta: string }[]): Promise<void>;
}
