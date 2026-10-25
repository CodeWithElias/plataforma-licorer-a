import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// El remoto corriendo solo (http://localhost/mfe-gestion/). Sin el Shell no hay sesión de Keycloak:
// las pantallas lo indican y piden abrir Gestión desde http://localhost/gestion.
@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App {}
