package com.licoreria.ventas.application.port.in;

import com.licoreria.ventas.domain.model.MetodoPago;
import com.licoreria.ventas.domain.model.OrigenVenta;
import com.licoreria.ventas.domain.model.Venta;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** CU02 – Registrar venta (puerto de entrada). */
public interface RegistrarVentaUseCase {

  record LineaPedida(String productoCodigo, int cantidad) {}

  /** @param fechaLocal cuándo se hizo la venta en el cliente (ventas offline); null = ahora */
  record Comando(UUID operationId, String cajeroId, List<LineaPedida> items, MetodoPago metodo, OrigenVenta origen,
                 OffsetDateTime fechaLocal) {}

  /** @param nueva false si ya existía una venta con ese operationId (no se ejecutó nada) */
  record Resultado(Venta venta, boolean nueva) {}

  /**
   * Ejecuta la Saga: venta PENDIENTE → reserva de stock → ingreso → confirmación.
   *
   * @param token token del cajero; se reenvía a ms-inventario y ms-gestion
   */
  Resultado registrar(Comando comando, String token);
}
