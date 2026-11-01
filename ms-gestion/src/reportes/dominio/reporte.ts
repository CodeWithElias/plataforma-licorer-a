export type TipoGrafico = 'barras' | 'lineas' | 'torta' | 'tabla';
export type FormatoReporte = 'XLSX' | 'PDF';

export interface DatosReporte {
  id?: string;
  consulta: string;
  columnas: string[];
  datos: Record<string, any>[];
  tipoGrafico: TipoGrafico;
  resumen?: string;
  creadoPor: string;
  fecha?: Date;
  archivos?: { formato: FormatoReporte; ruta: string }[];
}

export class Reporte {
  readonly id?: string;
  readonly consulta: string;
  readonly columnas: string[];
  readonly datos: Record<string, any>[];
  readonly tipoGrafico: TipoGrafico;
  readonly resumen?: string;
  readonly creadoPor: string;
  readonly fecha: Date;
  readonly archivos: { formato: FormatoReporte; ruta: string }[];

  constructor(d: DatosReporte) {
    this.id = d.id;
    this.consulta = d.consulta;
    this.columnas = d.columnas ?? [];
    this.datos = d.datos ?? [];
    this.tipoGrafico = d.tipoGrafico ?? 'tabla';
    this.resumen = d.resumen;
    this.creadoPor = d.creadoPor;
    this.fecha = d.fecha ?? new Date();
    this.archivos = d.archivos ?? [];
  }

  conId(id: string): Reporte {
    return new Reporte({ ...this, id });
  }

  conArchivo(formato: FormatoReporte, ruta: string): Reporte {
    const filtrados = this.archivos.filter((a) => a.formato !== formato);
    return new Reporte({
      ...this,
      archivos: [...filtrados, { formato, ruta }],
    });
  }
}

