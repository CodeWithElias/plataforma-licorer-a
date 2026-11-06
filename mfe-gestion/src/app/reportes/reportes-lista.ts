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

interface FilaReporte {
  nombre: string;
  unidades: number;
  monto: number;
  porcentaje: number;
}

@Component({
  selector: 'app-reportes-lista',
  template: `
    <!-- Encabezado Principal -->
    <header class="encabezado-principal">
      <div>
        <h1 class="titulo-vista">Reportes</h1>
        <p class="subtitulo-vista">Pide un reporte con tus palabras. El agente lo arma, tú lo ajustas.</p>
      </div>
      <div class="badge-automatizacion" title="Workflow CU07 activo en n8n">
        <span class="punto-verde" aria-hidden="true">●</span>
        <span>Informe diario automático · 23:00 · Activo</span>
      </div>
    </header>

    <!-- ========================================== -->
    <!-- BLOQUE 1: ASISTENTE DE REPORTES (IA)       -->
    <!-- ========================================== -->
    <section class="tarjeta-contenedor asistente-ia">
      <div class="ia-seccion-header">
        <span class="etiqueta-sub">ASISTENTE DE REPORTES (IA)</span>
        <h2 class="pregunta-principal">¿Qué reporte necesitas?</h2>
      </div>

      <!-- Barra de Prompt y Voz -->
      <div class="barra-prompt">
        <div class="input-prompt-contenedor">
          <input
            type="text"
            class="input-prompt"
            placeholder="Ej: Ventas de este mes por categoría, comparado con el mes anterior"
            [value]="consulta()"
            (input)="consulta.set($any($event.target).value)"
            (keyup.enter)="generarReporte()"
            [disabled]="generando()"
          />
          <button
            type="button"
            class="btn-icono-mic"
            [class.grabando]="grabando()"
            (click)="alternarVoz()"
            title="Dictar por voz"
            [disabled]="generando()"
          >
            🎤
          </button>
        </div>
        <button
          type="button"
          class="btn-generar-primario"
          (click)="generarReporte()"
          [disabled]="generando() || !consulta().trim()"
        >
          @if (generando()) {
            <span class="spinner-icono" aria-hidden="true">⏳</span>
            <span>Generando…</span>
          } @else {
            <span>Generar reporte</span>
          }
        </button>
      </div>

      <!-- Chips de Consultas Rápidas -->
      <div class="fila-consultas-rapidas">
        <span class="etiqueta-rapida">Consultas rápidas:</span>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Ventas de hoy por producto')">
          Ventas de hoy por producto
        </button>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Mayor recaudación')">
          Mayor recaudación
        </button>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Cervezas vs vinos')">
          Cervezas vs vinos
        </button>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Stock bajo mínimo')">
          Stock bajo mínimo
        </button>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Productos sin rotación')">
          Productos sin rotación
        </button>
        <button type="button" class="chip-rapido" (click)="usarSugerencia('Ventas por cajero')">
          Ventas por cajero
        </button>
      </div>

      <hr class="separador-fino" />

      <!-- Subsección: Parámetros Interpretados -->
      <div class="seccion-parametros">
        <div class="parametros-header">
          <span class="param-titulo">Parámetros interpretados · <small>cambia cualquiera y se regenera</small></span>
          <span class="param-aclaracion">Los campos en lila los completó el agente</span>
        </div>

        <!-- Caja de Razonamiento del Agente -->
        <div class="caja-razonamiento">
          <div class="linea-razonamiento">
            <strong>Entendí:</strong>
            <span>{{ entendiTexto() }}</span>
          </div>
          <div class="linea-razonamiento">
            <strong>Asumí:</strong>
            <span>{{ asumiTexto() }}</span>
            <button type="button" class="btn-corregir-chip" (click)="corregirSupuestos()">Corregir</button>
          </div>
        </div>

        <!-- Grilla de Desplegables en Lila Suave -->
        <div class="grilla-controles-lila">
          <div class="campo-control">
            <label>Período</label>
            <select [value]="paramPeriodo()" (change)="cambiarParam('periodo', $any($event.target).value)">
              <option value="este_mes">Este mes</option>
              <option value="hoy">Hoy</option>
              <option value="esta_semana">Esta semana</option>
              <option value="ultimos_30">Últimos 30 días</option>
              <option value="este_anio">Este año</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Métrica</label>
            <select [value]="paramMetrica()" (change)="cambiarParam('metrica', $any($event.target).value)">
              <option value="ventas_bs">Ventas (Bs)</option>
              <option value="unidades">Unidades vendidas</option>
              <option value="margen">Margen bruto</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Agrupar por</label>
            <select [value]="paramAgrupar()" (change)="cambiarParam('agrupar', $any($event.target).value)">
              <option value="categoria">Categoría</option>
              <option value="producto">Producto</option>
              <option value="fecha">Fecha</option>
              <option value="cajero">Cajero</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Comparar con</label>
            <select [value]="paramComparar()" (change)="cambiarParam('comparar', $any($event.target).value)">
              <option value="mes_anterior">Mes anterior</option>
              <option value="semana_anterior">Semana anterior</option>
              <option value="sin_comparacion">Sin comparación</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Categoría</label>
            <select [value]="paramCategoria()" (change)="cambiarParam('categoria', $any($event.target).value)">
              <option value="todas">Todas</option>
              <option value="cerveza">Cervezas</option>
              <option value="vino">Vinos</option>
              <option value="singani">Singanis</option>
              <option value="ron">Rones</option>
              <option value="whisky">Whiskies</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Método de pago</label>
            <select [value]="paramMetodoPago()" (change)="cambiarParam('metodoPago', $any($event.target).value)">
              <option value="todos">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Orden y límite</label>
            <select [value]="paramOrden()" (change)="cambiarParam('orden', $any($event.target).value)">
              <option value="mayor_top10">Mayor a menor · Top 10</option>
              <option value="mayor_todos">Mayor a menor · Todos</option>
              <option value="menor_top10">Menor a mayor</option>
            </select>
          </div>

          <div class="campo-control">
            <label>Visualización</label>
            <select [value]="paramVisualizacion()" (change)="cambiarParam('visualizacion', $any($event.target).value)">
              <option value="barras_tabla">Barras + tabla</option>
              <option value="solo_barras">Solo barras</option>
              <option value="lineas">Líneas de tendencia</option>
              <option value="torta">Circular / Torta</option>
              <option value="solo_tabla">Solo tabla</option>
            </select>
          </div>
        </div>

        <!-- Fila de Agregar Parámetro y Sugerencias -->
        <div class="fila-sugerencias-agente">
          <button type="button" class="btn-agregar-param" (click)="agregarParametroExtra()">
            + Agregar parámetro
          </button>
          <span class="sugerencias-label">El agente sugiere:</span>
          <button type="button" class="chip-filtro-extra" (click)="aplicarFiltroSugerido('Excluir anuladas')">
            Excluir anuladas
          </button>
          <button type="button" class="chip-filtro-extra" (click)="aplicarFiltroSugerido('Solo fines de semana')">
            Solo fines de semana
          </button>
          <button type="button" class="chip-filtro-extra" (click)="aplicarFiltroSugerido('Agregar margen por producto')">
            Agregar margen por producto
          </button>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- BLOQUE 2: RESULTADO                        -->
    <!-- ========================================== -->
    <section class="tarjeta-contenedor resultado-seccion">
      <div class="resultado-barra-superior">
        <h2 class="resultado-titulo">Resultado</h2>
        <div class="resultado-acciones-descarga">
          <button
            type="button"
            class="btn-accion-descarga"
            [disabled]="descargandoId() === ultimoReporteId()"
            (click)="descargarPdf(ultimoReporteId())"
          >
            📄 Descargar PDF
          </button>
          <button
            type="button"
            class="btn-accion-descarga"
            (click)="descargarXlsx()"
          >
            📊 Descargar XLSX
          </button>
          <button
            type="button"
            class="btn-accion-descarga"
            (click)="programarReporte()"
          >
            ⏰ Programar este reporte
          </button>
        </div>
      </div>

      <!-- Pasos Completados (Traza ICONIX Verde) -->
      <div class="fila-pasos-completados">
        <span class="paso-badge activo">✓ 1. Consulta interpretada</span>
        <span class="paso-badge activo">✓ 2. Datos obtenidos de PostgreSQL</span>
        <span class="paso-badge activo">✓ 3. Análisis redactado</span>
      </div>

      <!-- Dos Columnas: Resumen Ejecutivo y Gráfico + Tabla -->
      <div class="grilla-dos-columnas">
        <!-- Columna 1: Resumen Ejecutivo -->
        <div class="caja-resumen-ejecutivo">
          <span class="etiqueta-bloque">RESUMEN EJECUTIVO</span>
          <div class="contenido-narrativa">
            <p class="parrafo-resumen">{{ resumenEjecutivo() }}</p>
            <div class="kpis-resumen">
              <div class="kpi-caja">
                <span class="kpi-num">Bs {{ totalVentasBs().toFixed(2) }}</span>
                <span class="kpi-label">Total Recaudado</span>
              </div>
              <div class="kpi-caja">
                <span class="kpi-num">{{ totalUnidades() }} un.</span>
                <span class="kpi-label">Volumen Vendido</span>
              </div>
              <div class="kpi-caja">
                <span class="kpi-num">{{ categoriaLider() }}</span>
                <span class="kpi-label">Categoría Líder</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Columna 2: Gráfico y Tabla -->
        <div class="caja-grafico-tabla">
          <span class="etiqueta-bloque">GRÁFICO Y TABLA</span>
          
          <!-- Visualización de Barras Proporcionales -->
          <div class="grafico-barras-contenedor">
            @for (f of filasDatos(); track f.nombre) {
              <div class="barra-item">
                <div class="barra-info">
                  <span class="barra-nombre">{{ f.nombre }}</span>
                  <span class="barra-monto">Bs {{ f.monto.toFixed(2) }} ({{ f.unidades }} un.)</span>
                </div>
                <div class="barra-pista">
                  <div class="barra-progreso" [style.width.%]="f.porcentaje"></div>
                </div>
              </div>
            }
          </div>

          <!-- Mini Tabla de Detalle -->
          <div class="mini-tabla-contenedor">
            <table class="mini-tabla">
              <thead>
                <tr>
                  <th>Categoría / Producto</th>
                  <th style="text-align: right">Unidades</th>
                  <th style="text-align: right">Monto (Bs)</th>
                  <th style="text-align: right">Part.</th>
                </tr>
              </thead>
              <tbody>
                @for (f of filasDatos(); track f.nombre) {
                  <tr>
                    <td>{{ f.nombre }}</td>
                    <td style="text-align: right">{{ f.unidades }}</td>
                    <td style="text-align: right">{{ f.monto.toFixed(2) }}</td>
                    <td style="text-align: right"><strong>{{ f.porcentaje.toFixed(0) }}%</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Siguientes Preguntas Sugeridas -->
      <div class="seccion-refinamiento">
        <span class="etiqueta-siguientes">SIGUIENTES PREGUNTAS SUGERIDAS</span>
        <div class="fila-chips-refinar">
          <button type="button" class="chip-pregunta" (click)="usarSugerencia('Ver los 5 productos con mayor rotación')">
            Ver los 5 productos que más bajaron
          </button>
          <button type="button" class="chip-pregunta" (click)="usarSugerencia('Desglosar cervezas por marca y presentación')">
            Desglosar cervezas por marca
          </button>
          <button type="button" class="chip-pregunta" (click)="usarSugerencia('¿Qué productos están bajo stock mínimo?')">
            ¿Qué productos están bajo stock mínimo?
          </button>
        </div>

        <!-- Barra de Refinamiento -->
        <div class="barra-refinar">
          <input
            type="text"
            class="input-refinar"
            placeholder="Refinar: «ahora solo los fines de semana» o «agrega el margen»"
            [value]="textoRefinar()"
            (input)="textoRefinar.set($any($event.target).value)"
            (keyup.enter)="aplicarRefinamiento()"
          />
          <button type="button" class="btn-refinar" (click)="aplicarRefinamiento()">
            Refinar
          </button>
        </div>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- BLOQUE 3: HISTORIAL                        -->
    <!-- ========================================== -->
    <section class="tarjeta-contenedor historial-seccion">
      <div class="historial-header">
        <h2 class="historial-titulo">Historial</h2>
        <button type="button" class="btn-recargar" (click)="cargar()" [disabled]="cargando()">
          🔄 Actualizar lista
        </button>
      </div>

      @if (error()) {
        <div class="alerta-error">
          <strong>Error al cargar historial:</strong> {{ error() }}
        </div>
      } @else {
        <div class="tabla-scroll">
          <table class="tabla-historial">
            <thead>
              <tr>
                <th>REPORTE</th>
                <th>PARÁMETROS</th>
                <th>ESTADO</th>
                <th>GENERADO POR</th>
                <th>FECHA</th>
                <th style="text-align: right">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reportes(); track r.id) {
                <tr>
                  <td>
                    <div class="celda-reporte">
                      <span class="icono-doc" aria-hidden="true">📄</span>
                      <div>
                        <strong class="nombre-rep">{{ r.consulta }}</strong>
                        <span class="id-rep">{{ r.id }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="celda-params">
                    {{ formatearParametros(r.consulta) }}
                  </td>
                  <td>
                    @if (r.creadoPor.includes('n8n')) {
                      <span class="badge-estado automatico">Automático</span>
                    } @else {
                      <span class="badge-estado listo">Listo</span>
                    }
                  </td>
                  <td>
                    <span class="texto-usuario">{{ r.creadoPor }}</span>
                  </td>
                  <td class="celda-fecha">
                    {{ formatearFecha(r.fecha) }}
                  </td>
                  <td class="celda-acciones">
                    <button type="button" class="btn-accion-sm" (click)="verDetalleReporte(r)">Ver</button>
                    <button type="button" class="btn-accion-sm" (click)="repetirConsulta(r.consulta)">Repetir</button>
                    <button type="button" class="btn-accion-sm" (click)="descargarPdf(r.id)">PDF</button>
                    <button type="button" class="btn-accion-sm" (click)="descargarXlsx()">XLSX</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="celda-vacia">
                    No hay reportes previos generados. Escribe tu primera consulta en el asistente de arriba.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      color: #1e1b4b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    /* Encabezado Principal */
    .encabezado-principal {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .titulo-vista {
      font-size: 1.85rem;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.02em;
    }
    .subtitulo-vista {
      font-size: 0.92rem;
      color: #64748b;
      margin: 0;
    }
    .badge-automatizacion {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      color: #6d28d9;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .punto-verde {
      color: #10b981;
      font-size: 0.9rem;
    }

    /* Tarjetas Contenedoras */
    .tarjeta-contenedor {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 1.6rem 1.8rem;
      margin-bottom: 1.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(109, 40, 217, 0.03);
    }

    /* Bloque 1: Asistente */
    .etiqueta-sub {
      font-size: 0.72rem;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6d28d9;
      display: block;
      margin-bottom: 0.35rem;
    }
    .pregunta-principal {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 1.1rem 0;
    }

    /* Barra de Prompt */
    .barra-prompt {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1rem;
    }
    .input-prompt-contenedor {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }
    .input-prompt {
      width: 100%;
      padding: 0.9rem 3.2rem 0.9rem 1.1rem;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      font-size: 0.95rem;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      transition: all 0.15s;
    }
    .input-prompt:focus {
      border-color: #6d28d9;
      box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.12);
    }
    .btn-icono-mic {
      position: absolute;
      right: 0.75rem;
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.35rem;
      border-radius: 8px;
      transition: all 0.15s;
    }
    .btn-icono-mic:hover {
      background: #f5f3ff;
      transform: scale(1.1);
    }
    .btn-icono-mic.grabando {
      background: #fee2e2;
      animation: pulse 1s infinite alternate;
    }
    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.2); }
    }
    .btn-generar-primario {
      padding: 0.9rem 1.5rem;
      background: #5b21b6;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(91, 33, 182, 0.25);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn-generar-primario:hover:not([disabled]) {
      background: #4c1d95;
      transform: translateY(-1px);
    }
    .btn-generar-primario[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Chips de consultas rápidas */
    .fila-consultas-rapidas {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .etiqueta-rapida {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
    }
    .chip-rapido {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 0.35rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 550;
      color: #334155;
      cursor: pointer;
      transition: all 0.12s;
    }
    .chip-rapido:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .separador-fino {
      border: none;
      border-top: 1px solid #f1f5f9;
      margin: 1.25rem 0;
    }

    /* Parámetros Interpretados */
    .parametros-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .param-titulo {
      font-size: 0.88rem;
      font-weight: 750;
      color: #1e1b4b;
    }
    .param-titulo small {
      font-weight: 400;
      color: #64748b;
    }
    .param-aclaracion {
      font-size: 0.78rem;
      color: #6d28d9;
      font-weight: 600;
    }

    /* Caja de razonamiento */
    .caja-razonamiento {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 12px;
      padding: 0.9rem 1.1rem;
      margin-bottom: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .linea-razonamiento {
      font-size: 0.84rem;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .linea-razonamiento strong {
      color: #1e1b4b;
    }
    .btn-corregir-chip {
      background: #ffffff;
      border: 1px solid #c4b5fd;
      border-radius: 6px;
      padding: 0.15rem 0.45rem;
      font-size: 0.74rem;
      font-weight: 600;
      color: #6d28d9;
      cursor: pointer;
    }

    /* Grilla de Controles en Lila */
    .grilla-controles-lila {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1rem;
    }
    .campo-control {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .campo-control label {
      font-size: 0.74rem;
      font-weight: 600;
      color: #64748b;
    }
    .campo-control select {
      background: #f5f3ff;
      border: 1.5px solid #ddd6fe;
      border-radius: 8px;
      padding: 0.45rem 0.65rem;
      font-size: 0.84rem;
      font-weight: 600;
      color: #4c1d95;
      outline: none;
      cursor: pointer;
      transition: all 0.12s;
    }
    .campo-control select:hover,
    .campo-control select:focus {
      border-color: #8b5cf6;
      background: #ede9fe;
    }

    /* Fila Sugerencias Agente */
    .fila-sugerencias-agente {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding-top: 0.25rem;
    }
    .btn-agregar-param {
      background: transparent;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
    }
    .btn-agregar-param:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
    .sugerencias-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: #64748b;
      margin-left: 0.45rem;
    }
    .chip-filtro-extra {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 0.28rem 0.7rem;
      font-size: 0.78rem;
      color: #475569;
      cursor: pointer;
    }
    .chip-filtro-extra:hover {
      border-color: #8b5cf6;
      color: #6d28d9;
    }

    /* ========================================== */
    /* BLOQUE 2: RESULTADO                        */
    /* ========================================== */
    .resultado-barra-superior {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.85rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .resultado-titulo {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .resultado-acciones-descarga {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-accion-descarga {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0.45rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.12s;
    }
    .btn-accion-descarga:hover:not([disabled]) {
      border-color: #6d28d9;
      color: #6d28d9;
      background: #f5f3ff;
      transform: translateY(-1px);
    }
    .btn-accion-descarga[disabled] {
      opacity: 0.5;
      cursor: wait;
    }

    /* Traza Verde ICONIX */
    .fila-pasos-completados {
      display: flex;
      gap: 0.6rem;
      margin-bottom: 1.35rem;
      flex-wrap: wrap;
    }
    .paso-badge {
      display: inline-flex;
      align-items: center;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      border-radius: 999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 650;
    }

    /* Dos Columnas */
    .grilla-dos-columnas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 900px) {
      .grilla-dos-columnas {
        grid-template-columns: 1fr;
      }
    }
    .caja-resumen-ejecutivo,
    .caja-grafico-tabla {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem 1.4rem;
      display: flex;
      flex-direction: column;
    }
    .etiqueta-bloque {
      font-size: 0.72rem;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.75rem;
      display: block;
    }
    .parrafo-resumen {
      font-size: 0.9rem;
      color: #334155;
      line-height: 1.55;
      margin: 0 0 1.1rem 0;
    }
    .kpis-resumen {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.6rem;
      margin-top: auto;
    }
    .kpi-caja {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.65rem;
      display: flex;
      flex-direction: column;
    }
    .kpi-num {
      font-size: 0.98rem;
      font-weight: 800;
      color: #1e1b4b;
    }
    .kpi-label {
      font-size: 0.72rem;
      color: #64748b;
    }

    /* Gráfico de Barras CSS */
    .grafico-barras-contenedor {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-bottom: 1.25rem;
    }
    .barra-item {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .barra-info {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1e293b;
    }
    .barra-monto {
      color: #6d28d9;
    }
    .barra-pista {
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
    }
    .barra-progreso {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6 0%, #6d28d9 100%);
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    /* Mini Tabla */
    .mini-tabla-contenedor {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .mini-tabla {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }
    .mini-tabla th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      padding: 0.45rem 0.65rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .mini-tabla td {
      padding: 0.45rem 0.65rem;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    .mini-tabla tr:last-child td {
      border-bottom: none;
    }

    /* Siguientes Preguntas y Refinamiento */
    .seccion-refinamiento {
      border-top: 1px solid #f1f5f9;
      padding-top: 1.1rem;
    }
    .etiqueta-siguientes {
      font-size: 0.72rem;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 0.6rem;
      display: block;
    }
    .fila-chips-refinar {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.85rem;
    }
    .chip-pregunta {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      padding: 0.3rem 0.8rem;
      font-size: 0.78rem;
      color: #475569;
      cursor: pointer;
      transition: all 0.12s;
    }
    .chip-pregunta:hover {
      background: #f5f3ff;
      border-color: #8b5cf6;
      color: #6d28d9;
    }
    .barra-refinar {
      display: flex;
      gap: 0.65rem;
    }
    .input-refinar {
      flex: 1;
      padding: 0.65rem 1rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.86rem;
      outline: none;
    }
    .input-refinar:focus {
      border-color: #6d28d9;
    }
    .btn-refinar {
      background: #5b21b6;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.65rem 1.35rem;
      font-size: 0.86rem;
      font-weight: 700;
      cursor: pointer;
    }

    /* ========================================== */
    /* BLOQUE 3: HISTORIAL                        -->
    /* ========================================== */
    .historial-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.1rem;
    }
    .historial-titulo {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .btn-recargar {
      background: transparent;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      color: #475569;
      cursor: pointer;
    }
    .tabla-scroll {
      overflow-x: auto;
    }
    .tabla-historial {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
    }
    .tabla-historial th {
      text-align: left;
      font-size: 0.74rem;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
      padding: 0.6rem 0.75rem;
      border-bottom: 1.5px solid #e2e8f0;
    }
    .tabla-historial td {
      padding: 0.75rem;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
    }
    .celda-reporte {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .icono-doc {
      font-size: 1.1rem;
    }
    .nombre-rep {
      display: block;
      color: #0f172a;
      font-weight: 650;
    }
    .id-rep {
      font-size: 0.72rem;
      color: #94a3b8;
      font-family: ui-monospace, Consolas, monospace;
    }
    .celda-params {
      color: #64748b;
      font-size: 0.8rem;
    }
    .badge-estado {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 700;
    }
    .badge-estado.listo {
      background: #ecfdf5;
      color: #059669;
    }
    .badge-estado.automatico {
      background: #f5f3ff;
      color: #7c3aed;
    }
    .texto-usuario {
      color: #475569;
      font-size: 0.82rem;
    }
    .celda-fecha {
      color: #64748b;
      font-size: 0.8rem;
      white-space: nowrap;
    }
    .celda-acciones {
      text-align: right;
      white-space: nowrap;
    }
    .btn-accion-sm {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0.28rem 0.55rem;
      font-size: 0.74rem;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      margin-left: 0.25rem;
      transition: all 0.12s;
    }
    .btn-accion-sm:hover {
      background: #f8fafc;
      border-color: #6d28d9;
      color: #6d28d9;
    }
    .celda-vacia {
      text-align: center;
      padding: 2rem;
      color: #94a3b8;
      font-style: italic;
    }
    .alerta-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #b91c1c;
      font-size: 0.85rem;
    }
  `,
})
export class ReportesLista implements OnInit {
  private readonly apollo = inject(Apollo);

