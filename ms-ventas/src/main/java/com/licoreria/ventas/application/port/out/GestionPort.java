package com.licoreria.ventas.application.port.out;

import com.licoreria.ventas.domain.model.Venta;
import java.util.UUID;

/** ms-gestion (contabilidad) visto desde la Saga. Idempotente por operationId. */
public interface GestionPort {

  /** Paso 3. @return id del ingreso */
  String registrarIngreso(Venta venta, String token);

  /** Compensación del paso 3 (si el ingreso no existe, no hace nada). */
  void anularIngreso(UUID operationId, String token);
}
