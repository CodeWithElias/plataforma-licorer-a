import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Usuario } from './usuario.js';

interface ClaimsKeycloak {
  sub: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Valida el token de Keycloak: firma con las claves del JWKS (en caché), vencimiento y emisor.
 * Claves por la red interna (KEYCLOAK_JWKS) y emisor público (KEYCLOAK_ISSUER), igual que los demás servicios.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: process.env.KEYCLOAK_ISSUER ?? 'http://localhost/auth/realms/licoreria',
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: process.env.KEYCLOAK_JWKS ?? 'http://localhost/auth/realms/licoreria/protocol/openid-connect/certs',
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
    });
  }

  validate(claims: ClaimsKeycloak): Usuario {
    return {
      id: claims.sub,
      usuario: claims.preferred_username ?? claims.sub,
      roles: claims.realm_access?.roles ?? [],
    };
  }
}
