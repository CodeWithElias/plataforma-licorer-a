package com.licoreria.ventas.application.port.out;

import com.licoreria.ventas.domain.model.DetalleVenta;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** ms-inventario visto desde la Saga. Todas las operaciones son idempotentes por reservaId (= operationId). */
public interface InventarioPort {

  record ProductoCatalogo(String codigo, String nombre, BigDecimal precio) {}

  /** @throws com.licoreria.ventas.domain.exception.ProductoNoEncontradoException */
  ProductoCatalogo obtenerProducto(String codigo, String token);

  /**
   * Paso 2. @throws com.licoreria.ventas.domain.exception.SinStockException
   * @throws com.licoreria.ventas.domain.exception.ProductoNoEncontradoException
   */
  void reservar(UUID reservaId, List<DetalleVenta> items, String token);

  /** Paso 4. */
  void confirmar(UUID reservaId, String token);

  /** Compensación del paso 2 (si la reserva no existe, no hace nada). */
  void liberar(UUID reservaId, String token);
}