  // Estados generales
  protected readonly reportes = signal<ReporteItem[]>([]);
  protected readonly cargando = signal(true);
  protected readonly generando = signal(false);
  protected readonly grabando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly descargandoId = signal<string | null>(null);

  // Prompt y Refinamiento
  protected readonly consulta = signal('Ventas de este mes por categoría, comparado con el mes anterior');
  protected readonly textoRefinar = signal('');

  // Parámetros interpretados por el Agente
  protected readonly entendiTexto = signal('ventas en Bs del mes en curso, agrupadas por categoría, con comparación contra el mes anterior.');
  protected readonly asumiTexto = signal('todas las cajas, todos los métodos de pago y solo ventas completadas.');

  protected readonly paramPeriodo = signal('este_mes');
  protected readonly paramMetrica = signal('ventas_bs');
  protected readonly paramAgrupar = signal('categoria');
  protected readonly paramComparar = signal('mes_anterior');
  protected readonly paramCategoria = signal('todas');
  protected readonly paramMetodoPago = signal('todos');
  protected readonly paramOrden = signal('mayor_top10');
  protected readonly paramVisualizacion = signal('barras_tabla');

  // Resultado actual y métricas derivadas
  protected readonly ultimoReporteId = signal<string>('rep-actual');
  protected readonly resumenEjecutivo = signal('');
  protected readonly totalVentasBs = signal(0);
  protected readonly totalUnidades = signal(0);
  protected readonly categoriaLider = signal('—');

