import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Sesion } from '../auth/sesion';

@Component({
  selector: 'app-acceso-denegado',
  imports: [RouterLink],
  template: `
    <section class="denegado">
      <span class="icono" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <h2>Acceso denegado</h2>
      <p>Tu usuario <strong>{{ sesion.usuario }}</strong> no tiene permiso para abrir esta sección.</p>
      <a routerLink="/">Volver al inicio</a>
    </section>
  `,
  styles: `
    .denegado { max-width: 440px; margin: 4rem auto; padding: 2.5rem 2rem; text-align: center; background: #fff;
      border: 1px solid var(--borde); border-radius: var(--radio); box-shadow: var(--sombra); }
    .icono { display: inline-grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: var(--rojo-fondo); color: var(--rojo); }
    .icono svg { width: 28px; height: 28px; }
    h2 { margin: 1rem 0 0.5rem; font-size: 1.4rem; }
    p { margin: 0 0 1.5rem; color: var(--gris); }
    a { display: inline-block; padding: 0.6rem 1.2rem; border-radius: 10px; background: var(--degradado); color: #fff; text-decoration: none; font-weight: 600; }
  `,
})
export class AccesoDenegado {
  protected readonly sesion = inject(Sesion);
}
