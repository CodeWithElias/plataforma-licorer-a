import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtRolesGuard } from './jwt-roles.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { YoResolver } from './yo.resolver.js';

/** Seguridad del servicio: token de Keycloak obligatorio en todo, salvo lo marcado con @Publico(). */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, YoResolver, { provide: APP_GUARD, useClass: JwtRolesGuard }],
})
export class AuthModule {}
