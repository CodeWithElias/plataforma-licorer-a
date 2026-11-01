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
    const docDefinition: TDocumentDefinitions = {
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10,
        color: '#241a38',
      },
      content: [
        // Encabezado institucional
        {
          columns: [
            {
              text: '🍷 LICORERÍA IMPERIAL',
              style: 'headerTitulo',
            },
            {
              text: `Fecha: ${reporte.fecha.toLocaleDateString('es-BO')}`,
              alignment: 'right',
              style: 'headerFecha',
            },
          ],
          marginBottom: 15,
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#7c3aed' }],
          marginBottom: 18,
        },
        // Título del reporte
        {
          text: `Reporte: ${reporte.consulta}`,
          style: 'tituloPrincipal',
        },
        {
          text: `Generado por: ${reporte.creadoPor} · Formato: PDF`,
          style: 'subtitulo',
          marginBottom: 14,
        },
        // Resumen
        reporte.resumen
          ? {
              style: 'cajaResumen',
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      text: `Resumen Ejecutivo:\n${reporte.resumen}`,
                      fillColor: '#f7f4ff',
                      margin: [10, 8, 10, 8],
                      color: '#4c1d95',
                    },
                  ],
                ],
              },
              layout: 'noBorders',
              marginBottom: 18,
            }
          : {},
        // Tabla de datos
        this.armarTabla(reporte),
        // Pie de página
        {
          text: '\nDocumento generado automáticamente por el subsistema de Gestión Empresarial.',
          style: 'piePagina',
          marginTop: 20,
        },
      ],
      styles: {
        headerTitulo: {
          fontSize: 14,
          bold: true,
          color: '#6a2fd0',
        },
        headerFecha: {
          fontSize: 9,
          color: '#6c6880',
        },
        tituloPrincipal: {
          fontSize: 16,
          bold: true,
          color: '#241a38',
          marginBottom: 4,
        },
        subtitulo: {
          fontSize: 9,
          color: '#6c6880',
        },
        piePagina: {
          fontSize: 8,
          color: '#9a96ab',
          alignment: 'center',
        },
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return await doc.getBuffer();
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
      bold: true,
      fillColor: '#7c3aed',
      color: '#ffffff',
      margin: [4, 4, 4, 4],
      alignment: 'center',
    }));

    const filas = reporte.datos.map((fila, index) => {
      const bgColor = index % 2 === 0 ? '#faf9fd' : '#ffffff';
      return columnas.map((col) => ({
        text: String(fila[col] ?? '—'),
        fillColor: bgColor,
        margin: [4, 4, 4, 4],
        alignment: typeof fila[col] === 'number' ? 'right' : 'left',
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
}
