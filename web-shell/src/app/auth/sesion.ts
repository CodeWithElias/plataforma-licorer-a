import { Injectable, inject } from '@angular/core';
import Keycloak from 'keycloak-js';

export type Rol = 'ADMIN' | 'GERENTE' | 'CAJERO' | 'ALMACEN';

/**
 * Sesión del usuario (inicio de sesión único con Keycloak, CU01).
 * El Shell la comparte con los micro frontends:
 *  - mfe-gestion (Angular) usa el HttpClient del Shell: el interceptor agrega el token solo.
 *  - mfe-pos (React, Web Component) llama a window.licoreriaAuth.token().
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly keycloak = inject(Keycloak);

  get usuario(): string {
    return (this.keycloak.tokenParsed?.['preferred_username'] as string) ?? '';
  }

  get roles(): string[] {
    return this.keycloak.realmAccess?.roles ?? [];
  }

  tieneRol(...roles: Rol[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }

  /** Token vigente (lo renueva si le quedan menos de 30 s). */
  async token(): Promise<string> {
    await this.keycloak.updateToken(30);
    return this.keycloak.token ?? '';
  }

  salir(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin + '/' });
  }

  /** Publica la sesión para los micro frontends que no son Angular. */
  compartir(): void {
    window.licoreriaAuth = {
      token: () => this.token(),
      usuario: () => this.usuario,
      roles: () => this.roles,
      salir: () => this.salir(),
    };
  }
}

declare global {
  interface Window {
    licoreriaAuth?: {
      token: () => Promise<string>;
      usuario: () => string;
      roles: () => string[];
      salir: () => void;
    };
  }
}
