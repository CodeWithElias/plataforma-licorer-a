import { Inject, Injectable } from '@nestjs/common';
import { REPORTE_REPOSITORY, type ReporteRepository } from '../dominio/reporte.repository.js';
import { Reporte } from '../dominio/reporte.js';

@Injectable()
export class ListarReportes {
  constructor(
    @Inject(REPORTE_REPOSITORY)
    private readonly repo: ReporteRepository,
  ) {}

  async ejecutar(): Promise<Reporte[]> {
    return this.repo.listar();
  }
}
