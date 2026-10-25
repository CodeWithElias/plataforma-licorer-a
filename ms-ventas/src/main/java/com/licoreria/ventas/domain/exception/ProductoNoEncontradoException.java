package com.licoreria.ventas.domain.exception;

/** Un producto de la venta no existe en el catálogo. */
public class ProductoNoEncontradoException extends DominioException {

  public ProductoNoEncontradoException(String mensaje) {
    super(mensaje);
  }

  @Override
  public String codigo() {
    return "PRODUCTO_NO_ENCONTRADO";
  }
}
