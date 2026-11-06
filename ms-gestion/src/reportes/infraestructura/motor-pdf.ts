import { Injectable } from '@nestjs/common';
import * as pdfmakeModule from 'pdfmake';
import { Reporte } from '../dominio/reporte.js';

// Compatible con importación ESM y CJS de pdfmake 0.3+
type TDocumentDefinitions = any;
const pdfmake: any = (pdfmakeModule as any).default ?? pdfmakeModule;

// Configuración de fuentes estándar Helvetica (sin necesidad de archivos externos)
if (typeof pdfmake.addFonts === 'function') {
  pdfmake.addFonts({
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  });
}
if (typeof pdfmake.setUrlAccessPolicy === 'function') {
  pdfmake.setUrlAccessPolicy(() => false);
}
if (typeof pdfmake.setLocalAccessPolicy === 'function') {
  pdfmake.setLocalAccessPolicy(() => true);
}

@Injectable()
export class MotorPdf {
  async generarBuffer(reporte: Reporte): Promise<Buffer> {
    const metricas = this.calcularMetricas(reporte);
    const docDefinition: TDocumentDefinitions = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 9,
        color: '#241a38',
      },
      pageMargins: [40, 42, 40, 42],
      header: () => this.encabezadoPagina(reporte),
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: `Generado automáticamente · ${reporte.id ?? 'sin-id'}`,
            style: 'piePagina',
          },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            style: 'piePagina',
            alignment: 'right',
          },
        ],
        margin: [40, 12, 40, 0],
      }),
      content: [
        {
          stack: [
            { text: 'REPORTE DE VENTAS', style: 'tituloReporte' },
            { text: 'LICORERÍA IMPERIAL', style: 'subtituloReporte' },
          ],
          alignment: 'center',
          marginBottom: 10,
        },
        {
          text: `Periodo consultado · ${reporte.fecha.toLocaleDateString('es-BO')}    ·    Generado por ${reporte.creadoPor}`,
          style: 'subtitulo',
          marginBottom: 12,
        },
        this.parametros(reporte),
        this.kpis(metricas),
        reporte.resumen
          ? {
              style: 'cajaResumen',
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: 'RESUMEN EJECUTIVO', style: 'etiquetaSeccion' },
                        { text: reporte.resumen, margin: [0, 5, 0, 0] },
                      ],
                    },
                  ],
                ],
              },
              layout: 'noBorders',
              marginBottom: 14,
            }
          : {},
        this.grafico(metricas),
        this.armarTabla(reporte),
      ],
      styles: {
        headerTitulo: {
          fontSize: 15,
          bold: true,
          color: '#6a2fd0',
        },
        headerFecha: {
          fontSize: 8,
          color: '#6c6880',
        },
        tituloReporte: {
          fontSize: 19,
          bold: true,
          color: '#241a38',
          alignment: 'center',
        },
        subtituloReporte: {
          fontSize: 13,
          bold: true,
          color: '#6a2fd0',
          marginTop: 3,
          alignment: 'center',
        },
        subtitulo: {
          fontSize: 8,
          color: '#6c6880',
        },
        etiquetaSeccion: {
          fontSize: 7,
          bold: true,
          color: '#6a2fd0',
          characterSpacing: 0.4,
        },
        etiquetaKpi: {
          fontSize: 7,
          color: '#6c6880',
          bold: true,
        },
        valorKpi: {
          fontSize: 13,
          color: '#241a38',
          bold: true,
          marginTop: 4,
        },
        tablaEncabezado: {
          fontSize: 7,
          bold: true,
          color: '#ffffff',
          alignment: 'center',
        },
        tablaCelda: {
          fontSize: 8,
        },
        piePagina: {
          fontSize: 8,
          color: '#9a96ab',
        },
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return await doc.getBuffer();
  }

  private encabezadoPagina(reporte: Reporte) {
    return {
      columns: [
        { text: '', style: 'headerTitulo' },
        {
          stack: [
            { text: `Informe Nº ${reporte.id ?? 'pendiente'}`, style: 'headerFecha', alignment: 'right' },
            { text: reporte.fecha.toLocaleString('es-BO'), style: 'headerFecha', alignment: 'right' },
          ],
        },
      ],
      margin: [40, 18, 40, 0],
    };
  }

  private parametros(reporte: Reporte) {
    return {
      table: {
        widths: ['*'],
        body: [[
          {
            stack: [
              { text: 'PARAMETROS DEL REPORTE', style: 'etiquetaSeccion' },
              {
                text: `Consulta: ${reporte.consulta}   ·   Tipo de grafico: ${reporte.tipoGrafico}   ·   Columnas: ${reporte.columnas.join(', ')}`,
                fontSize: 7,
                color: '#4c4660',
                marginTop: 4,
              },
            ],
            fillColor: '#f7f4ff',
            margin: [10, 8, 10, 8],
          },
        ]],
      },
      layout: 'noBorders',
      marginBottom: 12,
    };
  }

  private kpis(metricas: MetricasReporte) {
    const tarjeta = (etiqueta: string, valor: string) => ({
      stack: [
        { text: etiqueta, style: 'etiquetaKpi' },
        { text: valor, style: 'valorKpi' },
      ],
      fillColor: '#ffffff',
      margin: [9, 8, 9, 8],
    });

    return {
      table: {
        widths: ['*', '*', '*', '*'],
        body: [[
          tarjeta('TOTAL VENDIDO', `Bs ${metricas.total.toFixed(2)}`),
          tarjeta('UNIDADES', String(metricas.unidades)),
          tarjeta('PRODUCTOS / FILAS', String(metricas.filas)),
          tarjeta('PRODUCTO LIDER', metricas.lider),
        ]],
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => '#ddd2fe',
        vLineColor: () => '#ddd2fe',
      },
      marginBottom: 14,
    };
  }

  private grafico(metricas: MetricasReporte) {
    if (metricas.barras.length === 0) return {};
    const maximo = Math.max(...metricas.barras.map((fila) => fila.monto), 1);
    const filas = metricas.barras.slice(0, 10).map((fila) => ({
      columns: [
        { text: fila.nombre, width: 125, style: 'tablaCelda', noWrap: false },
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 1,
              w: Math.max(2, 255 * (fila.monto / maximo)),
              h: 8,
              r: 2,
              color: '#6a2fd0',
            },
          ],
          width: 270,
        },
        { text: `Bs ${fila.monto.toFixed(2)}`, width: '*', alignment: 'right', style: 'tablaCelda' },
      ],
      margin: [0, 2, 0, 2],
    }));

    return {
      stack: [
        { text: 'VENTAS POR PRODUCTO (Bs)', style: 'etiquetaSeccion', marginBottom: 6 },
        ...filas,
      ],
      marginBottom: 14,
    };
  }

  private armarTabla(reporte: Reporte) {
    if (!reporte.datos || reporte.datos.length === 0) {
      return {
        text: 'No se registraron transacciones para el período especificado.',
        italics: true,
        color: '#6c6880',
      };
    }

    const columnas = reporte.columnas.length > 0 ? reporte.columnas : Object.keys(reporte.datos[0]);
    const encabezados = columnas.map((col) => ({
      text: col.toUpperCase(),
      fillColor: '#7c3aed',
      margin: [4, 4, 4, 4],
      style: 'tablaEncabezado',
    }));

    const filas = reporte.datos.map((fila, index) => {
      const bgColor = index % 2 === 0 ? '#faf9fd' : '#ffffff';
      return columnas.map((col) => ({
        text: this.formatearValor(fila[col]),
        fillColor: bgColor,
        margin: [4, 4, 4, 4],
        alignment: typeof fila[col] === 'number' ? 'right' : 'left',
        style: 'tablaCelda',
      }));
    });

    return {
      table: {
        headerRows: 1,
        widths: columnas.map(() => '*'),
        body: [encabezados, ...filas],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#ebe7f4',
        vLineColor: () => '#ebe7f4',
      },
    };
  }

  private calcularMetricas(reporte: Reporte): MetricasReporte {
    const barras = reporte.datos.map((fila) => ({
      nombre: String(
        fila['Producto'] ??
          fila['producto'] ??
          fila['Categoría'] ??
          fila['categoria'] ??
          fila['Fecha'] ??
          fila['fecha'] ??
          'Varios',
      ),
      unidades: this.numero(fila, ['Unidades', 'unidades', 'cantidad', 'disponible']),
      monto: this.numero(fila, ['Monto (Bs)', 'monto (bs)', 'totalBs', 'subtotalBs', 'subtotal', 'total', 'monto']),
    }));
    return {
      total: barras.reduce((total, fila) => total + fila.monto, 0),
      unidades: barras.reduce((total, fila) => total + fila.unidades, 0),
      filas: barras.length,
      lider: barras[0]?.nombre ?? '—',
      barras,
    };
  }

  private numero(fila: Record<string, any>, claves: string[]): number {
    for (const clave of claves) {
      const valor = Number(fila[clave]);
      if (Number.isFinite(valor)) return valor;
    }
    return 0;
  }

  private formatearValor(valor: unknown): string {
    if (typeof valor === 'number') {
      return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
    }
    return String(valor ?? '—');
  }
}

interface FilaMetrica {
  nombre: string;
  unidades: number;
  monto: number;
}

interface MetricasReporte {
  total: number;
  unidades: number;
  filas: number;
  lider: string;
  barras: FilaMetrica[];
}
