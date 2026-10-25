import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol, Sesion } from './sesion';

/** Deja entrar solo si el usuario tiene alguno de estos roles; si no, muestra "Acceso denegado". */
export function rolGuard(...roles: Rol[]): CanActivateFn {
  return () => inject(Sesion).tieneRol(...roles) || inject(Router).parseUrl('/acceso-denegado');
}
