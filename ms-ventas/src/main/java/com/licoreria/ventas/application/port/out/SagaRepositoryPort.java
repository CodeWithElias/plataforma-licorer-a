package com.licoreria.ventas.application.port.out;

import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SagaRepositoryPort {

  void guardar(SagaInstancia saga);

  Optional<SagaInstancia> buscarPorVenta(UUID ventaId);

  /** Sagas COMPENSANDO, o EN_CURSO sin cambios desde antes de esa fecha (el servicio se cayó a mitad). */
  List<SagaInstancia> pendientes(OffsetDateTime enCursoSinCambiosDesde);
}
