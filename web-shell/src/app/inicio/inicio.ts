import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink],
  template: `
    <section class="inicio">
      <h2>Plataforma Licorería</h2>
      <p>Elige un módulo:</p>
      <ul>
        <li><a routerLink="/pos">Punto de venta</a> (MFE POS · React)</li>
        <li><a routerLink="/gestion">Gestión</a> (MFE Gestión · Angular)</li>
      </ul>
    </section>
  `,
  styles: `
    .inicio { padding: 1.5rem; }
    h2 { margin: 0 0 0.5rem; }
  `,
})
export class Inicio {}
