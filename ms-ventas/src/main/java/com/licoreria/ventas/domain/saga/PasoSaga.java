package com.licoreria.ventas.domain.saga;

/** Pasos de la Saga de venta, en orden. */
public enum PasoSaga {
  CREAR_VENTA, RESERVAR_STOCK, REGISTRAR_INGRESO, CONFIRMAR
}
