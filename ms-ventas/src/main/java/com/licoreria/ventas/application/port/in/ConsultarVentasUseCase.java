package com.licoreria.ventas.application.port.in;

import com.licoreria.ventas.domain.model.Venta;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Consultas de ventas (puerto de entrada). */
public interface ConsultarVentasUseCase {

  record VentaConSaga(Venta venta, Optional<SagaInstancia> saga) {}

  VentaConSaga obtener(UUID id);

  /** Ventas COMPLETADAS con fecha en [desde, hasta). */
  List<Venta> completadasEntre(OffsetDateTime desde, OffsetDateTime hasta);
}
