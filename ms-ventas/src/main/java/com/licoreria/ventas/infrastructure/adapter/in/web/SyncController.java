package com.licoreria.ventas.infrastructure.adapter.in.web;

import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.LineaPedida;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase.VentaOffline;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.SyncResultado;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.VentaOfflineRequest;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** CU03 – Sincronización de la cola offline del POS. Rol CAJERO. El Idempotency-Key del lote es opcional. */
@RestController
@RequestMapping("/ventas/sync")
public class SyncController {

  private final SincronizarVentasUseCase sincronizar;

  public SyncController(SincronizarVentasUseCase sincronizar) {
    this.sincronizar = sincronizar;
  }

  /** Siempre 200 con un resultado por venta (OK, DUPLICADO o ERROR con motivo), en el mismo orden del lote. */
  @PostMapping
  public List<SyncResultado> sincronizar(@RequestBody List<VentaOfflineRequest> lote, @AuthenticationPrincipal Jwt jwt) {
    if (lote == null) {
      throw new DatosInvalidosException("El cuerpo debe ser una lista de ventas");
    }
    List<VentaOffline> ventas = lote.stream().map(SyncController::aVentaOffline).toList();
    return sincronizar.sincronizar(jwt.getSubject(), ventas, jwt.getTokenValue()).stream().map(SyncResultado::de).toList();
  }

  private static VentaOffline aVentaOffline(VentaOfflineRequest v) {
    if (v == null) {
      return new VentaOffline(null, null, null, null);
    }
    List<LineaPedida> items = v.items() == null ? null : v.items().stream()
        .map(i -> new LineaPedida(i.productoCodigo(), i.cantidad() == null ? 0 : i.cantidad()))
        .toList();
    return new VentaOffline(v.operationId(), items, v.pago() == null ? null : v.pago().metodo(), v.fechaLocal());
  }
}
