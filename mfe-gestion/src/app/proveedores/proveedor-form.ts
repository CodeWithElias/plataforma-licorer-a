import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { CREAR, EDITAR, mensajeDeError, OBTENER, ProveedorInput } from './proveedores.graphql';

@Component({
  selector: 'app-proveedor-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <a class="volver" routerLink="..">← Proveedores</a>
    <header class="encabezado">
      <div>
        <h1>{{ id ? 'Editar proveedor' : 'Nuevo proveedor' }}</h1>
        <p>{{ id ? 'Actualiza los datos del proveedor.' : 'Registra una empresa que abastece a la licorería.' }}</p>
      </div>
    </header>

    @if (cargando()) {
      <div class="tarjeta estado-vacio">Cargando…</div>
    }

    <form class="tarjeta" [formGroup]="form" (ngSubmit)="guardar()" [style.display]="cargando() ? 'none' : null">
      <section class="seccion">
        <div class="seccion-titulo">
          <h2>Datos de la empresa</h2>
          <p>Identificación tributaria y nombre legal.</p>
        </div>
        <div class="campos dos">
          <label class="campo">
            <span>NIT <em>*</em></span>
            <input formControlName="nit" inputmode="numeric" placeholder="1023456789" />
            @if (form.controls.nit.touched && form.controls.nit.invalid) {
              <small class="error">El NIT debe tener entre 5 y 15 dígitos.</small>
            }
          </label>
          <label class="campo">
            <span>Razón social <em>*</em></span>
            <input formControlName="razonSocial" placeholder="Distribuidora Andina S.R.L." />
            @if (form.controls.razonSocial.touched && form.controls.razonSocial.invalid) {
              <small class="error">La razón social es obligatoria.</small>
            }
          </label>
        </div>
      </section>

      <section class="seccion" formGroupName="contacto">
        <div class="seccion-titulo">
          <h2>Contacto</h2>
          <p>Persona con quien se coordinan los pedidos.</p>
        </div>
        <div class="campos tres">
          <label class="campo"><span>Nombre</span><input formControlName="nombre" placeholder="Juan Pérez" /></label>
          <label class="campo"><span>Teléfono</span><input formControlName="telefono" placeholder="70000000" /></label>
          <label class="campo">
            <span>Email</span>
            <input formControlName="email" type="email" placeholder="ventas@empresa.bo" />
            @if (form.controls.contacto.controls.email.touched && form.controls.contacto.controls.email.invalid) {
              <small class="error">El email no es válido.</small>
            }
          </label>
        </div>
      </section>

      <section class="seccion">
        <div class="seccion-titulo">
          <h2>Productos y estado</h2>
          <p>Códigos del catálogo que entrega este proveedor.</p>
        </div>
        <div class="campos">
          <label class="campo">
            <span>Productos</span>
            <input formControlName="productos" placeholder="CER-001, CER-002, VIN-001" />
            <small class="ayuda">Separados por coma. Se guardan en mayúsculas y sin repetir.</small>
          </label>
          <label class="interruptor">
            <input type="checkbox" formControlName="activo" />
            <span class="pista" aria-hidden="true"></span>
            <span class="texto"><strong>Proveedor activo</strong><small>Los inactivos no se usan para nuevas órdenes de compra.</small></span>
          </label>
        </div>
      </section>

      @if (error()) {
        <div class="alerta error margen"><strong>No se pudo guardar</strong><span>{{ error() }}</span></div>
      }

      <footer class="pie-form">
        <a class="boton-secundario" routerLink="..">Cancelar</a>
        <button type="submit" class="boton" [disabled]="form.invalid || guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
      </footer>
    </form>
  `,
  styles: `
    .volver { display: inline-block; margin-bottom: .75rem; color: var(--gris); text-decoration: none; font-size: .9rem; font-weight: 550; }
    .volver:hover { color: var(--lila-700); }
    form { max-width: 880px; }
    .seccion { display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; padding: 1.5rem 1.6rem; border-bottom: 1px solid var(--borde); }
    @media (max-width: 760px) { .seccion { grid-template-columns: 1fr; gap: .75rem; } }
    .seccion-titulo h2 { margin: 0; font-size: 1rem; }
    .seccion-titulo p { margin: .3rem 0 0; color: var(--gris); font-size: .86rem; }
    .campos { display: grid; gap: 1rem; }
    .campos.dos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .campos.tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    @media (max-width: 760px) { .campos.dos, .campos.tres { grid-template-columns: 1fr; } }
    .campo { display: flex; flex-direction: column; gap: .35rem; min-width: 0; }
    .campo > span { font-size: .85rem; font-weight: 600; }
    .campo em { color: var(--lila-600); font-style: normal; }
    .campo input { width: 100%; min-width: 0; box-sizing: border-box; height: 42px; padding: 0 .8rem; border: 1px solid var(--borde); border-radius: 10px; background: #fcfbff; font: inherit; color: var(--tinta);
      transition: border-color .15s, box-shadow .15s; }
    .campo input:focus { outline: 0; border-color: var(--lila-300); box-shadow: 0 0 0 4px rgba(139,92,246,.12); background: #fff; }
    .campo input.ng-invalid.ng-touched { border-color: #f0a3b6; }
    .campo .error { color: var(--rojo); font-size: .8rem; }
    .campo .ayuda { color: var(--gris-claro); font-size: .8rem; }
    .interruptor { display: flex; align-items: flex-start; gap: .75rem; cursor: pointer; }
    .interruptor input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .pista { position: relative; flex: none; width: 42px; height: 24px; margin-top: .1rem; border-radius: 999px; background: #dcd9e6; transition: background .15s; }
    .pista::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .15s; }
    .interruptor input:checked + .pista { background: var(--lila-600); }
    .interruptor input:checked + .pista::after { transform: translateX(18px); }
    .interruptor input:focus-visible + .pista { box-shadow: 0 0 0 4px rgba(139,92,246,.2); }
    .texto { display: flex; flex-direction: column; gap: .15rem; }
    .texto small { color: var(--gris); font-size: .82rem; }
    .margen { margin: 1rem 1.6rem 0; }
    .pie-form { display: flex; justify-content: flex-end; gap: .75rem; padding: 1.1rem 1.6rem; background: var(--lila-50); border-radius: 0 0 16px 16px; }
  `,
})
export class ProveedorForm implements OnInit {
  private readonly apollo = inject(Apollo);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly id = this.ruta.snapshot.paramMap.get('id');
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  /** Al editar, el formulario se muestra recién cuando llegan los datos (así no se pisan cambios del usuario). */
  protected readonly cargando = signal(this.id !== null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nit: ['', [Validators.required, Validators.pattern(/^[\d\s.-]{5,20}$/)]],
    razonSocial: ['', Validators.required],
    contacto: inject(NonNullableFormBuilder).group({ nombre: [''], telefono: [''], email: ['', Validators.email] }),
    productos: [''],
    activo: [true],
  });

  async ngOnInit() {
    if (!this.id) return;
    try {
      const r = await firstValueFrom(this.apollo.query({ query: OBTENER, variables: { id: this.id }, fetchPolicy: 'network-only' }));
      const p = r.data!.proveedor;
      this.form.setValue({
        nit: p.nit,
        razonSocial: p.razonSocial,
        contacto: { nombre: p.contacto?.nombre ?? '', telefono: p.contacto?.telefono ?? '', email: p.contacto?.email ?? '' },
        productos: p.productos.join(', '),
        activo: p.activo,
      });
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const contacto = Object.fromEntries(Object.entries(v.contacto).filter(([, x]) => x.trim() !== ''));
    const input: ProveedorInput = {
      nit: v.nit,
      razonSocial: v.razonSocial,
      contacto: Object.keys(contacto).length ? contacto : null,
      productos: v.productos.split(',').map((x) => x.trim()).filter(Boolean),
      activo: v.activo,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      if (this.id) {
        await firstValueFrom(this.apollo.mutate({ mutation: EDITAR, variables: { id: this.id, input } }));
      } else {
        await firstValueFrom(this.apollo.mutate({ mutation: CREAR, variables: { input } }));
      }
      await this.router.navigate(['..'], { relativeTo: this.ruta });
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
