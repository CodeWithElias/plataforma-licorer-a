import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { rutas } from './rutas';

/** Configuración del remoto cuando corre solo (dentro del Shell se usan los proveedores del Shell). */
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideHttpClient(), provideRouter(rutas)],
};
