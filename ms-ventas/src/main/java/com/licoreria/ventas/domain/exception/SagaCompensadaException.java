package com.licoreria.ventas.domain.exception;

import java.util.UUID;

/** Falló un paso posterior de la Saga (p. ej. ms-gestion caído): se compensó y la venta quedó CANCELADA (502). */
public class SagaCompensadaException extends DominioException {

  private final UUID ventaId;

  public SagaCompensadaException(UUID ventaId, String motivo, Throwable causa) {
    super(motivo, causa);
    this.ventaId = ventaId;
  }

  @Override
  public String codigo() {
    return "SAGA_COMPENSADA";
  }

  public UUID getVentaId() { return ventaId; }
}
