import { Component } from '@angular/core';
import { Gestion } from './gestion/gestion';

// El remoto corriendo solo (http://localhost/mfe-gestion/)
@Component({
  imports: [Gestion],
  selector: 'app-root',
  template: '<app-gestion />',
})
export class App {}
