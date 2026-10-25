import { gql } from 'apollo-angular';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

/** Operaciones de ms-gestion para CU05 (contrato: ms-gestion/schema.graphql). */

export interface Contacto {
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export interface Proveedor {
  id: string;
  nit: string;
  razonSocial: string;
  contacto: Contacto | null;
  productos: string[];
  activo: boolean;
}

export interface ProveedorInput {
  nit: string;
  razonSocial: string;
  contacto?: Contacto | null;
  productos?: string[];
  activo?: boolean;
}

const CAMPOS = `id nit razonSocial productos activo contacto { nombre telefono email }`;

export const LISTAR = gql<{ proveedores: Proveedor[] }, { activo?: boolean | null }>`
  query Proveedores($activo: Boolean) { proveedores(activo: $activo) { ${CAMPOS} } }
`;

export const OBTENER = gql<{ proveedor: Proveedor }, { id: string }>`
  query Proveedor($id: ID!) { proveedor(id: $id) { ${CAMPOS} } }
`;

export const CREAR = gql<{ crearProveedor: Proveedor }, { input: ProveedorInput }>`
  mutation CrearProveedor($input: ProveedorInput!) { crearProveedor(input: $input) { ${CAMPOS} } }
`;

export const EDITAR = gql<{ editarProveedor: Proveedor }, { id: string; input: ProveedorInput }>`
  mutation EditarProveedor($id: ID!, $input: ProveedorInput!) { editarProveedor(id: $id, input: $input) { ${CAMPOS} } }
`;

const MENSAJES: Record<string, string> = {
  NIT_DUPLICADO: 'Ya existe un proveedor con ese NIT.',
  PROVEEDOR_NO_ENCONTRADO: 'El proveedor no existe.',
  UNAUTHENTICATED: 'La sesión no es válida. Abre Gestión desde el Shell (http://localhost/gestion) para iniciar sesión.',
  FORBIDDEN: 'Tu usuario no tiene permiso para gestionar proveedores.',
};

/** Mensaje para el usuario a partir del error de Apollo (usa errors[].extensions.code). */
export function mensajeDeError(e: unknown): string {
  if (CombinedGraphQLErrors.is(e)) {
    const error = e.errors[0];
    const codigo = String(error?.extensions?.['code'] ?? '');
    return MENSAJES[codigo] ?? error?.message ?? 'Error de GraphQL';
  }
  return 'No se pudo conectar con ms-gestion.';
}
