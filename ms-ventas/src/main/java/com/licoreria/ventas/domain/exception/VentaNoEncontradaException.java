package com.licoreria.ventas.domain.exception;

/** La venta pedida no existe. */
public class VentaNoEncontradaException extends DominioException {

  public VentaNoEncontradaException(String mensaje) {
    super(mensaje);
  }

  @Override
  public String codigo() {
    return "VENTA_NO_ENCONTRADA";
  }
}