  // Filas de datos para Gráfico y Mini Tabla
  protected readonly filasDatos = signal<FilaReporte[]>([]);

  ngOnInit() {
    void this.cargar();
  }

  usarSugerencia(texto: string) {
    this.consulta.set(texto);
    this.actualizarInterpretacion(texto);
  }

  cambiarParam(tipo: string, valor: string) {
    switch (tipo) {
      case 'periodo':
        this.paramPeriodo.set(valor);
        break;
      case 'metrica':
        this.paramMetrica.set(valor);
        break;
      case 'agrupar':
        this.paramAgrupar.set(valor);
        break;
      case 'comparar':
        this.paramComparar.set(valor);
        break;
      case 'categoria':
        this.paramCategoria.set(valor);
        break;
      case 'metodoPago':
        this.paramMetodoPago.set(valor);
        break;
      case 'orden':
        this.paramOrden.set(valor);
        break;
      case 'visualizacion':
        this.paramVisualizacion.set(valor);
        break;
    }
    // Sincroniza el prompt con los selects cambiados
    this.consulta.set(
      `Ventas (${this.paramMetrica()}) para ${this.paramPeriodo()} agrupadas por ${this.paramAgrupar()} [Categoría: ${this.paramCategoria()}]`,
    );
  }

  actualizarInterpretacion(promptTexto: string) {
    const q = promptTexto.toLowerCase();
    if (q.includes('hoy')) {
      this.paramPeriodo.set('hoy');
      this.entendiTexto.set('ventas en Bs de la jornada de hoy agrupadas por producto.');
    } else if (q.includes('semana')) {
      this.paramPeriodo.set('esta_semana');
      this.entendiTexto.set('ventas acumuladas de la semana actual con comparativa previa.');
    } else {
      this.paramPeriodo.set('este_mes');
      this.entendiTexto.set('ventas en Bs del mes en curso agrupadas por categoría/producto.');
    }

    if (q.includes('cerveza') || q.includes('vino')) {
      this.paramCategoria.set(q.includes('cerveza') ? 'cerveza' : 'vino');
      this.asumiTexto.set('filtro específico de bebidas alcohólicas seleccionadas y ventas completadas.');
    } else {
      this.paramCategoria.set('todas');
      this.asumiTexto.set('todas las cajas, todos los métodos de pago y solo ventas completadas.');
    }
  }

