import type { LayersModel, Tensor } from '@tensorflow/tfjs'
import type { Producto } from './api'
import { obtenerToken } from './auth'

/**
 * Clasificador en el navegador con TensorFlow.js (CU04 / R06). Descarga el modelo vigente de ms-ia
 * (GET /api/ia/modelos/latest), lo guarda en IndexedDB y clasifica sin servidor, también sin conexión.
 * TensorFlow.js se carga recién al abrir el escáner para no agrandar la carga inicial del POS.
 */

const API_IA = (import.meta as { env?: Record<string, string> }).env?.VITE_API_IA ?? '/api/ia'
const CLAVE_INFO = 'licoreria-pos-modelo-tfjs'
const TAMANO_ENTRADA = 224

export interface PrediccionLocal {
  etiqueta: string
  confianza: number
  productoCodigo: string | null
  nombre: string | null
  modelo: string
}

export interface InfoModelo {
  version: string
  etiquetas: string[]
}

interface ModeloCargado {
  modelo: LayersModel
  info: InfoModelo
}

/** Las 5 clases del dataset (ms-ia/dataset/README.md) en el catálogo de ms-inventario. */
export const MAPA_ETIQUETA_A_CODIGO: Record<string, { codigo: string; nombre: string }> = {
  pacena_620: { codigo: 'CER-001', nombre: 'Cerveza Paceña 620 ml' },
  huari_620: { codigo: 'CER-003', nombre: 'Cerveza Huari 620 ml' },
  casareal_negra: { codigo: 'SIN-001', nombre: 'Singani Casa Real Etiqueta Negra 750 ml' },
  jw_red: { codigo: 'WHI-001', nombre: 'Whisky Johnnie Walker Red Label 750 ml' },
  absolut_750: { codigo: 'VOD-001', nombre: 'Vodka Absolut 750 ml' },
}

let cargado: Promise<ModeloCargado> | null = null

function infoGuardada(): InfoModelo | null {
  try {
    const texto = localStorage.getItem(CLAVE_INFO)
    return texto ? (JSON.parse(texto) as InfoModelo) : null
  } catch {
    return null
  }
}

/** La versión vigente en ms-ia, o null si no hay conexión. */
async function infoDelServidor(): Promise<InfoModelo | null> {
  try {
    const r = await fetch(`${API_IA}/modelos/latest`, { headers: { Authorization: `Bearer ${await obtenerToken()}` } })
    if (!r.ok) return null
    const info = await r.json()
    return info.tfjs ? { version: info.version, etiquetas: info.etiquetas } : null
  } catch {
    return null
  }
}

async function cargar(): Promise<ModeloCargado> {
  const tf = await import('@tensorflow/tfjs')
  const guardada = infoGuardada()
  const vigente = await infoDelServidor()
  const rutaLocal = (version: string) => `indexeddb://licoreria-modelo-${version}`

  if (guardada && (!vigente || vigente.version === guardada.version)) {
    try {
      return { modelo: await tf.loadLayersModel(rutaLocal(guardada.version)), info: guardada }
    } catch {
      // No está o se borró: se descarga si hay conexión
    }
  }
  if (!vigente) {
    throw new Error('El modelo no está disponible: abre el escáner una vez con conexión para descargarlo.')
  }

  const url = `${API_IA}/modelos/${vigente.version}/tfjs/model.json`
  const modelo = await tf.loadLayersModel(url, {
    requestInit: { headers: { Authorization: `Bearer ${await obtenerToken()}` } },
  })
  await modelo.save(rutaLocal(vigente.version))
  try {
    localStorage.setItem(CLAVE_INFO, JSON.stringify(vigente))
  } catch {
    // Sin localStorage seguirá funcionando, pero volverá a descargarlo
  }
  return { modelo, info: vigente }
}

/** Deja el modelo listo. Si falla se puede reintentar. @returns su versión */
export async function prepararModelo(): Promise<string> {
  cargado ??= cargar().catch((e) => {
    cargado = null
    throw e
  })
  return (await cargado).info.version
}

/** Convierte las probabilidades del modelo en una predicción cruzada con el catálogo del POS. */
export function interpretarProbabilidades(probs: ArrayLike<number>, info: InfoModelo, catalogo: Producto[] = []): PrediccionLocal {
  let mejor = 0
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[mejor]) mejor = i
  }
  const etiqueta = info.etiquetas[mejor] ?? `clase_${mejor}`
  const ref = MAPA_ETIQUETA_A_CODIGO[etiqueta]
  const producto = ref ? catalogo.find((p) => p.codigo === ref.codigo) : undefined
  return {
    etiqueta,
    confianza: Math.round(probs[mejor] * 10000) / 10000,
    productoCodigo: producto?.codigo ?? ref?.codigo ?? null,
    nombre: producto?.nombre ?? ref?.nombre ?? null,
    modelo: info.version,
  }
}

/** Ejecuta el modelo sobre un tensor [1, alto, ancho, 3] con píxeles de 0 a 255 (el modelo hace su propio escalado). */
export async function predecir(modelo: LayersModel, entrada: Tensor, info: InfoModelo, catalogo: Producto[] = []): Promise<PrediccionLocal> {
  const salida = modelo.predict(entrada) as Tensor
  try {
    return interpretarProbabilidades(await salida.data(), info, catalogo)
  } finally {
    salida.dispose()
  }
}

/** Clasifica un frame de <video> o una imagen <img> en el navegador, sin enviar nada al servidor. */
export async function clasificarElementoVisual(
  fuente: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  catalogo: Producto[] = [],
): Promise<PrediccionLocal> {
  await prepararModelo()
  const { modelo, info } = await cargado!
  const tf = await import('@tensorflow/tfjs')

  const canvas = document.createElement('canvas')
  canvas.width = TAMANO_ENTRADA
  canvas.height = TAMANO_ENTRADA
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('No se pudo preparar la imagen en este navegador')
  contexto.drawImage(fuente, 0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA)

  const entrada = tf.tidy(() => tf.browser.fromPixels(canvas).toFloat().expandDims(0))
  try {
    return await predecir(modelo, entrada, info, catalogo)
  } finally {
    entrada.dispose()
  }
}
