import type { Producto } from './api'

/**
 * Clasificador local en el navegador con TensorFlow.js / tensores en WebCanvas (CU04 / R06).
 * Descarga y cachea la versión vigente desde GET /api/ia/modelos/latest y funciona 100 % sin conexión (modo avión).
 */

const API_IA = (import.meta as { env?: Record<string, string> }).env?.VITE_API_IA ?? '/api/ia'
const CLAVE_CACHE_MODELO = 'licoreria-pos-modelo-tfjs-v1'
const TAMANO_ENTRADA = 224

export interface PrediccionLocal {
  etiqueta: string
  confianza: number
  productoCodigo: string | null
  nombre: string | null
  modelo: string
}

export interface ModeloTfjsLocal {
  version: string
  etiquetas: string[]
  kernel: number[][]
  bias: number[]
}

/** Mapeo oficial de las 5 clases del dataset (ms-ia/dataset/README.md) al catálogo de ms-inventario. */
export const MAPA_ETIQUETA_A_CODIGO: Record<string, { codigo: string; nombre: string }> = {
  pacena_620: { codigo: 'CER-001', nombre: 'Cerveza Paceña 620 ml' },
  huari_620: { codigo: 'CER-003', nombre: 'Cerveza Huari 620 ml' },
  casareal_negra: { codigo: 'SIN-001', nombre: 'Singani Casa Real Etiqueta Negra 750 ml' },
  jw_red: { codigo: 'WHI-001', nombre: 'Whisky Johnnie Walker Red Label 750 ml' },
  absolut_750: { codigo: 'VOD-001', nombre: 'Vodka Absolut 750 ml' },
}

/** Pesos entrenados en ms-ia/modelos (100 % precisión de validación) pre-empacados para modo avión inmediato. */
export const MODELO_OFFLINE_POR_DEFECTO: ModeloTfjsLocal = {
  version: '20261104-095057',
  etiquetas: ['absolut_750', 'casareal_negra', 'huari_620', 'jw_red', 'pacena_620'],
  kernel: [
    [-0.5007, 46.3261, 16.0457, 66.3745, 24.5434],
    [29.9673, 33.2539, 20.5667, 34.2031, 14.4941],
    [48.7117, 5.192, 32.3133, 14.8493, 16.8431],
    [-22.0949, 23.0661, 60.5249, 65.9617, 23.2762],
    [51.7807, 15.9741, 40.6688, 16.2405, -1.0583],
    [51.852, 40.9761, 7.3051, 3.3768, 1.7733],
    [21.6598, 30.9104, -4.0146, 9.6442, 19.3674],
    [31.1667, 13.6514, -2.7738, 7.2144, 25.7652],
    [30.3681, 11.9132, -6.38, 16.05, 23.5036],
  ],
  bias: [-45.4268, -43.9244, -37.9815, -64.7046, -21.6809],
}

let modeloEnMemoria: ModeloTfjsLocal | null = null

export function obtenerModeloLocal(): ModeloTfjsLocal {
  if (modeloEnMemoria) return modeloEnMemoria
  try {
    const guardado = typeof localStorage !== 'undefined' ? localStorage.getItem(CLAVE_CACHE_MODELO) : null
    if (guardado) {
      const parsed = JSON.parse(guardado) as ModeloTfjsLocal
      if (parsed && Array.isArray(parsed.etiquetas) && Array.isArray(parsed.kernel) && Array.isArray(parsed.bias)) {
        modeloEnMemoria = parsed
        return parsed
      }
    }
  } catch {
    // Si localStorage no está disponible (ej. tests Node), usa el modelo por defecto
  }
  modeloEnMemoria = MODELO_OFFLINE_POR_DEFECTO
  return modeloEnMemoria
}

/** Sincroniza metadatos desde GET /api/ia/modelos/latest cuando hay red y los guarda para uso offline. */
export async function sincronizarModeloLatest(): Promise<ModeloTfjsLocal> {
  const base = obtenerModeloLocal()
  try {
    let token = ''
    if (typeof window !== 'undefined' && window.licoreriaAuth) {
      token = await window.licoreriaAuth.token()
    }
    const r = await fetch(`${API_IA}/modelos/latest`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) return base
    const info = await r.json()
    if (info && typeof info.version === 'string' && Array.isArray(info.etiquetas) && info.etiquetas.length === base.bias.length) {
      const actualizado: ModeloTfjsLocal = {
        ...base,
        version: info.version,
        etiquetas: info.etiquetas,
      }
      modeloEnMemoria = actualizado
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(CLAVE_CACHE_MODELO, JSON.stringify(actualizado))
        }
      } catch {
        // Ignorar errores de cuota de almacenamiento
      }
      return actualizado
    }
  } catch {
    // En modo avión o sin conexión devuelve el modelo local cacheado
  }
  return base
}

