import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ItemCarrito,
  listarProductos,
  mensajeDeVenta,
  type MetodoPago,
  type Producto,
  servidorDisponible,
  sincronizarVentasLote,
  totalCarrito,
  vender,
} from './api';
import { ColaOfflineModal } from './ColaOfflineModal';
import { contarVentasOffline, guardarVentaOffline, listarVentasOffline } from './db/indexed-db';
import { estilos } from './estilos';
import { type PrediccionLocal } from './clasificadorTfjs';
import EscanerCamara from './EscanerCamara';

type Aviso = { tipo: 'ok' | 'error'; titulo: string; texto: string } | null;

const bs = (n: number) => `Bs ${n.toFixed(2)}`;

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'QR', etiqueta: 'QR' },
];

const TIPOS: Record<string, string> = {
  CERVEZA: 'Cerveza',
  VINO: 'Vino',
  SINGANI: 'Singani',
  RON: 'Ron',
  WHISKY: 'Whisky',
  VODKA: 'Vodka',
  OTRO: 'Otros',
};

/** Punto de venta (CU02, CU03, CU04): catálogo, carrito, cobro online/offline y cámara. */
export default function Pos() {

  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [cobrando, setCobrando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  // Estados Offline y Modales (CU03, CU04)
  const [enLinea, setEnLinea] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [colaCount, setColaCount] = useState(0);
  const [modalColaAbierto, setModalColaAbierto] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  const refrescarCola = () => {
    contarVentasOffline().then(setColaCount).catch(() => {});
  };

  const sincronizando = useRef(false);

  /** Revisa si el servidor responde y, si responde, envía las ventas pendientes de la cola (CU03). */
  const comprobarConexion = async () => {
    if (!navigator.onLine) {
      setEnLinea(false);
      return;
    }
    const disponible = await servidorDisponible();
    setEnLinea(disponible);
    if (!disponible || sincronizando.current) return;

    sincronizando.current = true;
    try {
      const pendientes = (await listarVentasOffline()).filter((v) => v.estadoSync === 'PENDIENTE');
      if (pendientes.length > 0) {
        const r = await sincronizarVentasLote(pendientes);
        setAviso({
          tipo: r.errores > 0 ? 'error' : 'ok',
          titulo: 'Ventas offline sincronizadas',
          texto: `${r.exitosas} registradas, ${r.duplicadas} ya existían, ${r.errores} con error (revisa Cola Offline).`,
        });
      }
    } catch {
      // Se reintenta en la siguiente comprobación
    } finally {
      sincronizando.current = false;
      refrescarCola();
    }
  };

  useEffect(() => {
    const handleOnline = () => void comprobarConexion();
    const handleOffline = () => {
      setEnLinea(false);
    };
    const revision = window.setInterval(() => void comprobarConexion(), 30000);
    void comprobarConexion();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refrescarCola();

    listarProductos()
      .then(setProductos)
      .catch((e: Error) => setErrorCatalogo(e.message))
      .finally(() => setCargando(false));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(revision);
    };
  }, []);

  const tipos = useMemo(() => [...new Set(productos.map((p) => p.tipo))].sort(), [productos]);
  const visibles = productos.filter(
    (p) =>
      (!tipo || p.tipo === tipo) &&
      `${p.codigo} ${p.nombre} ${p.marca ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()),
  );
  const cantidadEnCarrito = (codigo: string) => carrito.find((i) => i.producto.codigo === codigo)?.cantidad ?? 0;
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);

  const cambiarCantidad = (producto: Producto, delta: number) => {
    setAviso(null);
    setCarrito((actual) => {
      const item = actual.find((i) => i.producto.codigo === producto.codigo);
      if (!item) return delta > 0 ? [...actual, { producto, cantidad: delta }] : actual;
      const cantidad = item.cantidad + delta;
      return cantidad <= 0 ? actual.filter((i) => i !== item) : actual.map((i) => (i === item ? { ...i, cantidad } : i));
    });
  };

  const total = totalCarrito(carrito);

  const cobrar = async () => {
    setCobrando(true);
    setAviso(null);
    const operationId = crypto.randomUUID();

    // 1. Si estamos offline o el navegador no tiene red, guardar directamente en IndexedDB
    if (!enLinea) {
      try {
        await guardarVentaOffline(carrito, metodo, operationId, total);
        refrescarCola();
        setCarrito([]);
        setAviso({
          tipo: 'ok',
          titulo: 'Venta guardada en modo Offline (IndexedDB)',
          texto: `Total registrado ${bs(total)}. Se sincronizará automáticamente al volver la conexión.`,
        });
      } catch (e: any) {
        setAviso({ tipo: 'error', titulo: 'Error local', texto: e.message });
      } finally {
        setCobrando(false);
      }
      return;
    }

    // 2. Si estamos online, intentar registrar la venta por la Saga
    const r = await vender(carrito, metodo, operationId);
    setCobrando(false);

    if (r.ok) {
      setAviso({
        tipo: 'ok',
        titulo: `Venta Nº ${r.venta.numero} completada`,
        texto: `Total cobrado ${bs(r.venta.total)}`,
      });
      setCarrito([]);
    } else if (r.error.codigo === 'SIN_CONEXION') {
      // Fallo de red sobre la marcha -> guardar en cola local
      try {
        await guardarVentaOffline(carrito, metodo, operationId, total);
        refrescarCola();
        setEnLinea(false);
        setCarrito([]);
        setAviso({
          tipo: 'ok',
          titulo: 'Venta guardada en modo Offline',
          texto: 'Servidor no alcanzable. La venta quedó asegurada en IndexedDB.',
        });
      } catch (err: any) {
        setAviso({ tipo: 'error', titulo: 'Error local', texto: err.message });
      }
    } else {
      setAviso({ tipo: 'error', titulo: 'No se registró la venta', texto: mensajeDeVenta(r.error, productos) });
    }
  };

  return (
    <section className="pos">
      <style>{estilos}</style>

      <div className="pos-catalogo">
        <header className="pos-encabezado">
          <div>
            <h1>Punto de venta</h1>
            <p>{cargando ? 'Cargando catálogo…' : `${productos.length} productos disponibles`}</p>
          </div>

          <div className="pos-acciones-encabezado">
            {/* Estado de Red */}
            <span className={`pos-red-badge ${enLinea ? 'online' : 'offline'}`} title="Estado de conectividad">
              <span className="pos-red-punto" />
              <span>{enLinea ? 'En línea' : 'Sin conexión'}</span>
            </span>

            {/* Botón Cola Offline */}
            <button
              type="button"
              className="pos-btn-secundario"
              onClick={() => setModalColaAbierto(true)}
              title="Ver cola offline de IndexedDB (CU03)"
            >
              <span>📦 Cola Offline</span>
              {colaCount > 0 && <span className="pos-contador-cola">{colaCount}</span>}
            </button>

            {/* Escáner con el clasificador local de TF.js (CU04) */}
            <button
              type="button"
              className="pos-btn-camara"
              onClick={() => setEscanerAbierto(true)}
              title="Reconocer el producto con la cámara (IA en el navegador, CU04)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Escanear cámara (IA)
            </button>

            {/* Buscador */}
            <label className="pos-buscar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                placeholder="Buscar por código, nombre o marca"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>
        </header>

        <div className="pos-chips" role="tablist" aria-label="Tipo">
          <button className={!tipo ? 'activo' : ''} onClick={() => setTipo('')}>
            Todos
          </button>
          {tipos.map((t) => (
            <button key={t} className={tipo === t ? 'activo' : ''} onClick={() => setTipo(t)}>
              {TIPOS[t] ?? t}
            </button>
          ))}
        </div>

        {errorCatalogo && (
          <div className="pos-alerta error">
            <strong>No se pudo cargar el catálogo</strong>
            <span>{errorCatalogo}</span>
          </div>
        )}

        <div className="pos-productos">
          {cargando && Array.from({ length: 8 }, (_, i) => <div key={i} className="pos-producto esqueleto" />)}
          {visibles.map((p) => {
            const enCarrito = cantidadEnCarrito(p.codigo);
            return (
              <button
                key={p.codigo}
                className={`pos-producto${enCarrito ? ' seleccionado' : ''}`}
                onClick={() => cambiarCantidad(p, 1)}
                title="Agregar al carrito"
              >
                <span className={`pos-insignia t-${p.tipo.toLowerCase()}`}>{TIPOS[p.tipo] ?? p.tipo}</span>
                {enCarrito > 0 && <span className="pos-contador">{enCarrito}</span>}
                <span className="pos-nombre">{p.nombre}</span>
                <span className="pos-detalle">
                  {p.codigo}
                  {p.marca ? ` · ${p.marca}` : ''}
                </span>
                <span className="pos-pie">
                  <span className="pos-precio">{bs(p.precio)}</span>
                  <span className="pos-agregar" aria-hidden="true">
                    +
                  </span>
                </span>
              </button>
            );
          })}
          {!cargando && visibles.length === 0 && !errorCatalogo && (
            <p className="pos-vacio">No hay productos que coincidan.</p>
          )}
        </div>
      </div>

      <aside className="pos-carrito">
        <header>
          <h2>Venta actual</h2>
          <span className="pos-unidades">
            {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
          </span>
        </header>

        {carrito.length === 0 ? (
          <div className="pos-carrito-vacio">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
              <path d="M2.5 3h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 7H6" />
            </svg>
            <p>Toca un producto para agregarlo</p>
          </div>
        ) : (
          <ul className="pos-lineas">
            {carrito.map((i) => (
              <li key={i.producto.codigo}>
                <div className="pos-linea-info">
                  <span className="pos-linea-nombre">{i.producto.nombre}</span>
                  <span className="pos-linea-precio">{bs(i.producto.precio)} c/u</span>
                </div>
                <div className="pos-cantidad">
                  <button onClick={() => cambiarCantidad(i.producto, -1)} aria-label="Quitar uno">
                    −
                  </button>
                  <span>{i.cantidad}</span>
                  <button onClick={() => cambiarCantidad(i.producto, 1)} aria-label="Agregar uno">
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pos-resumen">
          {aviso && (
            <div className={`pos-alerta ${aviso.tipo}`}>
              <strong>{aviso.titulo}</strong>
              <span>{aviso.texto}</span>
            </div>
          )}

          <div className="pos-total">
            <span>Total</span>
            <strong>{bs(total)}</strong>
          </div>

          <div className="pos-metodos" role="radiogroup" aria-label="Método de pago">
            {METODOS.map((m) => (
              <button
                key={m.valor}
                className={metodo === m.valor ? 'activo' : ''}
                onClick={() => setMetodo(m.valor)}
                role="radio"
                aria-checked={metodo === m.valor}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>

          <button
            className={`pos-cobrar${!enLinea ? ' offline' : ''}`}
            disabled={carrito.length === 0 || cobrando}
            onClick={cobrar}
          >
            {cobrando ? 'Procesando…' : !enLinea ? `Cobrar Offline ${bs(total)}` : `Cobrar ${bs(total)}`}
          </button>
        </div>
      </aside>

      {/* Modal Cola Offline (CU03) */}
      <ColaOfflineModal
        abierto={modalColaAbierto}
        onCerrar={() => setModalColaAbierto(false)}
        onActualizado={refrescarCola}
      />

      {/* Escáner de cámara con IA local (CU04) */}
      {escanerAbierto && (
        <EscanerCamara
          productos={productos}
          alReconocer={(prod: Producto, pred: PrediccionLocal) => {
            cambiarCantidad(prod, 1)
            setAviso({
              tipo: 'ok',
              titulo: `Reconocido por IA: ${prod.nombre}`,
              texto: `Confianza ${(pred.confianza * 100).toFixed(1)} % · Modelo local ${pred.modelo}`,
            })
          }}
          alCerrar={() => setEscanerAbierto(false)}
        />
      )}

    </section>
  );
}
