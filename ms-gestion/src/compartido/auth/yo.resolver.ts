import { Query, Resolver } from '@nestjs/graphql';
import { UsuarioActual } from './decoradores.js';
import type { Usuario } from './usuario.js';

@Resolver('Usuario')
export class YoResolver {
  /** Usuario del token (sirve para probar el login y para el menú por rol). */
  @Query()
  yo(@UsuarioActual() usuario: Usuario): Usuario {
    return usuario;
  }
}
