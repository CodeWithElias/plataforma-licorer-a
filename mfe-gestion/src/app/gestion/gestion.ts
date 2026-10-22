import { Component } from '@angular/core';

// Componente que expone el remoto (federation.config.mjs → './Component').
// Aquí van proveedores (CU05) y reportes (CU07).
@Component({
  selector: 'app-gestion',
  template: `
    <section class="gestion">
      <h2>Gestión</h2>
      <p>MFE Gestión (Angular) cargado correctamente.</p>
    </section>
  `,
  styles: `
    .gestion { font-family: system-ui, sans-serif; padding: 1.5rem; }
    h2 { margin: 0; }
    p { color: #555; }
  `,
})
export class Gestion {}
