import { useEffect, useRef, useState } from 'react';
import { type Producto } from './api';

interface CamaraModalProps {
  abierto: boolean;
  onCerrar: () => void;
  productos: Producto[];
  onDetectar: (producto: Producto) => void;
}

export function CamaraModal({ abierto, onCerrar, productos, onDetectar }: CamaraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);

  useEffect(() => {
    if (!abierto) {
      detenerCamara();
      return;
    }

    setErrorCamara(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.warn('Cámara física no disponible:', err);
        setErrorCamara('Cámara web no disponible. Puedes usar los botones de simulación del modelo (CU04).');
      });

    return () => {
      detenerCamara();
    };
  }, [abierto]);

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  if (!abierto) return null;

  const simularDeteccion = (codigo: string) => {
    const prod = productos.find((p) => p.codigo === codigo);
    if (!prod) return;
    setAnalizando(true);
    setTimeout(() => {
      setAnalizando(false);
      onDetectar(prod);
      onCerrar();
    }, 400);
  };

  return (
    <div className="pos-modal-fondo" onClick={onCerrar}>
      <div className="pos-modal-cuerpo" onClick={(e) => e.stopPropagation()}>
        <header className="pos-modal-header">
          <div>
            <h3>Reconocimiento por cámara</h3>
            <small style={{ color: 'var(--lila-600)', fontWeight: 600 }}>CU04 – Visión artificial (ms-ia / TF.js)</small>
          </div>
          <button className="pos-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">&times;</button>
        </header>

        <div className="pos-modal-contenido">
          <div className="pos-camara-visor">
            {errorCamara ? (
              <div style={{ color: '#fff', textAlign: 'center', padding: '1.5rem', fontSize: '.9rem' }}>
                <p>📷 {errorCamara}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="pos-camara-video" />
                <div className="pos-camara-mira">
                  <div className="pos-camara-recuadro">
                    <div className="pos-camara-laser" />
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: '1.2rem' }}>
            <p style={{ margin: '0 0 .6rem', fontWeight: 600, fontSize: '.88rem', color: 'var(--tinta)' }}>
              {analizando ? 'Analizando imagen…' : 'Simular detección del modelo sintético (Dev 3):'}
            </p>
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
              {['CER-001', 'VIN-001', 'SIN-003', 'RON-002', 'WHI-003'].map((cod) => {
                const prod = productos.find((p) => p.codigo === cod);
                return (
                  <button
                    key={cod}
                    type="button"
                    className="pos-btn-secundario"
                    style={{ height: '36px', fontSize: '.82rem', padding: '0 .7rem' }}
                    onClick={() => simularDeteccion(cod)}
                    disabled={analizando}
                  >
                    🎯 {prod ? prod.nombre.split(' ')[0] : cod} ({cod})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="pos-modal-footer">
          <button type="button" className="pos-btn-secundario" onClick={onCerrar}>Cerrar</button>
        </footer>
      </div>
    </div>
  );
}
