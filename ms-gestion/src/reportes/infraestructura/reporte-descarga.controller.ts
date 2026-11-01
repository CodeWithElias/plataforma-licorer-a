import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Publico } from '../../compartido/auth/decoradores.js';
import { ExportarReporte } from '../aplicacion/exportar-reporte.js';

@Controller('reportes')
export class ReporteDescargaController {
  constructor(private readonly exportarReporte: ExportarReporte) {}

  @Publico()
  @Get('descargar/:id')
  async descargar(
    @Param('id') id: string,
    @Query('formato') formato: string = 'pdf',
    @Res() res: Response,
  ) {
    try {
      const archivo = await this.exportarReporte.obtenerBuffer(id, formato);
      res.setHeader('Content-Type', archivo.mime);
      res.setHeader('Content-Disposition', `attachment; filename="${archivo.filename}"`);
      res.setHeader('Content-Length', archivo.buffer.length);
      return res.status(HttpStatus.OK).end(archivo.buffer);
    } catch (err: any) {
      if (err?.name === 'ReporteNoEncontrado') {
        return res.status(HttpStatus.NOT_FOUND).json({ error: err.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: err?.message || 'Error interno' });
    }
  }
}
