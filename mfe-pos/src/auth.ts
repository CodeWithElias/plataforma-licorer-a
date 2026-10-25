import Keycloak from 'keycloak-js'

/**
 * Token para llamar a las APIs.
 * - Dentro del Shell: usa la sesión que el Shell comparte en window.licoreriaAuth (inicio de sesión único).
 * - Como PWA independiente (/mfe-pos/): inicia sesión con Keycloak por su cuenta (cliente web-shell, PKCE).
 */
let keycloak: Keycloak | null = null
let inicio: Promise<boolean> | null = null

function iniciarKeycloak(): Promise<boolean> {
  keycloak = new Keycloak({ url: `${window.location.origin}/auth`, realm: 'licoreria', clientId: 'web-shell' })
  return keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })
}

export async function obtenerToken(): Promise<string> {
  if (window.licoreriaAuth) return window.licoreriaAuth.token()
  inicio ??= iniciarKeycloak()
  await inicio
  await keycloak!.updateToken(30)
  return keycloak!.token ?? ''
}

export function usuarioActual(): string {
  if (window.licoreriaAuth) return window.licoreriaAuth.usuario()
  return (keycloak?.tokenParsed?.['preferred_username'] as string) ?? ''
}

declare global {
  interface Window {
    licoreriaAuth?: {
      token: () => Promise<string>
      usuario: () => string
      roles: () => string[]
      salir: () => void
    }
  }
}
