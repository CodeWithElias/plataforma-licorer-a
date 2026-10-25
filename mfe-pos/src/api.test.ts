import { describe, expect, it } from 'vitest'
import { mensajeDeVenta, totalCarrito, type Producto } from './api'

const pacena: Producto = { codigo: 'CER-001', nombre: 'Cerveza Paceña 620 ml', tipo: 'CERVEZA', precio: 12 }
const vino: Producto = { codigo: 'VIN-001', nombre: 'Vino Kohlberg', tipo: 'VINO', precio: 45.5 }

describe('POS', () => {
  it('calcula el total del carrito', () => {
    expect(totalCarrito([{ producto: pacena, cantidad: 2 }, { producto: vino, cantidad: 1 }])).toBe(69.5)
    expect(totalCarrito([])).toBe(0)
  })

  it('explica la falta de stock con el nombre del producto', () => {
    const texto = mensajeDeVenta(
      { estado: 409, codigo: 'SIN_STOCK', mensaje: 'x', faltantes: [{ productoCodigo: 'CER-001', pedido: 60, disponible: 46 }] },
      [pacena],
    )
    expect(texto).toBe('Sin stock suficiente: Cerveza Paceña 620 ml (pediste 60, hay 46)')
  })

  it('avisa que la Saga revirtió la venta', () => {
    expect(mensajeDeVenta({ estado: 502, codigo: 'SAGA_COMPENSADA', mensaje: 'x' })).toContain('se revirtió automáticamente')
  })
})
