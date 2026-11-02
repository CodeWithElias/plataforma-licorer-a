package com.licoreria.ventas.infrastructure.adapter.in.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.domain.model.Venta;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Cuerpos JSON de la API (ver docs/openapi.yaml). */
final class VentaDtos {

  private VentaDtos() {}

  record ItemRequest(String productoCodigo, Integer cantidad) {}

  record PagoRequest(String metodo) {}

  record VentaRequest(List<ItemRequest> items, PagoRequest pago) {}

  /** Venta de la cola offline del POS (POST /ventas/sync). */
  record VentaOfflineRequest(String operationId, List<ItemRequest> items, PagoRequest pago, OffsetDateTime fechaLocal) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  record SyncResultado(String operationId, String resultado, String motivo, String mensaje,
                       UUID ventaId, Long numero, String estado) {
    static SyncResultado de(SincronizarVentasUseCase.ResultadoItem r) {
      Venta v = r.venta();
      return new SyncResultado(r.operationId(), r.resultado().name(), r.motivo(), r.mensaje(),
          v == null ? null : v.getId(), v == null ? null : v.getNumero(), v == null ? null : v.getEstado().name());
    }
  }

  record VentaCreada(UUID id, Long numero, BigDecimal total, String estado) {
    static VentaCreada de(Venta v) {
      return new VentaCreada(v.getId(), v.getNumero(), v.total(), v.getEstado().name());
    }
  }

  record DetalleItem(String productoCodigo, String productoNombre, int cantidad, BigDecimal precioUnitario, BigDecimal subtotal) {
    static DetalleItem de(DetalleVenta d) {
      return new DetalleItem(d.productoCodigo(), d.productoNombre(), d.cantidad(), d.precioUnitario(), d.subtotal());
    }
  }

  record VentaResumen(Long numero, OffsetDateTime fecha, BigDecimal total, List<DetalleItem> items) {
    static VentaResumen de(Venta v) {
      return new VentaResumen(v.getNumero(), v.getFecha(), v.total(), v.getItems().stream().map(DetalleItem::de).toList());
    }
  }

  record PagoDetalle(String metodo, BigDecimal monto, String estado) {}

  record SagaDetalle(String pasoActual, String estado, String reservaId, String ingresoId, String error) {
    static SagaDetalle de(SagaInstancia s) {
      return new SagaDetalle(s.getPasoActual().name(), s.getEstado().name(), s.getReservaId(), s.getIngresoId(), s.getError());
    }
  }

  record VentaDetalle(UUID id, Long numero, UUID operationId, String cajeroId, OffsetDateTime fecha, BigDecimal total,
                      String estado, String origen, List<DetalleItem> items, PagoDetalle pago, SagaDetalle saga) {
    static VentaDetalle de(Venta v, Optional<SagaInstancia> saga) {
      return new VentaDetalle(v.getId(), v.getNumero(), v.getOperationId(), v.getCajeroId(), v.getFecha(), v.total(),
          v.getEstado().name(), v.getOrigen().name(), v.getItems().stream().map(DetalleItem::de).toList(),
          new PagoDetalle(v.getPago().getMetodo().name(), v.getPago().getMonto(), v.getPago().getEstado().name()),
          saga.map(SagaDetalle::de).orElse(null));
    }
  }
}
