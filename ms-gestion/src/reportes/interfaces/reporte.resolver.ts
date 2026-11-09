import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Roles, TokenActual, UsuarioActual } from '../../compartido/auth/decoradores.js';
import type { Usuario } from '../../compartido/auth/usuario.js';
import { conErroresGraphql } from '../../compartido/interfaces/errores-graphql.js';
import { ListarReportes } from '../aplicacion/listar-reportes.js';
import { ExportarReporte } from '../aplicacion/exportar-reporte.js';
import { GenerarReporte } from '../aplicacion/generar-reporte.js';
import type { Reporte } from '../dominio/reporte.js';

/** CU07 – Reportes generados y su exportación (GERENTE o ADMIN). */
@Roles('GERENTE', 'ADMIN')
@Resolver('Reporte')
export class ReporteResolver {
  constructor(
    private readonly listar: ListarReportes,
    private readonly exportar: ExportarReporte,
    private readonly generar: GenerarReporte,
  ) {}

  @Query()
  reportes() {
    return conErroresGraphql(async () => {
      const lista = await this.listar.ejecutar();
      return lista.map(aGraphql);
    });
  }

  // Solo GERENTE: el agente consulta ventas y stock con el token de quien pide el reporte
  @Roles('GERENTE')
  @Mutation()
  generarReporte(
    @Args('consulta') consulta: string,
    @UsuarioActual() usuario: Usuario,
    @TokenActual() token: string,
  ) {
    return conErroresGraphql(async () => {
      const creado = await this.generar.ejecutar(consulta, usuario.usuario, token);
      return aGraphql(creado);
    });
  }

  @Mutation()
  exportarReporte(
    @Args('id') id: string,
    @Args('formato') formato: 'PDF' | 'XLSX',
  ) {
    return conErroresGraphql(async () => {
      const archivo = await this.exportar.ejecutar(id, formato);
      return {
        formato: archivo.formato,
        url: archivo.url,
      };
    });
  }
}

function aGraphql(r: Reporte) {
  return {
    id: r.id,
    consulta: r.consulta,
    datos: JSON.stringify(r.datos ?? []),
    tipoGrafico: r.tipoGrafico,
    resumen: r.resumen,
    creadoPor: r.creadoPor,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString() : String(r.fecha),
  };
}

