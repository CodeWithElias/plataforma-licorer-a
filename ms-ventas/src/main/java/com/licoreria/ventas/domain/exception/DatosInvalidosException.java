package com.licoreria.ventas.domain.exception;

/** Datos de entrada que no cumplen las reglas. */
public class DatosInvalidosException extends DominioException {

  public DatosInvalidosException(String mensaje) {
    super(mensaje);
  }

  @Override
  public String codigo() {
    return "DATOS_INVALIDOS";
  }
}
