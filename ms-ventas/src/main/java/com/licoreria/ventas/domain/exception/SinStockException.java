package com.licoreria.ventas.domain.exception;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** ms-inventario no tiene stock suficiente: la Saga compensó y la venta quedó CANCELADA (409). */
public class SinStockException extends DominioException {

  private final List<Map<String, Object>> faltantes;
  private UUID ventaId;

  public SinStockException(List<Map<String, Object>> faltantes) {
    super("No hay stock suficiente");
    this.faltantes = faltantes == null ? List.of() : faltantes;
  }

  @Override
  public String codigo() {
    return "SIN_STOCK";
  }

  public List<Map<String, Object>> getFaltantes() { return faltantes; }
  public UUID getVentaId() { return ventaId; }

  public SinStockException deVenta(UUID ventaId) {
    this.ventaId = ventaId;
    return this;
  }
}
