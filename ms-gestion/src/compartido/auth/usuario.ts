/** Usuario autenticado, armado con los claims del token de Keycloak. */
export interface Usuario {
  /** `sub` del token: id del usuario en Keycloak */
  id: string;
  /** `preferred_username` */
  usuario: string;
  /** `realm_access.roles`: ADMIN, GERENTE, CAJERO, ALMACEN (y los roles por defecto) */
  roles: string[];
}

export type Rol = 'ADMIN' | 'GERENTE' | 'CAJERO' | 'ALMACEN';
