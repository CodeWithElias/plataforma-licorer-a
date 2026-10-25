import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Rol, Usuario } from './usuario.js';

export const ES_PUBLICO = 'esPublico';
export const ROLES = 'roles';

/** La ruta o el resolver no exige token. Todo lo demás lo exige por defecto. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

/** Exige alguno de estos roles de Keycloak. Ejemplo: @Roles('GERENTE') */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** Inyecta el usuario del token en un resolver o controller: `@UsuarioActual() usuario: Usuario`. */
export const UsuarioActual = createParamDecorator((_: unknown, contexto: ExecutionContext): Usuario => {
  const req = contexto.getType<string>() === 'graphql'
    ? GqlExecutionContext.create(contexto).getContext().req
    : contexto.switchToHttp().getRequest();
  return req.user;
});
