import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { LISTAR, mensajeDeError, Proveedor } from './proveedores.graphql';

type Filtro = 'todos' | 'activos' | 'inactivos';

@Component({
  selector: 'app-proveedores-lista',
  imports: [RouterLink],
  template: `
    <header class="encabezado">
      <div>
        <h1>Proveedores</h1>
        <p>Empresas que abastecen a la licorería y los productos que entregan.</p>
      </div>
      <div class="acciones-encabezado">
        <div class="segmentado" role="tablist" aria-label="Filtro">
          @for (f of filtros; track f.valor) {
            <button type="button" [class.activo]="filtro() === f.valor" (click)="filtrar(f.valor)">{{ f.etiqueta }}</button>
          }
        </div>
        <a class="boton" routerLink="nuevo">
          <span aria-hidden="true">+</span> Nuevo proveedor
        </a>
      </div>
    </header>

    @if (error()) {
      <div class="alerta error"><strong>No se pudo cargar la lista</strong><span>{{ error() }}</span></div>
    } @else {
      <div class="tarjeta tabla-contenedor">
        @if (cargando()) {
          <div class="estado-vacio">Cargando proveedores…</div>
        } @else if (proveedores().length === 0) {
          <div class="estado-vacio">
            <strong>No hay proveedores {{ filtro() === 'todos' ? 'registrados' : filtro() }}</strong>
            <span>Registra el primero con «Nuevo proveedor».</span>
          </div>
        } @else {
          <table>
            <thead>
              <tr><th>Proveedor</th><th>NIT</th><th>Contacto</th><th>Productos</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              @for (p of proveedores(); track p.id) {
                <tr [class.inactivo]="!p.activo">
                  <td>
                    <div class="proveedor">
                      <span class="avatar" aria-hidden="true">{{ p.razonSocial.charAt(0).toUpperCase() }}</span>
                      <span class="razon">{{ p.razonSocial }}</span>
                    </div>
                  </td>
                  <td class="nit">{{ p.nit }}</td>
                  <td>
                    <div class="contacto">
                      <span>{{ p.contacto?.nombre || '—' }}</span>
                      @if (p.contacto?.email) { <small>{{ p.contacto?.email }}</small> }
                      @if (p.contacto?.telefono) { <small>{{ p.contacto?.telefono }}</small> }
                    </div>
                  </td>
                  <td>
                    <div class="chips">
                      @for (c of p.productos; track c) { <span class="chip">{{ c }}</span> }
                      @empty { <span class="sin-dato">—</span> }
                    </div>
                  </td>
                  <td><span class="estado" [class.activo]="p.activo">{{ p.activo ? 'Activo' : 'Inactivo' }}</span></td>
                  <td class="accion"><a [routerLink]="p.id">Editar</a></td>
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
    .tabla-contenedor { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: .92rem; }
    thead th { padding: .85rem 1.1rem; text-align: left; font-size: .75rem; font-weight: 650; text-transform: uppercase; letter-spacing: .05em;
      color: var(--gris-claro); background: var(--lila-50); border-bottom: 1px solid var(--borde); }
    tbody td { padding: .95rem 1.1rem; border-bottom: 1px solid var(--borde); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr { transition: background .12s; }
    tbody tr:hover { background: #fcfbff; }
    tr.inactivo .razon, tr.inactivo .nit { color: var(--gris-claro); }
    .proveedor { display: flex; align-items: center; gap: .7rem; }
    .avatar { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 11px; background: var(--lila-100); color: var(--lila-700); font-weight: 700; }
    tr.inactivo .avatar { background: #f2f1f5; color: var(--gris-claro); }
    .razon { font-weight: 600; }
    .nit { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .86rem; color: var(--gris); }
    .contacto { display: flex; flex-direction: column; gap: .1rem; }
    .contacto small { color: var(--gris-claro); font-size: .8rem; }
    .chips { display: flex; flex-wrap: wrap; gap: .3rem; }
    .chip { padding: .15rem .5rem; border-radius: 6px; background: var(--lila-50); border: 1px solid var(--lila-200); color: var(--lila-700);
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .75rem; }
    .sin-dato { color: var(--gris-claro); }
    .estado { display: inline-flex; align-items: center; gap: .35rem; padding: .22rem .6rem; border-radius: 999px; background: #f2f1f5; color: var(--gris); font-size: .78rem; font-weight: 600; }
    .estado::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .estado.activo { background: var(--verde-fondo); color: var(--verde); }
    .accion { text-align: right; }
    .accion a { padding: .4rem .8rem; border-radius: 9px; color: var(--lila-700); font-weight: 600; text-decoration: none; }
    .accion a:hover { background: var(--lila-100); }
    .pie { padding: .75rem 1.1rem; border-top: 1px solid var(--borde); color: var(--gris-claro); font-size: .82rem; }
  `,
})
export class ProveedoresLista implements OnInit {
  private readonly apollo = inject(Apollo);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly filtros: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: 'Todos' },
    { valor: 'activos', etiqueta: 'Activos' },
    { valor: 'inactivos', etiqueta: 'Inactivos' },
  ];
  protected readonly resumen = computed(() => {
    const n = this.proveedores().length;
    return `${n} ${n === 1 ? 'proveedor' : 'proveedores'}`;
  });

  ngOnInit() {
    void this.cargar();
  }

  filtrar(f: Filtro) {
    this.filtro.set(f);
    void this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    this.error.set(null);
    const activo = this.filtro() === 'todos' ? null : this.filtro() === 'activos';
    try {
      const r = await firstValueFrom(this.apollo.query({ query: LISTAR, variables: { activo }, fetchPolicy: 'network-only' }));
      this.proveedores.set(r.data?.proveedores ?? []);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
