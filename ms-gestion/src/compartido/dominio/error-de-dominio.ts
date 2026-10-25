/**
 * Regla de negocio incumplida. El código es estable y es el que recibe el cliente
 * en `errors[].extensions.code` de GraphQL.
 */
export class ErrorDeDominio extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export class DatosInvalidos extends ErrorDeDominio {
  constructor(mensaje: string) {
    super('DATOS_INVALIDOS', mensaje);
  }
}
