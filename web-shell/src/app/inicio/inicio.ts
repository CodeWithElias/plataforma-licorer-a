import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sesion } from '../auth/sesion';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <section class="inicio">
      <p class="saludo-sub">Bienvenido</p>
      <h1>Hola, {{ sesion.usuario }}</h1>
      <p class="intro">¿Qué quieres hacer hoy?</p>

      <div class="modulos">
        @if (sesion.tieneRol('CAJERO', 'ADMIN')) {
          <a class="modulo" routerLink="/pos">
            <span class="icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
              </svg>
            </span>
            <span class="texto">
              <strong>Punto de venta</strong>
              <span>Catálogo, carrito y cobro</span>
            </span>
            <span class="flecha" aria-hidden="true">→</span>
          </a>
        }
        @if (sesion.tieneRol('GERENTE', 'ADMIN')) {
          <a class="modulo" routerLink="/gestion">
            <span class="icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
            </span>
            <span class="texto">
              <strong>Gestión</strong>
              <span>Proveedores y reportes</span>
            </span>
            <span class="flecha" aria-hidden="true">→</span>
          </a>
        }
      </div>

      @if (!sesion.tieneRol('CAJERO', 'GERENTE', 'ADMIN')) {
        <div class="aviso">Tu rol no tiene módulos en la web. El personal de almacén usa la app móvil.</div>
      }
    </section>
  `,
  styles: `
    .inicio { max-width: 960px; margin: 0 auto; padding: 3rem 1.75rem; }
    .saludo-sub { margin: 0; color: var(--lila-600); font-weight: 600; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.08em; }
    h1 { margin: 0.25rem 0 0.35rem; font-size: 2.1rem; letter-spacing: -0.03em; }
    .intro { margin: 0 0 2rem; color: var(--gris); }
    .modulos { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.1rem; }
    .modulo { display: flex; align-items: center; gap: 1rem; padding: 1.35rem 1.4rem; background: #fff; border: 1px solid var(--borde);
      border-radius: var(--radio); box-shadow: var(--sombra); text-decoration: none; color: inherit;
      transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s; }
    .modulo:hover { transform: translateY(-2px); border-color: var(--lila-300); box-shadow: 0 16px 32px -16px rgba(124, 58, 237, 0.4); }
    .icono { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 13px; background: var(--lila-100); color: var(--lila-700); }
    .icono svg { width: 24px; height: 24px; }
    .texto { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; }
    .texto strong { font-size: 1.05rem; }
    .texto span { color: var(--gris); font-size: 0.9rem; }
    .flecha { color: var(--lila-500); font-size: 1.3rem; transition: transform 0.15s; }
    .modulo:hover .flecha { transform: translateX(3px); }
    .aviso { margin-top: 1rem; padding: 1rem 1.2rem; border-radius: var(--radio); background: var(--lila-50); border: 1px solid var(--lila-200); color: var(--lila-700); }
  `,
})
export class Inicio {
  protected readonly sesion = inject(Sesion);
}
