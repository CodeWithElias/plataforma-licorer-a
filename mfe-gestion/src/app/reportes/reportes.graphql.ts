import { gql } from 'apollo-angular';

export interface ReporteItem {
  id: string;
  consulta: string;
  datos?: string;
  tipoGrafico: string;
  resumen?: string;
  creadoPor: string;
  fecha: string;
}

export interface ExportarReporteRespuesta {
  exportarReporte: {
    formato: 'PDF' | 'XLSX';
    url: string;
  };
}

export const LISTAR_REPORTES = gql<{ reportes: ReporteItem[] }, Record<string, never>>`
  query ListarReportes {
    reportes {
      id
      consulta
      datos
      tipoGrafico
      resumen
      creadoPor
      fecha
    }
  }
`;

export const EXPORTAR_REPORTE = gql<ExportarReporteRespuesta, { id: string; formato: 'PDF' | 'XLSX' }>`
  mutation ExportarReporte($id: ID!, $formato: FormatoExportacion!) {
    exportarReporte(id: $id, formato: $formato) {
      formato
      url
    }
  }
`;

export const GENERAR_REPORTE = gql<{ generarReporte: ReporteItem }, { consulta: string }>`
  mutation GenerarReporte($consulta: String!) {
    generarReporte(consulta: $consulta) {
      id
      consulta
      datos
      tipoGrafico
      resumen
      creadoPor
      fecha
    }
  }
`;

export function mensajeDeError(error: unknown): string {
  if (!error) return 'Error inesperado';
  if (typeof error === 'string') return error;
  const e = error as any;
  return e.message || 'Error al procesar la solicitud';
}
