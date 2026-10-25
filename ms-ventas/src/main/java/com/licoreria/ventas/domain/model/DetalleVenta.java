package com.licoreria.ventas.domain.model;

import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Línea de la venta. Nombre y precio se copian del catálogo al momento de vender.
 */
public record DetalleVenta(String productoCodigo, String productoNombre, int cantidad, BigDecimal precioUnitario) {

  public DetalleVenta {
    if (productoCodigo == null || productoCodigo.isBlank()) {
      throw new DatosInvalidosException("productoCodigo es obligatorio");
    }
    if (cantidad < 1) {
      throw new DatosInvalidosException("La cantidad de " + productoCodigo + " debe ser al menos 1");
    }
    if (precioUnitario == null || precioUnitario.signum() < 0) {
      throw new DatosInvalidosException("Precio inválido para " + productoCodigo);
    }
    precioUnitario = precioUnitario.setScale(2, RoundingMode.HALF_UP);
  }

  public BigDecimal subtotal() {
    return precioUnitario.multiply(BigDecimal.valueOf(cantidad)).setScale(2, RoundingMode.HALF_UP);
  }
}