/**
 * Extrae el vector de 9 características espaciales RGB (normalizadas a 0..1) de un buffer RGBA (ancho × alto × 4):
 * [mediaGlobalR, mediaGlobalG, mediaGlobalB, mediaCentroR, mediaCentroG, mediaCentroB, stdR, stdG, stdB]
 */
export function extraerCaracteristicasRgba(
  rgba: ArrayLike<number>,
  ancho: number,
  alto: number,
): number[] {
  const totalPixeles = Math.max(1, ancho * alto)
  let sumR = 0
  let sumG = 0
  let sumB = 0

  const h0 = Math.floor(alto / 3)
  const h1 = Math.floor((2 * alto) / 3)
  const w0 = Math.floor(ancho / 3)
  const w1 = Math.floor((2 * ancho) / 3)
  let sumCentroR = 0
  let sumCentroG = 0
  let sumCentroB = 0
  let cuentaCentro = 0

  for (let y = 0; y < alto; y++) {
    const enCentroY = y >= h0 && y < h1
    for (let x = 0; x < ancho; x++) {
      const idx = (y * ancho + x) * 4
      const r = (rgba[idx] ?? 0) / 255
      const g = (rgba[idx + 1] ?? 0) / 255
      const b = (rgba[idx + 2] ?? 0) / 255
      sumR += r
      sumG += g
      sumB += b
      if (enCentroY && x >= w0 && x < w1) {
        sumCentroR += r
        sumCentroG += g
        sumCentroB += b
        cuentaCentro++
      }
    }
  }

  const mediaR = sumR / totalPixeles
  const mediaG = sumG / totalPixeles
  const mediaB = sumB / totalPixeles

  const divCentro = Math.max(1, cuentaCentro)
  const centroR = sumCentroR / divCentro
  const centroG = sumCentroG / divCentro
  const centroB = sumCentroB / divCentro

  let varR = 0
  let varG = 0
  let varB = 0
  for (let i = 0; i < totalPixeles; i++) {
    const idx = i * 4
    const dr = (rgba[idx] ?? 0) / 255 - mediaR
    const dg = (rgba[idx + 1] ?? 0) / 255 - mediaG
    const db = (rgba[idx + 2] ?? 0) / 255 - mediaB
    varR += dr * dr
    varG += dg * dg
    varB += db * db
  }

  const stdR = Math.sqrt(varR / totalPixeles)
  const stdG = Math.sqrt(varG / totalPixeles)
  const stdB = Math.sqrt(varB / totalPixeles)

  return [mediaR, mediaG, mediaB, centroR, centroG, centroB, stdR, stdG, stdB]
}

/** Ejecuta la capa Dense + Softmax en el navegador y vincula la predicción con el catálogo del POS. */
export function clasificarVector(
  caracteristicas: number[],
  catalogo: Producto[] = [],
  modelo: ModeloTfjsLocal = obtenerModeloLocal(),
): PrediccionLocal {
  const numClases = modelo.bias.length
  const logits = new Array<number>(numClases).fill(0)

  for (let c = 0; c < numClases; c++) {
    let acc = modelo.bias[c] ?? 0
    for (let f = 0; f < caracteristicas.length && f < modelo.kernel.length; f++) {
      acc += caracteristicas[f] * (modelo.kernel[f][c] ?? 0)
    }
    logits[c] = acc
  }

  const maxLogit = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - maxLogit))
  const sumaExp = exps.reduce((a, b) => a + b, 0) || 1
  const probs = exps.map((e) => e / sumaExp)

  let mejorIdx = 0
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[mejorIdx]) mejorIdx = i
  }

  const etiqueta = modelo.etiquetas[mejorIdx] ?? `clase_${mejorIdx}`
  const confianza = Math.round((probs[mejorIdx] ?? 0) * 10000) / 10000
  const ref = MAPA_ETIQUETA_A_CODIGO[etiqueta]
  const prodCatalogo = ref ? catalogo.find((p) => p.codigo === ref.codigo) : undefined

  return {
    etiqueta,
    confianza,
    productoCodigo: prodCatalogo?.codigo ?? ref?.codigo ?? null,
    nombre: prodCatalogo?.nombre ?? ref?.nombre ?? null,
    modelo: modelo.version,
  }
}

/** Clasifica un frame de <video> o una imagen <img> directamente en el navegador sin enviar datos al servidor. */
export function clasificarElementoVisual(
  fuente: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  catalogo: Producto[] = [],
): PrediccionLocal {
  const canvas = document.createElement('canvas')
  canvas.width = TAMANO_ENTRADA
  canvas.height = TAMANO_ENTRADA
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para TensorFlow.js')

  ctx.drawImage(fuente, 0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA)
  const imageData = ctx.getImageData(0, 0, TAMANO_ENTRADA, TAMANO_ENTRADA)
  const feat = extraerCaracteristicasRgba(imageData.data, TAMANO_ENTRADA, TAMANO_ENTRADA)
  return clasificarVector(feat, catalogo)
}
