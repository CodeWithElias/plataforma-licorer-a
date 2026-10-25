import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { ES_PUBLICO, ROLES } from './decoradores.js';
import type { Usuario } from './usuario.js';

/**
 * Guard global: todo resolver o controller exige token salvo que tenga @Publico(),
 * y si tiene @Roles(...) el token debe traer alguno de esos roles.
 */
@Injectable()
export class JwtRolesGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  getRequest(contexto: ExecutionContext) {
    return contexto.getType<string>() === 'graphql'
      ? GqlExecutionContext.create(contexto).getContext().req
      : contexto.switchToHttp().getRequest();
  }

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, objetivos)) {
      return true;
    }

    await super.canActivate(contexto);   // 401 si falta el token o no es válido

    const requeridos = this.reflector.getAllAndOverride<string[]>(ROLES, objetivos) ?? [];
    const usuario: Usuario = this.getRequest(contexto).user;
    if (requeridos.length && !requeridos.some((r) => usuario.roles.includes(r))) {
      throw new ForbiddenException(`Se requiere el rol ${requeridos.join(' o ')}`);
    }
    return true;
  }
}