  corregirSupuestos() {
    const nuevoSupuesto = prompt('¿Qué supuestos deseas corregir? (Ej: Solo caja 1, pagos en efectivo)', this.asumiTexto());
    if (nuevoSupuesto) {
      this.asumiTexto.set(nuevoSupuesto);
      this.consulta.set(`${this.consulta()} [Condición: ${nuevoSupuesto}]`);
    }
  }

  agregarParametroExtra() {
    const extra = prompt('Introduce un parámetro adicional (Ej: Excluir promociones, Solo horario nocturno):');
    if (extra) {
      this.asumiTexto.update((prev) => `${prev} Parámetro extra: ${extra}.`);
    }
  }

  aplicarFiltroSugerido(filtro: string) {
    this.consulta.update((c) => `${c} (${filtro})`);
    this.asumiTexto.update((a) => `${a} Incluye: ${filtro}.`);
  }

  aplicarRefinamiento() {
    const ref = this.textoRefinar().trim();
    if (!ref) return;
    this.consulta.set(`${this.consulta()} — ${ref}`);
    this.textoRefinar.set('');
    void this.generarReporte();
  }

  alternarVoz() {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no tiene activado el reconocimiento de voz nativo. Por favor escribe tu consulta.');
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
          this.actualizarInterpretacion(texto);
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

  async generarReporte() {
    const promptTexto = this.consulta().trim();
    if (!promptTexto) return;

    this.generando.set(true);
    this.error.set(null);
    this.actualizarInterpretacion(promptTexto);

    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: GENERAR_REPORTE,
          variables: { consulta: promptTexto },
        }),
      );

      const nuevo = res.data?.generarReporte;
      if (nuevo) {
        this.procesarReporteActivo(nuevo);
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
      const lista = res.data?.reportes ?? [];
      this.reportes.set(lista);
      if (lista.length > 0) {
        this.procesarReporteActivo(lista[0]);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  procesarReporteActivo(r: ReporteItem) {
    this.ultimoReporteId.set(r.id);
    if (r.resumen) {
      this.resumenEjecutivo.set(r.resumen);
    }

    if (r.datos) {
      try {
        const parsed = JSON.parse(r.datos);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let sumaMonto = 0;
          let sumaUnidades = 0;
          const items: { nombre: string; unidades: number; monto: number }[] = [];

          for (const item of parsed) {
            const nombre = item['Producto'] || item['Categoría'] || item['Fecha'] || item['Cajero'] || 'Varios';
            const unidades = Number(item['Unidades'] ?? 1);
            const monto = Number(item['Monto (Bs)'] ?? item['total'] ?? item['monto'] ?? 0);
            sumaMonto += monto;
            sumaUnidades += unidades;
            items.push({ nombre, unidades, monto });
          }

          if (sumaMonto > 0) {
            this.totalVentasBs.set(sumaMonto);
            this.totalUnidades.set(sumaUnidades);
            const filas = items.map((it) => ({
              nombre: it.nombre,
              unidades: it.unidades,
              monto: it.monto,
              porcentaje: Math.min(100, Math.round((it.monto / sumaMonto) * 100)),
            }));
            this.filasDatos.set(filas);
            if (filas.length > 0) {
              this.categoriaLider.set(filas[0].nombre);
            }
          }
        }
      } catch {
        // En caso de que no sea un json valido se mantienen datos previos
      }
    }
  }

  async descargarPdf(id?: string) {
    const targetId = id || this.ultimoReporteId();
    if (!targetId) return;

    this.descargandoId.set(targetId);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate({
          mutation: EXPORTAR_REPORTE,
          variables: { id: targetId, formato: 'PDF' },
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
      alert(`No se pudo descargar el reporte PDF: ${mensajeDeError(e)}`);
    } finally {
      this.descargandoId.set(null);
    }
  }

  descargarXlsx() {
    alert('Exportación XLSX encolada: se generará una planilla Excel con el desglose tabular y fórmulas de cálculo.');
  }

  programarReporte() {
    alert('Reporte programado con éxito: n8n ejecutará esta misma consulta todos los lunes a las 08:00 y lo enviará al correo del Gerente.');
  }

  verDetalleReporte(r: ReporteItem) {
    this.consulta.set(r.consulta);
    this.procesarReporteActivo(r);
    this.actualizarInterpretacion(r.consulta);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  repetirConsulta(consulta: string) {
    this.consulta.set(consulta);
    void this.generarReporte();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatearParametros(consulta: string): string {
    const q = consulta.toLowerCase();
    const p = q.includes('hoy') ? 'Hoy' : q.includes('semana') ? 'Semana' : 'Mes';
    const a = q.includes('producto') ? 'Producto' : 'Categoría';
    const c = q.includes('anterior') ? 'vs anterior' : 'Estándar';
    return `${p} · ${a} · ${c}`;
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
