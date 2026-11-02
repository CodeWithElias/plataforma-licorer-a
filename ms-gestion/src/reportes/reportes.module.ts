import { Module } from '@nestjs/common';
import { ListarReportes } from './aplicacion/listar-reportes.js';
import { ExportarReporte } from './aplicacion/exportar-reporte.js';
import { REPORTE_REPOSITORY } from './dominio/reporte.repository.js';
import { MongoReporteRepository } from './infraestructura/mongo-reporte.repository.js';
import { MotorPdf } from './infraestructura/motor-pdf.js';
import { ReporteDescargaController } from './infraestructura/reporte-descarga.controller.js';
import { ReporteResolver } from './interfaces/reporte.resolver.js';

/**
 * Bounded context Reportes. CU07 – Reportes generados por el agente de IA y su exportación a Excel/PDF (colección reportes).
 *
 * Capas (DDD): dominio/ → aplicacion/ → infraestructura/ · interfaces/
 */
@Module({
  controllers: [ReporteDescargaController],
  providers: [
    ReporteResolver,
    ListarReportes,
    ExportarReporte,
    MotorPdf,
    { provide: REPORTE_REPOSITORY, useClass: MongoReporteRepository },
  ],
  exports: [ListarReportes, ExportarReporte],
})
export class ReportesModule {}
