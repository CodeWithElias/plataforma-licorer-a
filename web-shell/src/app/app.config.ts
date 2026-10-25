import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  AutoRefreshTokenService,
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  IncludeBearerTokenCondition,
  includeBearerTokenInterceptor,
  provideKeycloak,
  UserActivityService,
  withAutoRefreshToken,
} from 'keycloak-angular';
import { routes } from './app.routes';
import { Sesion } from './auth/sesion';

/** El token se agrega solo a las APIs de la plataforma (mismo dominio, detrás de Nginx). */
const haciaLasApis = createInterceptorCondition<IncludeBearerTokenCondition>({
  urlPattern: /^(\/api\/|\/graphql)/i,
  bearerPrefix: 'Bearer',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // CU01 – Inicio de sesión único: cliente público web-shell con PKCE (S256)
    provideKeycloak({
      config: { url: `${window.location.origin}/auth`, realm: 'licoreria', clientId: 'web-shell' },
      initOptions: { onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false },
      features: [withAutoRefreshToken({ onInactivityTimeout: 'logout', sessionTimeout: 60 * 60 * 1000 })],
      providers: [AutoRefreshTokenService, UserActivityService],
    }),
    { provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG, useValue: [haciaLasApis] },
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),
    provideRouter(routes),
    provideAppInitializer(() => inject(Sesion).compartir()),
  ],
};
