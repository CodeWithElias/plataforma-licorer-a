import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation';
import { Inicio } from './inicio/inicio';

export const routes: Routes = [
  { path: '', component: Inicio },
  // Remoto Angular por Native Federation (ver public/federation.manifest.json)
  {
    path: 'gestion',
    loadComponent: () => loadRemoteModule('mfe-gestion', './Component').then((m) => m.Gestion),
  },
  // Remoto React como Web Component (<licoreria-pos>)
  { path: 'pos', loadComponent: () => import('./pos/pos-host').then((m) => m.PosHost) },
  { path: '**', redirectTo: '' },
];
