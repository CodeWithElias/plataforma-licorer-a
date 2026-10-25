package com.licoreria.ventas.domain.exception;

/** Error de negocio con un código estable para el cliente (ver docs/openapi.yaml). */
public abstract class DominioException extends RuntimeException {

  protected DominioException(String mensaje) {
    super(mensaje);
  }

  protected DominioException(String mensaje, Throwable causa) {
    super(mensaje, causa);
  }

  public abstract String codigo();
}
