import { useEffect, useMemo, useState } from 'react'
import { type ItemCarrito, listarProductos, mensajeDeVenta, type MetodoPago, type Producto, totalCarrito, vender } from './api'
import { estilos } from './estilos'

type Aviso = { tipo: 'ok' | 'error'; titulo: string; texto: string } | null

const bs = (n: number) => `Bs ${n.toFixed(2)}`

const METODOS: { valor: MetodoPago; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'QR', etiqueta: 'QR' },
]

const TIPOS: Record<string, string> = {
  CERVEZA: 'Cerveza', VINO: 'Vino', SINGANI: 'Singani', RON: 'Ron', WHISKY: 'Whisky', VODKA: 'Vodka', OTRO: 'Otros',
}

/** Punto de venta (CU02): catálogo, carrito y cobro. */
export default function Pos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO')
  const [cobrando, setCobrando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => {
    listarProductos()
      .then(setProductos)
      .catch((e: Error) => setErrorCatalogo(e.message))
      .finally(() => setCargando(false))
  }, [])

  const tipos = useMemo(() => [...new Set(productos.map((p) => p.tipo))].sort(), [productos])
  const visibles = productos.filter(
    (p) => (!tipo || p.tipo === tipo) && `${p.codigo} ${p.nombre} ${p.marca ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()),
  )
  const cantidadEnCarrito = (codigo: string) => carrito.find((i) => i.producto.codigo === codigo)?.cantidad ?? 0
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0)

  const cambiarCantidad = (producto: Producto, delta: number) => {
    setAviso(null)
    setCarrito((actual) => {
      const item = actual.find((i) => i.producto.codigo === producto.codigo)
      if (!item) return delta > 0 ? [...actual, { producto, cantidad: delta }] : actual
      const cantidad = item.cantidad + delta
      return cantidad <= 0 ? actual.filter((i) => i !== item) : actual.map((i) => (i === item ? { ...i, cantidad } : i))
    })
  }

  const cobrar = async () => {
    setCobrando(true)
    setAviso(null)
    const r = await vender(carrito, metodo, crypto.randomUUID())
    setCobrando(false)
    if (r.ok) {
      setAviso({ tipo: 'ok', titulo: `Venta Nº ${r.venta.numero} completada`, texto: `Total cobrado ${bs(r.venta.total)}` })
      setCarrito([])
    } else {
      setAviso({ tipo: 'error', titulo: 'No se registró la venta', texto: mensajeDeVenta(r.error, productos) })
    }
  }

  const total = totalCarrito(carrito)

  return (
    <section className="pos">
      <style>{estilos}</style>

      <div className="pos-catalogo">
        <header className="pos-encabezado">
          <div>
            <h1>Punto de venta</h1>
            <p>{cargando ? 'Cargando catálogo…' : `${productos.length} productos disponibles`}</p>
          </div>
          <label className="pos-buscar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input placeholder="Buscar por código, nombre o marca" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
        </header>

        <div className="pos-chips" role="tablist" aria-label="Tipo">
          <button className={!tipo ? 'activo' : ''} onClick={() => setTipo('')}>Todos</button>
          {tipos.map((t) => (
            <button key={t} className={tipo === t ? 'activo' : ''} onClick={() => setTipo(t)}>{TIPOS[t] ?? t}</button>
          ))}
        </div>

        {errorCatalogo && <div className="pos-alerta error"><strong>No se pudo cargar el catálogo</strong><span>{errorCatalogo}</span></div>}

        <div className="pos-productos">
          {cargando && Array.from({ length: 8 }, (_, i) => <div key={i} className="pos-producto esqueleto" />)}
          {visibles.map((p) => {
            const enCarrito = cantidadEnCarrito(p.codigo)
            return (
              <button key={p.codigo} className={`pos-producto${enCarrito ? ' seleccionado' : ''}`} onClick={() => cambiarCantidad(p, 1)}
                title="Agregar al carrito">
                <span className={`pos-insignia t-${p.tipo.toLowerCase()}`}>{TIPOS[p.tipo] ?? p.tipo}</span>
                {enCarrito > 0 && <span className="pos-contador">{enCarrito}</span>}
                <span className="pos-nombre">{p.nombre}</span>
                <span className="pos-detalle">{p.codigo}{p.marca ? ` · ${p.marca}` : ''}</span>
                <span className="pos-pie">
                  <span className="pos-precio">{bs(p.precio)}</span>
                  <span className="pos-agregar" aria-hidden="true">+</span>
                </span>
              </button>
            )
          })}
          {!cargando && visibles.length === 0 && !errorCatalogo && <p className="pos-vacio">No hay productos que coincidan.</p>}
        </div>
      </div>

      <aside className="pos-carrito">
        <header>
          <h2>Venta actual</h2>
          <span className="pos-unidades">{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>
        </header>

        {carrito.length === 0 ? (
          <div className="pos-carrito-vacio">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
              <path d="M2.5 3h2.6l2.3 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 7H6" /></svg>
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
                  <button onClick={() => cambiarCantidad(i.producto, -1)} aria-label="Quitar uno">−</button>
                  <span>{i.cantidad}</span>
                  <button onClick={() => cambiarCantidad(i.producto, 1)} aria-label="Agregar uno">+</button>
                </div>
                <span className="pos-linea-subtotal">{bs(i.producto.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="pos-resumen">
          <div className="pos-total"><span>Total</span><strong>{bs(total)}</strong></div>
          <div className="pos-metodos" role="radiogroup" aria-label="Método de pago">
            {METODOS.map((m) => (
              <button key={m.valor} role="radio" aria-checked={metodo === m.valor} className={metodo === m.valor ? 'activo' : ''}
                onClick={() => setMetodo(m.valor)}>{m.etiqueta}</button>
            ))}
          </div>
          <button className="pos-cobrar" disabled={carrito.length === 0 || cobrando} onClick={cobrar}>
            {cobrando ? 'Cobrando…' : `Cobrar ${bs(total)}`}
          </button>
          {aviso && (
            <div className={`pos-alerta ${aviso.tipo}`} role="status">
              <strong>{aviso.titulo}</strong>
              <span>{aviso.texto}</span>
            </div>
          )}
        </div>
      </aside>
    </section>
  )
}
