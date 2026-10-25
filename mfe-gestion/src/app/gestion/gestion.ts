import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Marco del módulo Gestión: pestañas y la pantalla elegida. Estilos compartidos por las pantallas del módulo. */
@Component({
  selector: 'app-gestion',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="gestion">
      <nav class="pestanas">
        <a routerLink="proveedores" routerLinkActive="activo">Proveedores</a>
        <span class="pronto" title="Semana 3 (CU07)">Reportes <small>Próximamente</small></span>
      </nav>
      <router-outlet />
    </section>
  `,
  styles: `
    :host {
      --lila-50: #f7f4ff; --lila-100: #efe9ff; --lila-200: #ddd2fe; --lila-300: #c4b0fb;
      --lila-500: #8b5cf6; --lila-600: #7c3aed; --lila-700: #6a2fd0;
      --tinta: #241a38; --gris: #6c6880; --gris-claro: #9a96ab; --borde: #ebe7f4; --fondo: #faf9fd;
      --verde: #12805c; --verde-fondo: #e9f8f1; --rojo: #c0264b; --rojo-fondo: #fdecf0;
      --radio: 14px; --sombra: 0 1px 2px rgba(36,26,56,.04), 0 8px 24px -12px rgba(76,29,149,.18);
      --degradado: linear-gradient(135deg, var(--lila-500), var(--lila-700));
      display: block; min-height: 100%; background: var(--fondo); color: var(--tinta);
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    }
    .gestion { max-width: 1200px; margin: 0 auto; padding: 1.75rem; }
    .pestanas { display: flex; gap: 1.5rem; margin-bottom: 1.75rem; border-bottom: 1px solid var(--borde); }
    .pestanas a, .pronto { padding: .75rem .1rem; margin-bottom: -1px; border-bottom: 2px solid transparent; text-decoration: none; font-weight: 600; font-size: .95rem; }
    .pestanas a { color: var(--gris); }
    .pestanas a:hover { color: var(--lila-700); }
    .pestanas a.activo { color: var(--lila-700); border-bottom-color: var(--lila-600); }
    .pronto { color: var(--gris-claro); cursor: default; }
    .pronto small { margin-left: .35rem; padding: .1rem .45rem; border-radius: 999px; background: var(--lila-50); color: var(--lila-600); font-size: .7rem; font-weight: 600; }

    /* ---- Componentes comunes de las pantallas ---- */
    :host ::ng-deep .encabezado { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    :host ::ng-deep .encabezado h1 { margin: 0; font-size: 1.6rem; letter-spacing: -.02em; }
    :host ::ng-deep .encabezado p { margin: .25rem 0 0; color: var(--gris); font-size: .92rem; }
    :host ::ng-deep .acciones-encabezado { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    :host ::ng-deep .boton { display: inline-flex; align-items: center; gap: .4rem; height: 42px; padding: 0 1.1rem; border: 0; border-radius: 11px;
      background: var(--degradado); color: #fff; font: inherit; font-weight: 600; font-size: .92rem; text-decoration: none; cursor: pointer;
      box-shadow: 0 10px 22px -10px rgba(124,58,237,.6); transition: transform .12s, box-shadow .12s, opacity .12s; }
    :host ::ng-deep .boton:hover:not([disabled]) { transform: translateY(-1px); }
    :host ::ng-deep .boton[disabled] { opacity: .5; cursor: default; box-shadow: none; }
    :host ::ng-deep .boton-secundario { display: inline-flex; align-items: center; height: 42px; padding: 0 1.1rem; border: 1px solid var(--borde); border-radius: 11px;
      background: #fff; color: var(--tinta); font: inherit; font-weight: 600; font-size: .92rem; text-decoration: none; cursor: pointer; }
    :host ::ng-deep .boton-secundario:hover { border-color: var(--lila-300); color: var(--lila-700); }
    :host ::ng-deep .segmentado { display: inline-flex; gap: .2rem; padding: .22rem; background: #fff; border: 1px solid var(--borde); border-radius: 11px; }
    :host ::ng-deep .segmentado button { height: 34px; padding: 0 .9rem; border: 0; border-radius: 8px; background: transparent; color: var(--gris);
      font: inherit; font-size: .88rem; font-weight: 600; cursor: pointer; }
    :host ::ng-deep .segmentado button.activo { background: var(--lila-100); color: var(--lila-700); }
    :host ::ng-deep .tarjeta { background: #fff; border: 1px solid var(--borde); border-radius: 16px; box-shadow: var(--sombra); }
    :host ::ng-deep .alerta { display: flex; flex-direction: column; gap: .2rem; padding: .85rem 1rem; border-radius: 12px; font-size: .9rem; }
    :host ::ng-deep .alerta.error { background: var(--rojo-fondo); color: var(--rojo); border: 1px solid #f6c5d1; }
    :host ::ng-deep .estado-vacio { display: flex; flex-direction: column; align-items: center; gap: .4rem; padding: 3rem 1rem; color: var(--gris); text-align: center; }
    :host ::ng-deep .estado-vacio strong { color: var(--tinta); }
  `,
})
export class Gestion {}
