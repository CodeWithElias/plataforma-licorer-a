import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Gestion } from './gestion/gestion';
import { mensajeDeError } from './proveedores/proveedores.graphql';

describe('Gestión', () => {
  it('muestra las pestañas con Proveedores', async () => {
    await TestBed.configureTestingModule({ imports: [Gestion], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Gestion);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.pestanas')?.textContent).toContain('Proveedores');
  });

  it('traduce los códigos de error de ms-gestion', () => {
    const error = new CombinedGraphQLErrors({ errors: [{ message: 'x', extensions: { code: 'NIT_DUPLICADO' } }] });
    expect(mensajeDeError(error)).toBe('Ya existe un proveedor con ese NIT.');
    expect(mensajeDeError(new Error('red'))).toContain('No se pudo conectar');
  });
});
