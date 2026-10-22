import { CUSTOM_ELEMENTS_SCHEMA, Component, OnInit, signal } from '@angular/core';

// URL del Web Component que publica mfe-pos (Nginx: /mfe-pos/)
const POS_ELEMENT_URL = '/mfe-pos/pos-element.js';

@Component({
  selector: 'app-pos-host',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (error()) {
      <p class="error">No se pudo cargar el punto de venta: {{ error() }}</p>
    } @else {
      <licoreria-pos></licoreria-pos>
    }
  `,
  styles: `.error { color: #b00020; padding: 1.5rem; }`,
})
export class PosHost implements OnInit {
  protected readonly error = signal<string | null>(null);

  async ngOnInit() {
    try {
      // URL en variable para que el bundler no intente empaquetar el remoto
      const url = POS_ELEMENT_URL;
      await import(/* @vite-ignore */ url);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }
}
