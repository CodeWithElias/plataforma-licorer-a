import { GraphQLError } from 'graphql';
import { ErrorDeDominio } from '../dominio/error-de-dominio.js';

/**
 * Ejecuta un caso de uso y traduce los errores de dominio a errores GraphQL con su código
 * (`errors[].extensions.code`), por ejemplo INGRESO_NO_ENCONTRADO o NIT_DUPLICADO.
 */
export async function conErroresGraphql<T>(accion: () => Promise<T>): Promise<T> {
  try {
    return await accion();
  } catch (e) {
    if (e instanceof ErrorDeDominio) {
      throw new GraphQLError(e.message, { extensions: { code: e.codigo } });
    }
    throw e;
  }
}
