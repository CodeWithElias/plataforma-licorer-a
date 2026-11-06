import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { EXPORTAR_REPORTE, LISTAR_REPORTES, mensajeDeError, ReporteItem } from './reportes.graphql.js';

@Component({
  selector: 'app-historial-reportes',
  imports: [RouterLink],
  template: `
    <header class="encabezado">
      <div>
        <h1>Historial de informes</h1>
        <p>Consulta, descarga o vuelve a ejecutar los informes generados.</p>
      </div>
      <button type="button" class="boton-secundario" (click)="cargar()" [disabled]="cargando()">
        🔄 Actualizar
      </button>
    </header>

    @if (error()) {
      <div class="alerta error"><strong>Error al cargar el historial:</strong> {{ error() }}</div>
    } @else {
      <div class="tarjeta tabla-scroll">
        <table class="tabla-historial">
          <thead>
            <tr>
              <th>INFORME</th>
              <th>PARÁMETROS</th>
              <th>ESTADO</th>
              <th>GENERADO POR</th>
              <th>FECHA</th>
              <th style="text-align: right">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            @for (r of reportes(); track r.id) {
              <tr>
                <td>
                  <div class="celda-reporte">
                    <span class="icono-doc" aria-hidden="true">📄</span>
                    <div>
                      <strong>{{ r.consulta }}</strong>
                      <span class="id-rep">{{ r.id }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ formatearParametros(r.consulta) }}</td>
                <td>
                  <span class="badge-estado" [class.automatico]="r.creadoPor.includes('n8n')">
                    {{ r.creadoPor.includes('n8n') ? 'Automático' : 'Listo' }}
                  </span>
                </td>
                <td>{{ r.creadoPor }}</td>
                <td>{{ formatearFecha(r.fecha) }}</td>
                <td class="acciones">
                  <a class="boton-enlace" routerLink="../reportes">Abrir informes</a>
                  <button type="button" class="boton-enlace" (click)="descargarPdf(r.id)">PDF</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="vacio">No hay informes generados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .tabla-scroll { overflow-x: auto; }
    .tabla-historial { width: 100%; min-width: 860px; border-collapse: collapse; }
    th { padding: .8rem 1rem; background: #f7f4ff; color: #6c6880; text-align: left; font-size: .72rem; letter-spacing: .04em; }
    td { padding: 1rem; border-top: 1px solid #ebe7f4; color: #4b4660; font-size: .88rem; }
    .celda-reporte { display: flex; align-items: center; gap: .7rem; min-width: 260px; }
    .celda-reporte strong { display: block; color: #241a38; }
    .icono-doc { font-size: 1.15rem; }
    .id-rep { display: block; margin-top: .2rem; color: #9a96ab; font-size: .72rem; }
    .badge-estado { padding: .25rem .55rem; border-radius: 999px; background: #e9f8f1; color: #12805c; font-size: .75rem; font-weight: 600; }
    .badge-estado.automatico { background: #efe9ff; color: #6a2fd0; }
    .acciones { text-align: right; white-space: nowrap; }
    .boton-enlace { border: 0; background: transparent; color: #6a2fd0; cursor: pointer; font: inherit; font-size: .82rem; font-weight: 600; margin-left: .65rem; text-decoration: none; }
    .boton-enlace:hover { color: #241a38; text-decoration: underline; }
    .vacio { padding: 3rem 1rem; text-align: center; color: #6c6880; }
  `,
})
export class HistorialReportes implements OnInit {
  private readonly apollo = inject(Apollo);
  protected readonly reportes = signal<ReporteItem[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.apollo.query({ query: LISTAR_REPORTES, fetchPolicy: 'network-only' }));
      this.reportes.set(res.data?.reportes ?? []);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async descargarPdf(id: string) {
    try {
      const res = await firstValueFrom(this.apollo.mutate({
        mutation: EXPORTAR_REPORTE,
        variables: { id, formato: 'PDF' },
      }));
      const url = res.data?.exportarReporte?.url;
      if (url) window.open(url.replace(/http:\/\/ms-gestion:3000/, ''), '_blank');
    } catch (e) {
      this.error.set(`No se pudo descargar el PDF: ${mensajeDeError(e)}`);
    }
  }

  formatearParametros(consulta: string): string {
    const q = consulta.toLowerCase();
    return `${q.includes('hoy') ? 'Hoy' : q.includes('semana') ? 'Semana' : 'Mes'} · ${q.includes('producto') ? 'Producto' : 'Categoría'} · ${q.includes('anterior') ? 'vs anterior' : 'Estándar'}`;
  }

  formatearFecha(iso: string): string {
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleDateString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
