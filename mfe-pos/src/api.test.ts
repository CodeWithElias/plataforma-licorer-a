import { describe, expect, it } from 'vitest';
import { mensajeDeVenta, totalCarrito, type Producto } from './api';

import * as tf from '@tensorflow/tfjs';
import { interpretarProbabilidades, predecir } from './clasificadorTfjs';

const pacena: Producto = { codigo: 'CER-001', nombre: 'Cerveza Paceña 620 ml', tipo: 'CERVEZA', precio: 12 };
const vino: Producto = { codigo: 'VIN-001', nombre: 'Vino Kohlberg', tipo: 'VINO', precio: 45.5 };

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

  it('clasifica con un modelo real de TensorFlow.js en el navegador (CU04 / R06)', async () => {
    // Promedia los colores y elige una clase: rojo -> jw_red, azul -> huari_620
    const modelo = tf.sequential({
      layers: [
        tf.layers.globalAveragePooling2d({ inputShape: [8, 8, 3] }),
        tf.layers.dense({ units: 2, activation: 'softmax' }),
      ],
    });
    modelo.layers[1].setWeights([tf.tensor2d([[0.2, -0.2], [0, 0], [-0.2, 0.2]]), tf.tensor1d([0, 0])]);
    const info = { version: 'prueba', etiquetas: ['jw_red', 'huari_620'] };
    const imagen = (r: number, b: number) =>
      tf.stack([tf.fill([8, 8], r), tf.fill([8, 8], 0), tf.fill([8, 8], b)], 2).expandDims(0);

    const rojo = await predecir(modelo, imagen(255, 0), info);
    const azul = await predecir(modelo, imagen(0, 255), info, [pacena, { ...vino, codigo: 'CER-003', nombre: 'Huari del catálogo' }]);

    expect(rojo).toMatchObject({ etiqueta: 'jw_red', productoCodigo: 'WHI-001', modelo: 'prueba' });
    expect(rojo.confianza).toBeGreaterThanOrEqual(0.8);
    expect(azul).toMatchObject({ etiqueta: 'huari_620', productoCodigo: 'CER-003', nombre: 'Huari del catálogo' });
  });

  it('una etiqueta desconocida no se asocia a ningún producto', () => {
    const p = interpretarProbabilidades([0.1, 0.9], { version: 'v', etiquetas: ['pacena_620', 'otra'] });
    expect(p).toMatchObject({ etiqueta: 'otra', confianza: 0.9, productoCodigo: null, nombre: null });
  });
});
