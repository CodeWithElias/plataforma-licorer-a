package com.licoreria.ventas.domain.model;

import java.math.BigDecimal;

/**
 * Pago simulado de la venta: se aprueba al crearla y se reembolsa si la Saga compensa.
 */
public final class Pago {

  public enum Estado { APROBADO, REEMBOLSADO }

  private final MetodoPago metodo;
  private final BigDecimal monto;
  private Estado estado;

  public Pago(MetodoPago metodo, BigDecimal monto, Estado estado) {
    this.metodo = metodo;
    this.monto = monto;
    this.estado = estado;
  }

  static Pago aprobado(MetodoPago metodo, BigDecimal monto) {
    return new Pago(metodo, monto, Estado.APROBADO);
  }

  void reembolsar() {
    estado = Estado.REEMBOLSADO;
  }

  public MetodoPago getMetodo() { return metodo; }
  public BigDecimal getMonto() { return monto; }
  public Estado getEstado() { return estado; }
}
