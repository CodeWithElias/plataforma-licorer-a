package com.licoreria.ventas.application.port.out;

/**
 * Token propio de ms-ventas (cliente ms-ventas de Keycloak, rol CAJERO). Lo usa la tarea que reintenta
 * compensaciones, porque ya no tiene el token del cajero que hizo la venta.
 */
public interface TokenServicioPort {

  String token();
}
