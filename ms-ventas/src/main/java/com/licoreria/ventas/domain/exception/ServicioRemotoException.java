package com.licoreria.ventas.domain.exception;

/** Otro microservicio no respondió o respondió con error, aun después de los reintentos. */
public class ServicioRemotoException extends RuntimeException {

  public ServicioRemotoException(String mensaje) {
    super(mensaje);
  }

  public ServicioRemotoException(String mensaje, Throwable causa) {
    super(mensaje, causa);
  }
}
