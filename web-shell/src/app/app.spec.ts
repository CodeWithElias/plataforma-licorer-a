import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { Rol, Sesion } from './auth/sesion';

function sesionCon(...roles: Rol[]): Partial<Sesion> {
  return {
    usuario: 'prueba',
    roles,
    tieneRol: (...r: Rol[]) => r.some((x) => roles.includes(x)),
    salir: () => undefined,
  };
}

async function crear(...roles: Rol[]) {
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter([]), { provide: Sesion, useValue: sesionCon(...roles) }],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('App (menú por rol)', () => {
  it('el cajero ve el Punto de venta y no Gestión', async () => {
    const nav = (await crear('CAJERO')).querySelector('nav')!.textContent!;
    expect(nav).toContain('Punto de venta');
    expect(nav).not.toContain('Gestión');
  });

  it('el gerente ve Gestión y no el Punto de venta', async () => {
    const nav = (await crear('GERENTE')).querySelector('nav')!.textContent!;
    expect(nav).toContain('Gestión');
    expect(nav).not.toContain('Punto de venta');
  });

  it('muestra el usuario y el botón Salir', async () => {
    const usuario = (await crear('ADMIN')).querySelector('.usuario')!.textContent!;
    expect(usuario).toContain('prueba');
    expect(usuario).toContain('Salir');
  });
});
