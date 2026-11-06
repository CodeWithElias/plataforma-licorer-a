import { Inject, Injectable, Logger } from '@nestjs/common';
import { ErrorDeDominio } from '../../compartido/dominio/error-de-dominio.js';
import { REPORTE_REPOSITORY, type ReporteRepository } from '../dominio/reporte.repository.js';
import { Reporte } from '../dominio/reporte.js';
import { ExportarReporte } from './exportar-reporte.js';

export class IaNoDisponible extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('IA_NO_DISPONIBLE', mensaje);
  }
}

@Injectable()
export class GenerarReporte {
  private readonly logger = new Logger(GenerarReporte.name);

  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly repo: ReporteRepository,
    private readonly exportar: ExportarReporte,
  ) {}

  /** @param token token del gerente; ms-ia lo reenvía a ms-ventas y ms-inventario */
  async ejecutar(consulta: string, creadoPor: string, token: string): Promise<Reporte> {
    const iaUrl = process.env.IA_URL || 'http://ms-ia:8002';
    let respuesta: Response;
    try {
      respuesta = await fetch(`${iaUrl}/reportes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consulta }),
        signal: AbortSignal.timeout(300_000),
      });
    } catch (e) {
      this.logger.warn('No se pudo conectar con ms-ia', e);
      throw new IaNoDisponible('No se pudo conectar con el agente de reportes. Intenta de nuevo.');
    }
    if (!respuesta.ok) {
      this.logger.warn(`ms-ia respondió ${respuesta.status}`);
      throw new IaNoDisponible(`El agente de reportes respondió con error (${respuesta.status}).`);
    }

    const ia = await respuesta.json();
    const columnas: string[] = ia.columnas ?? [];
    const tipoGrafico = ia.tipoGrafico ?? 'tabla';
    const resumen: string = ia.resumen ?? '';
    const datosFormateados: Record<string, any>[] = (ia.datos ?? []).map((fila: any[]) =>
      Object.fromEntries(columnas.map((col, i) => [col, fila[i] ?? '—'])),
    );

    const reporte = new Reporte({
      consulta,
      columnas,
      datos: datosFormateados,
      tipoGrafico: tipoGrafico as any,
      resumen,
      creadoPor,
      fecha: new Date(),
    });

    const guardado = await this.repo.guardar(reporte);

    if (guardado.id) {
      try {
        await this.exportar.ejecutar(guardado.id, 'PDF');
      } catch (err) {
        this.logger.warn('Error pre-generando PDF', err);
      }
    }

    return guardado;
  }
}

