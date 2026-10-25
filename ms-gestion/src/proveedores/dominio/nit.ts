import { DatosInvalidos } from '../../compartido/dominio/error-de-dominio.js';

/** Value object: NIT boliviano (solo dígitos, de 5 a 15). Dos NIT son iguales si tienen el mismo valor. */
export class Nit {
  private constructor(readonly valor: string) {}

  static de(valor: string): Nit {
    const limpio = (valor ?? '').replace(/[\s.-]/g, '');
    if (!/^\d{5,15}$/.test(limpio)) {
      throw new DatosInvalidos('El NIT debe tener entre 5 y 15 dígitos');
    }
    return new Nit(limpio);
  }

  igualA(otro: Nit): boolean {
    return this.valor === otro.valor;
  }
}
