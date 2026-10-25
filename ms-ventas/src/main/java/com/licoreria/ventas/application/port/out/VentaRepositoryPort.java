package com.licoreria.ventas.application.port.out;

import com.licoreria.ventas.domain.model.Venta;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VentaRepositoryPort {

  /** Inserta o actualiza la venta; al insertarla le asigna su número correlativo. */
  Venta guardar(Venta venta);

  Optional<Venta> buscarPorId(UUID id);

  Optional<Venta> buscarPorOperationId(UUID operationId);

  List<Venta> completadasEntre(OffsetDateTime desde, OffsetDateTime hasta);
}
