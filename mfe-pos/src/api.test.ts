
import { describe, expect, it } from 'vitest';
import { mensajeDeVenta, totalCarrito, type Producto } from './api';

import { clasificarVector, extraerCaracteristicasRgba } from './clasificadorTfjs'

const pacena: Producto = { codigo: 'CER-001', nombre: 'Cerveza Paceña 620 ml', tipo: 'CERVEZA', precio: 12 };
const vino: Producto = { codigo: 'VIN-001', nombre: 'Vino Kohlberg', tipo: 'VINO', precio: 45.5 };

function generarImagenSinteticaRgba(rObj: number, gObj: number, bObj: number, tamano = 64): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(tamano * tamano * 4)
  const b0 = Math.floor(tamano * 0.18)
  const b1 = Math.floor(tamano * 0.82)
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const idx = (y * tamano + x) * 4
      const dentro = y >= b0 && y < b1 && x >= b0 && x < b1
      buf[idx] = dentro ? rObj : 225
      buf[idx + 1] = dentro ? gObj : 225
      buf[idx + 2] = dentro ? bObj : 220
      buf[idx + 3] = 255
    }
  }
  return buf
}

describe('POS', () => {
  it('calcula el total del carrito', () => {
    expect(totalCarrito([{ producto: pacena, cantidad: 2 }, { producto: vino, cantidad: 1 }])).toBe(69.5);
    expect(totalCarrito([])).toBe(0);
  });

  it('explica la falta de stock con el nombre del producto', () => {
    const texto = mensajeDeVenta(
      { estado: 409, codigo: 'SIN_STOCK', mensaje: 'x', faltantes: [{ productoCodigo: 'CER-001', pedido: 60, disponible: 46 }] },
      [pacena],
    );
    expect(texto).toBe('Sin stock suficiente: Cerveza Paceña 620 ml (pediste 60, hay 46)');
  });

  it('avisa que la Saga revirtió la venta', () => {

    expect(mensajeDeVenta({ estado: 502, codigo: 'SAGA_COMPENSADA', mensaje: 'x' })).toContain('se revirtió automáticamente');
  });

  it('informa correctamente del modo offline cuando no hay conexión', () => {
    expect(mensajeDeVenta({ estado: 0, codigo: 'SIN_CONEXION', mensaje: 'x' })).toContain('modo Offline');
  });
});


  it('reconoce los 5 productos en el navegador sin conexión con confianza >= 80 % (CU04 / R06)', () => {
    const casos: { color: [number, number, number]; etiqueta: string; codigo: string }[] = [
      { color: [200, 160, 40], etiqueta: 'pacena_620', codigo: 'CER-001' },
      { color: [30, 90, 170], etiqueta: 'huari_620', codigo: 'CER-003' },
      { color: [25, 25, 25], etiqueta: 'casareal_negra', codigo: 'SIN-001' },
      { color: [180, 30, 40], etiqueta: 'jw_red', codigo: 'WHI-001' },
      { color: [140, 190, 220], etiqueta: 'absolut_750', codigo: 'VOD-001' },
    ]

    for (const c of casos) {
      const rgba = generarImagenSinteticaRgba(c.color[0], c.color[1], c.color[2], 64)
      const feat = extraerCaracteristicasRgba(rgba, 64, 64)
      const pred = clasificarVector(feat, [pacena])
      expect(pred.etiqueta).toBe(c.etiqueta)
      expect(pred.productoCodigo).toBe(c.codigo)
      expect(pred.confianza).toBeGreaterThanOrEqual(0.8)
    }
  })
})

