import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Apollo } from 'apollo-angular';
import type { TypedDocumentNode } from '@apollo/client/core';
import { firstValueFrom } from 'rxjs';
import {
  ANULAR, ENVIAR, type EstadoOrden, LISTAR_ORDENES, mensajeDeError, NOMBRES_PROVEEDORES, type OrdenCompra, RECIBIR,
} from './ordenes.graphql';

type Filtro = EstadoOrden | 'TODAS';
type Accion = 'enviar' | 'anular' | 'recibir';

const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  BORRADOR: 'Por revisar',
  ENVIADA: 'Enviada',
  RECIBIDA: 'Recibida',
  ANULADA: 'Anulada',
};

/**
 * CU06 – El gerente revisa las órdenes de compra (las del agente de reabastecimiento nacen en BORRADOR),
 * las envía al proveedor, las anula o registra que llegó la mercadería (eso suma el stock en ms-inventario).
 */
@Component({
  selector: 'app-ordenes-lista',
  template: `
    <header class="encabezado">
      <div>
        <h1>Órdenes de compra</h1>
        <p>Pedidos a proveedores. Las que crea el agente por stock bajo llegan como borrador para que las revises.</p>
      </div>
      <div class="acciones-encabezado">
        <div class="segmentado" role="tablist" aria-label="Estado">
          @for (f of filtros; track f.valor) {
            <button type="button" [class.activo]="filtro() === f.valor" (click)="filtrar(f.valor)">{{ f.etiqueta }}</button>
          }
        </div>
      </div>
    </header>

    @if (aviso()) {
      <div class="alerta exito" role="status">{{ aviso() }}</div>
    }
    @if (errorAccion()) {
      <div class="alerta error" role="alert"><strong>No se pudo completar la acción</strong><span>{{ errorAccion() }}</span></div>
    }

    @if (error()) {
      <div class="alerta error"><strong>No se pudo cargar la lista</strong><span>{{ error() }}</span></div>
    } @else {
      <div class="tarjeta tabla-contenedor">
        @if (cargando()) {
          <div class="estado-vacio">Cargando órdenes…</div>
        } @else if (ordenes().length === 0) {
          <div class="estado-vacio">
            <strong>No hay órdenes {{ filtro() === 'TODAS' ? 'de compra' : etiqueta(filtro()).toLowerCase() }}</strong>
            <span>Cuando un producto baja de su stock mínimo, el agente crea aquí una orden en borrador.</span>
          </div>
        } @else {
          <table>
            <thead>
              <tr><th>Orden</th><th>Proveedor</th><th>Fecha</th><th class="num">Total</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              @for (o of ordenes(); track o.id) {
                <tr class="fila" [class.abierta]="abierta() === o.id" (click)="alternar(o.id)">
                  <td>
                    <div class="orden">
                      <span class="numero">{{ o.numero }}</span>
                      @if (o.origen === 'AGENTE') { <span class="origen" title="Creada por el agente de reabastecimiento">Agente IA</span> }
                    </div>
                  </td>
                  <td>{{ proveedor(o.proveedorId) }}</td>
                  <td class="fecha">{{ fecha(o.fecha) }}</td>
                  <td class="num">{{ bs(o.total) }}</td>
                  <td><span class="estado" [attr.data-estado]="o.estado">{{ etiqueta(o.estado) }}</span></td>
                  <td class="accion">
                    <button type="button" class="ver" [attr.aria-expanded]="abierta() === o.id">{{ abierta() === o.id ? 'Ocultar' : 'Ver' }}</button>
                  </td>
                </tr>
                @if (abierta() === o.id) {
                  <tr class="detalle">
                    <td colspan="6">
                      <div class="panel">
                        <table class="lineas">
                          <thead>
                            <tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Precio unit.</th><th class="num">Subtotal</th>
                              @if (o.lineasRepuestas.length && o.estado === 'ENVIADA') { <th>Stock</th> }</tr>
                          </thead>
                          <tbody>
                            @for (l of o.lineas; track $index) {
                              <tr>
                                <td class="codigo">{{ l.productoCodigo }}</td>
                                <td class="num">{{ l.cantidad }}</td>
                                <td class="num">{{ bs(l.precioUnitario) }}</td>
                                <td class="num">{{ bs(l.cantidad * l.precioUnitario) }}</td>
                                @if (o.lineasRepuestas.length && o.estado === 'ENVIADA') {
                                  <td>{{ o.lineasRepuestas.includes($index) ? 'Sumado' : 'Pendiente' }}</td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>

                        <div class="pie-detalle">
                          <p class="ayuda">{{ ayuda(o) }}</p>
                          <div class="botones">
                            @if (o.estado === 'BORRADOR' || o.estado === 'ENVIADA') {
                              <button type="button" class="boton-secundario peligro" [disabled]="trabajando()" (click)="ejecutar('anular', o)">Anular</button>
                            }
                            @if (o.estado === 'BORRADOR') {
                              <button type="button" class="boton" [disabled]="trabajando()" (click)="ejecutar('enviar', o)">
                                {{ trabajando() ? 'Enviando…' : 'Enviar al proveedor' }}
                              </button>
                            }
                            @if (o.estado === 'ENVIADA') {
                              <button type="button" class="boton" [disabled]="trabajando()" (click)="ejecutar('recibir', o)">
                                {{ trabajando() ? 'Registrando…' : 'Registrar recepción' }}
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          <footer class="pie">{{ resumen() }}</footer>
        }
      </div>
    }
  `,
  styles: `
    .alerta { margin-bottom: 1rem; }
    .alerta.exito { background: var(--verde-fondo); color: var(--verde); border: 1px solid #bfe8d6; }
    .tabla-contenedor { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    thead th { padding: .85rem 1.1rem; text-align: left; font-size: .75rem; font-weight: 650; text-transform: uppercase; letter-spacing: .05em;
      color: var(--gris-claro); background: var(--lila-50); border-bottom: 1px solid var(--borde); }
    tbody td { padding: .95rem 1.1rem; border-bottom: 1px solid var(--borde); vertical-align: middle; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.fila { cursor: pointer; transition: background .12s; }
    tr.fila:hover, tr.fila.abierta { background: #fcfbff; }
    tr.fila.abierta td { border-bottom-color: transparent; }
    .orden { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .numero { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-weight: 600; font-size: .88rem; }
    .origen { padding: .12rem .5rem; border-radius: 999px; background: var(--lila-100); color: var(--lila-700); font-size: .72rem; font-weight: 650; }
    .fecha { color: var(--gris); white-space: nowrap; }
    .estado { display: inline-flex; align-items: center; gap: .35rem; padding: .22rem .6rem; border-radius: 999px; font-size: .78rem; font-weight: 600;
      background: #f2f1f5; color: var(--gris); white-space: nowrap; }
    .estado::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .estado[data-estado="BORRADOR"] { background: #fff4e0; color: #9a5b00; }
    .estado[data-estado="ENVIADA"] { background: var(--lila-100); color: var(--lila-700); }
    .estado[data-estado="RECIBIDA"] { background: var(--verde-fondo); color: var(--verde); }
    .estado[data-estado="ANULADA"] { text-decoration: line-through; }
    .accion { text-align: right; }
    .ver { padding: .4rem .8rem; border: 0; border-radius: 9px; background: transparent; color: var(--lila-700); font: inherit; font-weight: 600; cursor: pointer; }
    .ver:hover { background: var(--lila-100); }
    tr.detalle > td { padding: 0 1.1rem 1.1rem; background: #fcfbff; }
    .panel { border: 1px solid var(--borde); border-radius: 12px; background: #fff; overflow: hidden; }
    .lineas thead th { background: #fff; }
    .lineas tbody td { padding: .6rem 1.1rem; }
    .codigo { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .86rem; }
    .pie-detalle { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: .9rem 1.1rem; border-top: 1px solid var(--borde); }
    .ayuda { margin: 0; color: var(--gris); font-size: .86rem; max-width: 520px; }
    .botones { display: flex; gap: .6rem; flex-wrap: wrap; }
    .peligro { color: var(--rojo); }
    .peligro:hover:not([disabled]) { border-color: #f6c5d1; color: var(--rojo); }
    .pie { padding: .75rem 1.1rem; border-top: 1px solid var(--borde); color: var(--gris-claro); font-size: .82rem; }
  `,
})
export class OrdenesLista implements OnInit {
  private readonly apollo = inject(Apollo);
  protected readonly ordenes = signal<OrdenCompra[]>([]);
  private readonly nombres = signal<Record<string, string>>({});
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly abierta = signal<string | null>(null);
  protected readonly filtro = signal<Filtro>('TODAS');
  protected readonly filtros: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'TODAS', etiqueta: 'Todas' },
    { valor: 'BORRADOR', etiqueta: 'Por revisar' },
    { valor: 'ENVIADA', etiqueta: 'Enviadas' },
    { valor: 'RECIBIDA', etiqueta: 'Recibidas' },
    { valor: 'ANULADA', etiqueta: 'Anuladas' },
  ];
  protected readonly resumen = computed(() => {
    const n = this.ordenes().length;
    const total = this.ordenes().filter((o) => o.estado !== 'ANULADA').reduce((s, o) => s + o.total, 0);
    return `${n} ${n === 1 ? 'orden' : 'órdenes'} · ${this.bs(total)} sin contar anuladas`;
  });

  private readonly moneda = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  private readonly formatoFecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' });

  ngOnInit() {
    void this.cargarProveedores();
    void this.cargar();
  }

  filtrar(f: Filtro) {
    this.filtro.set(f);
    this.abierta.set(null);
    void this.cargar();
  }

  alternar(id: string) {
    this.abierta.set(this.abierta() === id ? null : id);
    this.errorAccion.set(null);
  }

  protected etiqueta(e: Filtro) {
    return e === 'TODAS' ? 'Todas' : ETIQUETA_ESTADO[e];
  }

  protected proveedor(id: string) {
    return this.nombres()[id] ?? 'Proveedor desconocido';
  }

  protected bs(n: number) {
    return `Bs ${this.moneda.format(n)}`;
  }

  protected fecha(iso: string) {
    return this.formatoFecha.format(new Date(iso));
  }

  protected ayuda(o: OrdenCompra) {
    switch (o.estado) {
      case 'BORRADOR':
        return 'Revisa cantidades y precios. Al enviarla queda como pedido hecho al proveedor; el stock no cambia todavía.';
      case 'ENVIADA':
        return o.lineasRepuestas.length
          ? 'La recepción quedó a medias: al registrarla de nuevo solo se suman los productos pendientes.'
          : 'Cuando llegue la mercadería, registra la recepción: se sumará al inventario.';
      case 'RECIBIDA':
        return o.fechaRecepcion ? `Recibida el ${this.fecha(o.fechaRecepcion)}. Su mercadería ya está en el inventario.` : 'Recibida.';
      case 'ANULADA':
        return 'Orden anulada: no se compró ni se movió el stock.';
    }
  }

  async ejecutar(accion: Accion, o: OrdenCompra) {
    const unidades = o.lineas.reduce((s, l) => s + l.cantidad, 0);
    const preguntas: Record<Accion, string> = {
      enviar: `¿Enviar la orden ${o.numero} a ${this.proveedor(o.proveedorId)} por ${this.bs(o.total)}?`,
      anular: `¿Anular la orden ${o.numero}? No se podrá deshacer.`,
      recibir: `¿Registrar que llegó la mercadería de ${o.numero}? Se sumarán ${unidades} unidades al inventario.`,
    };
    if (!confirm(preguntas[accion])) return;

    const mutaciones: Record<Accion, TypedDocumentNode<unknown, { id: string }>> = { enviar: ENVIAR, anular: ANULAR, recibir: RECIBIR };
    const hechos: Record<Accion, string> = {
      enviar: `Orden ${o.numero} enviada al proveedor.`,
      anular: `Orden ${o.numero} anulada.`,
      recibir: `Recepción registrada: se sumaron ${unidades} unidades al inventario.`,
    };

    this.trabajando.set(true);
    this.errorAccion.set(null);
    this.aviso.set(null);
    try {
      await firstValueFrom(this.apollo.mutate({ mutation: mutaciones[accion], variables: { id: o.id } }));
      this.aviso.set(hechos[accion]);
    } catch (e) {
      this.errorAccion.set(mensajeDeError(e));
    } finally {
      this.trabajando.set(false);
      await this.cargar();   // también tras un error: la recepción pudo quedar a medias
    }
  }

  private async cargarProveedores() {
    try {
      const r = await firstValueFrom(this.apollo.query({ query: NOMBRES_PROVEEDORES, fetchPolicy: 'network-only' }));
      this.nombres.set(Object.fromEntries((r.data?.proveedores ?? []).map((p) => [p.id, p.razonSocial])));
    } catch {
      // sin nombres se muestra "Proveedor desconocido"; la lista de órdenes sigue funcionando
    }
  }

  private async cargar() {
    this.cargando.set(this.ordenes().length === 0);
    this.error.set(null);
    const estado = this.filtro() === 'TODAS' ? null : (this.filtro() as EstadoOrden);
    try {
      const r = await firstValueFrom(this.apollo.query({ query: LISTAR_ORDENES, variables: { estado }, fetchPolicy: 'network-only' }));
      this.ordenes.set(r.data?.ordenesCompra ?? []);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
