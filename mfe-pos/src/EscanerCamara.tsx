import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { type Producto } from './api'
import {
  clasificarElementoVisual,
  obtenerModeloLocal,
  type PrediccionLocal,
  sincronizarModeloLatest,
} from './clasificadorTfjs'

interface PropsEscaner {
  productos: Producto[]
  alReconocer: (producto: Producto, prediccion: PrediccionLocal) => void
  alCerrar: () => void
}

/**
 * Escáner de productos por cámara con inferencia local en el navegador (TensorFlow.js / CU04 / R06).
 * Funciona tanto con webcam en vivo como subiendo una foto local, 100 % sin conexión (modo avión).
 */
export default function EscanerCamara({ productos, alReconocer, alCerrar }: PropsEscaner) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [prediccion, setPrediccion] = useState<PrediccionLocal | null>(null)
  const [versionModelo, setVersionModelo] = useState<string>(() => obtenerModeloLocal().version)

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCamaraActiva(false)
  }

  useEffect(() => {
    sincronizarModeloLatest().then((m) => setVersionModelo(m.version))

    let cancelado = false
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
        .then((stream) => {
          if (cancelado) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
          setCamaraActiva(true)
        })
        .catch(() => {
          if (!cancelado) {
            setErrorCamara('No se detectó cámara activa. Puedes subir una foto del producto para clasificarla localmente.')
          }
        })
    } else {
      setErrorCamara('Cámara no disponible en este navegador. Usa el botón de subir foto para clasificar localmente.')
    }

    return () => {
      cancelado = true
      detenerCamara()
    }
  }, [])

  const procesarResultado = (res: PrediccionLocal) => {
    setPrediccion(res)
    if (res.productoCodigo && res.confianza >= 0.8) {
      const encontrado = productos.find((p) => p.codigo === res.productoCodigo)
      if (encontrado) {
        alReconocer(encontrado, res)
      }
    }
  }

  const capturarDesdeWebcam = () => {
    const video = videoRef.current
    if (!video) return
    try {
      const res = clasificarElementoVisual(video, productos)
      procesarResultado(res)
    } catch (e) {
      setErrorCamara((e as Error).message)
    }
  }

  const alSeleccionarFoto = (ev: ChangeEvent<HTMLInputElement>) => {
    const archivo = ev.target.files?.[0]
    if (!archivo) return
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      try {
        const res = clasificarElementoVisual(img, productos)
        procesarResultado(res)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.src = url
  }

  return (
    <div className="pos-modal-fondo" role="dialog" aria-modal="true" aria-label="Reconocimiento de productos por cámara">
      <div className="pos-modal">
        <header className="pos-modal-encabezado">
          <div>
            <h3>Reconocer producto con IA Local (TF.js)</h3>
            <p>Inferencia en el navegador sin servidor · Modelo {versionModelo}</p>
          </div>
          <button type="button" className="pos-modal-cerrar" onClick={alCerrar} aria-label="Cerrar escáner">
            ✕
          </button>
        </header>

        <div className="pos-modal-cuerpo">
          <div className="pos-visor-camara">
            <video ref={videoRef} autoPlay playsInline muted className={camaraActiva ? 'activo' : 'oculto'} />
            {!camaraActiva && (
              <div className="pos-visor-placeholder">
                <p>{errorCamara ?? 'Iniciando cámara…'}</p>
              </div>
            )}
          </div>

          <div className="pos-modal-acciones">
            <button
              type="button"
              className="pos-btn-primario"
              disabled={!camaraActiva}
              onClick={capturarDesdeWebcam}
            >
              Capturar de cámara
            </button>

            <label className="pos-btn-secundario">
              Subir foto de prueba
              <input type="file" accept="image/*" onChange={alSeleccionarFoto} hidden />
            </label>
          </div>

          {prediccion && (
            <div className={`pos-alerta ${prediccion.confianza >= 0.8 ? 'ok' : 'error'}`}>
              <strong>
                {prediccion.nombre ?? prediccion.etiqueta} ({prediccion.productoCodigo ?? 'Sin código'})
              </strong>
              <span>
                Confianza: {(prediccion.confianza * 100).toFixed(1)} % · Etiqueta: {prediccion.etiqueta}
                {prediccion.confianza >= 0.8 ? ' · Agregado al carrito' : ' · Confianza menor al 80 %'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

