import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { InMemoryCache } from '@apollo/client/core';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { Gestion } from './gestion/gestion';
import { ProveedorForm } from './proveedores/proveedor-form';
import { ProveedoresLista } from './proveedores/proveedores-lista';

/**
 * Rutas que expone el remoto (federation.config.mjs → './routes'). El Shell las monta en /gestion.
 * Apollo usa el HttpClient del Shell, cuyo interceptor agrega el token de Keycloak a /graphql.
 */
export const rutas: Routes = [
  {
    path: '',
    component: Gestion,
    providers: [
      provideApollo(() => ({
        link: inject(HttpLink).create({ uri: '/graphql' }),
        cache: new InMemoryCache(),
      })),
    ],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'proveedores' },
      { path: 'proveedores', component: ProveedoresLista },
      { path: 'proveedores/nuevo', component: ProveedorForm },
      { path: 'proveedores/:id', component: ProveedorForm },
    ],
  },
];
