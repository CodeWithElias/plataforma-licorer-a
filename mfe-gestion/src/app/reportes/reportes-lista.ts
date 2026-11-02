import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import {
  EXPORTAR_REPORTE,
  GENERAR_REPORTE,
  LISTAR_REPORTES,
  mensajeDeError,
  ReporteItem,
} from './reportes.graphql.js';

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

    <!-- Panel Generador de Reportes con IA -->
    <section class="tarjeta-ia">
      <div class="ia-cabecera">
        <div class="ia-badge">
          <span>✨</span>
          <span>AGENTE DE INTELIGENCIA ARTIFICIAL (CU07)</span>
        </div>
        <h2>Generar Reporte Dinámico por Lenguaje Natural</h2>
        <p>Consulta en tus propias palabras o dicta por voz. El agente LangGraph extrae las ventas de PostgreSQL vía MCP y redacta el análisis ejecutivo.</p>
      </div>

      <div class="ia-prompt-box">
        <div class="ia-input-wrapper">
          <span class="ia-input-icon" aria-hidden="true">💬</span>
          <input
            type="text"
            class="ia-input"
            placeholder="Ej: Ventas de hoy por producto, o rendimiento de vinos vs cervezas..."
            [value]="consulta()"
            (input)="consulta.set($any($event.target).value)"
            (keyup.enter)="generarReporteIa()"
            [disabled]="generando()"
          />
          <button
            type="button"
            class="btn-mic"
            [class.grabando]="grabando()"
            (click)="alternarVoz()"
            title="Dictar consulta por voz"
            [disabled]="generando()"
          >
            🎤
          </button>
        </div>
        <button
          type="button"
          class="btn-generar"
          (click)="generarReporteIa()"
          [disabled]="generando() || !consulta().trim()"
        >
          @if (generando()) {
            <span class="spinner" aria-hidden="true">⏳</span>
            <span>Analizando con IA…</span>
          } @else {
            <span>🚀 Generar Reporte</span>
          }
        </button>
      </div>

      <!-- Chips de consultas frecuentes -->
      <div class="ia-chips">
        <span class="chip-label">Consultas rápidas:</span>
        <button type="button" class="chip" (click)="usarSugerencia('Ventas de hoy por producto en barras')">
          📅 Ventas de hoy por producto
        </button>
        <button type="button" class="chip" (click)="usarSugerencia('Productos con mayor recaudación de la jornada')">
          🏆 Mayor recaudación
        </button>
        <button type="button" class="chip" (click)="usarSugerencia('Ventas de cerveza comparadas con vinos')">
          🍺 Cervezas vs Vinos
        </button>
        <button type="button" class="chip" (click)="usarSugerencia('Estado de stock y productos bajo el mínimo')">
          📦 Stock bajo mínimo
        </button>
      </div>
    </section>

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
            <span>Escribe una consulta arriba para generar tu primer reporte ejecutivo con IA.</span>
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
    .tarjeta-ia {
      background: linear-gradient(135deg, #faf8ff 0%, #ffffff 100%);
      border: 1.5px solid var(--lila-200);
      border-radius: 16px;
      padding: 1.5rem 1.6rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.08);
    }
    .ia-cabecera {
      margin-bottom: 1.1rem;
    }
    .ia-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      background: var(--lila-100);
      color: var(--lila-700);
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 0.5rem;
    }
    .ia-cabecera h2 {
      font-size: 1.25rem;
      font-weight: 750;
      color: var(--tinta);
      margin: 0 0 0.25rem 0;
    }
    .ia-cabecera p {
      font-size: 0.88rem;
      color: var(--gris);
      margin: 0;
    }
    .ia-prompt-box {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.85rem;
    }
    .ia-input-wrapper {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .ia-input-icon {
      position: absolute;
      left: 1rem;
      font-size: 1rem;
      opacity: 0.6;
      pointer-events: none;
    }
    .ia-input {
      width: 100%;
      padding: 0.85rem 3rem 0.85rem 2.8rem;
      border: 1.5px solid var(--borde);
      border-radius: 12px;
      font-size: 0.95rem;
      background: #ffffff;
      color: var(--tinta);
      outline: none;
      transition: all 0.15s;
    }
    .ia-input:focus {
      border-color: var(--lila-500);
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
    }
    .btn-mic {
      position: absolute;
      right: 0.65rem;
      background: transparent;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0.35rem;
      border-radius: 8px;
      transition: all 0.15s;
    }
    .btn-mic:hover {
      background: var(--lila-50);
      transform: scale(1.1);
    }
    .btn-mic.grabando {
      background: #fee2e2;
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.2); }
    }
    .btn-generar {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.85rem 1.4rem;
      background: linear-gradient(135deg, var(--lila-600) 0%, var(--lila-700) 100%);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(106, 47, 208, 0.25);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn-generar:hover:not([disabled]) {
      background: linear-gradient(135deg, var(--lila-700) 0%, var(--lila-800) 100%);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(106, 47, 208, 0.35);
    }
    .btn-generar[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .ia-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .chip-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--gris-claro);
    }
    .chip {
      background: #ffffff;
      border: 1px solid var(--lila-200);
      border-radius: 999px;
      padding: 0.32rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--lila-700);
      cursor: pointer;
      transition: all 0.12s;
    }
    .chip:hover {
      background: var(--lila-50);
      border-color: var(--lila-500);
      transform: translateY(-1px);
    }

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
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--tinta);
    }
    .metrica-detalle {
      font-size: 0.78rem;
      color: var(--gris-claro);
    }
    .col-reporte {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .icono-tipo {
      font-size: 1.35rem;
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
  protected readonly generando = signal(false);
  protected readonly grabando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly descargandoId = signal<string | null>(null);

  protected readonly consulta = signal('Ventas de hoy por producto en barras');

  protected readonly resumen = computed(() => {
    const total = this.reportes().length;
    return `${total} ${total === 1 ? 'reporte disponible' : 'reportes disponibles'}`;
  });

  ngOnInit() {
    void this.cargar();
  }

  usarSugerencia(texto: string) {
    this.consulta.set(texto);
  }

  alternarVoz() {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo. Por favor escribe tu consulta.');
      return;
    }

    if (this.grabando()) {
      this.grabando.set(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-BO';
      recognition.continuous = false;
      recognition.interimResults = false;

      this.grabando.set(true);

      recognition.onresult = (event: any) => {
        const texto = event.results[0][0].transcript;
        if (texto) {
          this.consulta.set(texto);
        }
        this.grabando.set(false);
      };

      recognition.onerror = () => {
        this.grabando.set(false);
      };

      recognition.onend = () => {
        this.grabando.set(false);
      };

      recognition.start();
    } catch {
      this.grabando.set(false);
    }
  }

  async generarReporteIa() {
    const promptTexto = this.consulta().trim();
    if (!promptTexto) return;

    this.generando.set(true);
    this.error.set(null);

    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: GENERAR_REPORTE,
          variables: { consulta: promptTexto },
        }),
      );

      const nuevo = res.data?.generarReporte;
      if (nuevo) {
        // Colocar al inicio de la lista
        this.reportes.update((prev) => [nuevo, ...prev.filter((r) => r.id !== nuevo.id)]);
      } else {
        await this.cargar();
      }
    } catch (e) {
      alert(`Error al generar reporte con IA: ${mensajeDeError(e)}`);
    } finally {
      this.generando.set(false);
    }
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

      let url = res.data?.exportarReporte?.url;
      if (url) {
        if (url.includes('ms-gestion:3000')) {
          url = url.replace(/http:\/\/ms-gestion:3000/, '');
        }
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
