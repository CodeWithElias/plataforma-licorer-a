import { Injectable } from '@nestjs/common';
import { type Inventario, InventarioNoDisponible } from '../dominio/inventario.js';

/** Adaptador HTTP de ms-inventario. INVENTARIO_URL: http://ms-inventario:8001 en Docker, la URL de la EC2 en producción. */
@Injectable()
export class HttpInventario implements Inventario {
  async reponer(productoCodigo: string, cantidad: number, token: string): Promise<void> {
    const base = (process.env.INVENTARIO_URL || 'http://localhost/api/inventario').replace(/\/+$/, '');
    let respuesta: Response;
    try {
      respuesta = await fetch(`${base}/stock/${encodeURIComponent(productoCodigo)}/reposiciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cantidad }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new InventarioNoDisponible(`No se pudo conectar con ms-inventario para reponer ${productoCodigo}.`);
    }
    if (respuesta.ok) return;

    // ms-inventario responde { codigo, mensaje }
    const cuerpo = (await respuesta.json().catch(() => null)) as { mensaje?: string } | null;
    const motivo = cuerpo?.mensaje ?? `respondió ${respuesta.status}`;
    throw new InventarioNoDisponible(`ms-inventario no repuso ${productoCodigo}: ${motivo}`);
  }
}
