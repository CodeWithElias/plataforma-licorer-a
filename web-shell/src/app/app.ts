import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Sesion } from './auth/sesion';

const NOMBRES_ROL: Record<string, string> = { ADMIN: 'Administrador', GERENTE: 'Gerente', CAJERO: 'Cajero', ALMACEN: 'Almacén' };

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly sesion = inject(Sesion);

  protected get inicial(): string {
    return (this.sesion.usuario || '?').charAt(0).toUpperCase();
  }

  protected get rolPrincipal(): string {
    const rol = ['ADMIN', 'GERENTE', 'CAJERO', 'ALMACEN'].find((r) => this.sesion.roles.includes(r));
    return rol ? NOMBRES_ROL[rol] : 'Sin rol';
  }
}
