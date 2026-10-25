import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { AccesoDenegado } from './acceso-denegado/acceso-denegado';
import { rolGuard } from './auth/rol.guard';
import { Inicio } from './inicio/inicio';

export const routes: Routes = [
  { path: '', component: Inicio },
  // Remoto React como Web Component (<licoreria-pos>)
  {
    path: 'pos',
    canActivate: [rolGuard('CAJERO', 'ADMIN')],
    loadComponent: () => import('./pos/pos-host').then((m) => m.PosHost),
  },
  // Remoto Angular por Native Federation (ver public/federation.manifest.json)
  {
    path: 'gestion',
    canActivate: [rolGuard('GERENTE', 'ADMIN')],
    loadChildren: () => loadRemoteModule('mfe-gestion', './routes').then((m) => m.rutas),
  },
  { path: 'acceso-denegado', component: AccesoDenegado },
  { path: '**', redirectTo: '' },
];
