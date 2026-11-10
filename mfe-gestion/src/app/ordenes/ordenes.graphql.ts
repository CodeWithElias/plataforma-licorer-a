import { gql } from 'apollo-angular';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

/** Operaciones de ms-gestion para las órdenes de compra (CU06, contrato: ms-gestion/schema.graphql). */

export type EstadoOrden = 'BORRADOR' | 'ENVIADA' | 'RECIBIDA' | 'ANULADA';

export interface LineaOrden {
  productoCodigo: string;
  cantidad: number;
  precioUnitario: number;
}

export interface OrdenCompra {
  id: string;
  numero: string;
  proveedorId: string;
  fecha: string;
  estado: EstadoOrden;
  origen: 'MANUAL' | 'AGENTE';
  lineas: LineaOrden[];
  total: number;
  fechaRecepcion: string | null;
  lineasRepuestas: number[];
}

const CAMPOS = `id numero proveedorId fecha estado origen total fechaRecepcion lineasRepuestas
  lineas { productoCodigo cantidad precioUnitario }`;

export const LISTAR_ORDENES = gql<{ ordenesCompra: OrdenCompra[] }, { estado?: EstadoOrden | null }>`
  query OrdenesCompra($estado: EstadoOrden) { ordenesCompra(estado: $estado) { ${CAMPOS} } }
`;

/** Nombres de los proveedores para mostrar en la lista (la orden solo trae su id). */
export const NOMBRES_PROVEEDORES = gql<{ proveedores: { id: string; razonSocial: string }[] }, Record<string, never>>`
  query NombresProveedores { proveedores { id razonSocial } }
`;

export const ENVIAR = gql<{ enviarOrdenCompra: OrdenCompra }, { id: string }>`
  mutation EnviarOrdenCompra($id: ID!) { enviarOrdenCompra(id: $id) { ${CAMPOS} } }
`;

export const ANULAR = gql<{ anularOrdenCompra: OrdenCompra }, { id: string }>`
  mutation AnularOrdenCompra($id: ID!) { anularOrdenCompra(id: $id) { ${CAMPOS} } }
`;

export const RECIBIR = gql<{ recibirOrdenCompra: OrdenCompra }, { id: string }>`
  mutation RecibirOrdenCompra($id: ID!) { recibirOrdenCompra(id: $id) { ${CAMPOS} } }
`;

const MENSAJES: Record<string, string> = {
  ORDEN_NO_ENCONTRADA: 'La orden ya no existe. Actualiza la lista.',
  UNAUTHENTICATED: 'La sesión no es válida. Vuelve a iniciar sesión desde el Shell.',
  FORBIDDEN: 'Tu usuario no tiene permiso para esta acción (registrar la recepción es solo del gerente).',
};

/**
 * Mensaje para el usuario a partir del error de Apollo. Los errores de negocio (TRANSICION_INVALIDA,
 * RECEPCION_INCOMPLETA, INVENTARIO_NO_DISPONIBLE…) ya vienen redactados por ms-gestion.
 */
export function mensajeDeError(e: unknown): string {
  if (CombinedGraphQLErrors.is(e)) {
    const error = e.errors[0];
    const codigo = String(error?.extensions?.['code'] ?? '');
    return MENSAJES[codigo] ?? error?.message ?? 'Error de GraphQL';
  }
  return 'No se pudo conectar con ms-gestion.';
}
