import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  EXPORTAR_REPORTE,
  LISTAR_REPORTES,
  mensajeDeError,
  ReporteItem,
} from './reportes.graphql';

@Component({
  selector: 'app-reportes-lista',
  template: `
    <header class="encabezado">
      <div>
        <h1>Reportes Ejecutivos y Ventas</h1>
        <p>Reportes generados por el agente de IA y consolidados diarios para la gerencia (CU07).</p>
      </div>
      <div class="acciones-encabezado">
        <button type="button" class="boton-secundario" (click)="cargar()" [disabled]="cargando()">
          🔄 Actualizar
        </button>
      </div>
    </header>

    <!-- Tarjetas de métricas rápidas -->
    <div class="grid-metricas">
      <div class="tarjeta-metrica">
        <span class="metrica-etiqueta">Total Reportes</span>
        <span class="metrica-valor">{{ reportes().length }}</span>
        <small class="metrica-detalle">Histórico generado</small>
      </div>
      <div class="tarjeta-metrica">
        <span class="metrica-etiqueta">Automatización</span>
        <span class="metrica-valor">Activa (23:00)</span>
        <small class="metrica-detalle">Flujo diario n8n</small>
      </div>
      <div class="tarjeta-metrica">
        <span class="metrica-etiqueta">Exportación</span>
        <span class="metrica-valor">PDF / XLSX</span>
        <small class="metrica-detalle">Formato oficial</small>
      </div>
    </div>

    @if (error()) {
      <div class="alerta error">
        <strong>Error al cargar reportes</strong>
        <span>{{ error() }}</span>
      </div>
    } @else {
      <div class="tarjeta tabla-contenedor">
        @if (cargando()) {
          <div class="estado-vacio">Cargando reportes consolidados…</div>
        } @else if (reportes().length === 0) {
          <div class="estado-vacio">
            <strong>No hay reportes generados todavía</strong>
            <span>Los reportes se generan a las 23:00 con el workflow de n8n o vía el agente IA.</span>
          </div>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Consulta / Reporte</th>
                <th>Resumen Ejecutivo</th>
                <th>Generado Por</th>
                <th>Fecha</th>
                <th style="text-align: right">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reportes(); track r.id) {
                <tr>
                  <td>
                    <div class="col-reporte">
                      <span class="icono-tipo" aria-hidden="true">📊</span>
                      <div>
                        <strong class="titulo-consulta">{{ r.consulta }}</strong>
                        <span class="subtexto-id">ID: {{ r.id }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="resumen-texto">
                      {{ r.resumen || 'Sin resumen ejecutivo generado.' }}
                    </div>
                  </td>
                  <td>
                    <span class="badge-creador">{{ r.creadoPor }}</span>
                  </td>
                  <td class="fecha-col">
                    {{ formatearFecha(r.fecha) }}
                  </td>
                  <td class="accion-col">
                    <button
                      type="button"
                      class="btn-descarga"
                      [disabled]="descargandoId() === r.id"
                      (click)="descargarPdf(r.id)"
                    >
                      @if (descargandoId() === r.id) {
                        <span>Generando…</span>
                      } @else {
                        <span>📄 Descargar PDF</span>
                      }
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <footer class="pie">{{ resumen() }}</footer>
        }
      </div>
    }
  `,
  styles: `
    .grid-metricas {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .tarjeta-metrica {
      background: #ffffff;
      border: 1px solid var(--borde);
      border-radius: 14px;
      padding: 1.1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      box-shadow: var(--sombra);
    }
    .metrica-etiqueta {
      font-size: 0.8rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--gris-claro);
    }
    .metrica-valor {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--lila-700);
    }
    .metrica-detalle {
      font-size: 0.78rem;
      color: var(--gris);
    }

    .tabla-contenedor {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }
    thead th {
      padding: 0.85rem 1.1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gris-claro);
      background: var(--lila-50);
      border-bottom: 1px solid var(--borde);
    }
    tbody td {
      padding: 0.95rem 1.1rem;
      border-bottom: 1px solid var(--borde);
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
    tbody tr {
      transition: background 0.12s;
    }
    tbody tr:hover {
      background: #fcfbff;
    }

    .col-reporte {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .icono-tipo {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--lila-100);
      font-size: 1.1rem;
      flex: none;
    }
    .titulo-consulta {
      display: block;
      color: var(--tinta);
      font-weight: 600;
    }
    .subtexto-id {
      display: block;
      font-size: 0.78rem;
      color: var(--gris-claro);
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    }
    .resumen-texto {
      max-width: 360px;
      color: var(--gris);
      font-size: 0.86rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .badge-creador {
      display: inline-block;
      padding: 0.18rem 0.55rem;
      border-radius: 6px;
      background: var(--lila-50);
      border: 1px solid var(--lila-200);
      color: var(--lila-700);
      font-size: 0.78rem;
      font-weight: 600;
    }
    .fecha-col {
      color: var(--gris);
      font-size: 0.86rem;
      white-space: nowrap;
    }
    .accion-col {
      text-align: right;
      white-space: nowrap;
    }
    .btn-descarga {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.45rem 0.85rem;
      border: 1px solid var(--lila-200);
      border-radius: 8px;
      background: #ffffff;
      color: var(--lila-700);
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.12s;
    }
    .btn-descarga:hover:not([disabled]) {
      background: var(--lila-50);
      border-color: var(--lila-500);
      transform: translateY(-1px);
    }
    .btn-descarga[disabled] {
      opacity: 0.5;
      cursor: wait;
    }
    .pie {
      padding: 0.75rem 1.1rem;
      border-top: 1px solid var(--borde);
      color: var(--gris-claro);
      font-size: 0.82rem;
    }
  `,
})
export class ReportesLista implements OnInit {
  private readonly apollo = inject(Apollo);

  protected readonly reportes = signal<ReporteItem[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly descargandoId = signal<string | null>(null);

  protected readonly resumen = computed(() => {
    const total = this.reportes().length;
    return `${total} ${total === 1 ? 'reporte disponible' : 'reportes disponibles'}`;
  });

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.query({
          query: LISTAR_REPORTES,
          fetchPolicy: 'network-only',
        }),
      );
      this.reportes.set(res.data?.reportes ?? []);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async descargarPdf(id: string) {
    this.descargandoId.set(id);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: EXPORTAR_REPORTE,
          variables: { id, formato: 'PDF' },
        }),
      );

      const url = res.data?.exportarReporte?.url;
      if (url) {
        window.open(url, '_blank');
      }
    } catch (e) {
      alert(`No se pudo descargar el reporte: ${mensajeDeError(e)}`);
    } finally {
      this.descargandoId.set(null);
    }
  }

  formatearFecha(iso: string): string {
    try {
      const f = new Date(iso);
      return f.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}

