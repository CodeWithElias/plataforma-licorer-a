package com.licoreria.ventas.application.service;

import com.licoreria.ventas.application.port.in.ConsultarVentasUseCase;
import com.licoreria.ventas.application.port.out.SagaRepositoryPort;
import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.domain.exception.VentaNoEncontradaException;
import com.licoreria.ventas.domain.model.Venta;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ConsultarVentasService implements ConsultarVentasUseCase {

  private final VentaRepositoryPort ventas;
  private final SagaRepositoryPort sagas;

  public ConsultarVentasService(VentaRepositoryPort ventas, SagaRepositoryPort sagas) {
    this.ventas = ventas;
    this.sagas = sagas;
  }

  @Override
  public VentaConSaga obtener(UUID id) {
    Venta venta = ventas.buscarPorId(id).orElseThrow(() -> new VentaNoEncontradaException("No existe la venta " + id));
    return new VentaConSaga(venta, sagas.buscarPorVenta(id));
  }

  @Override
  public List<Venta> completadasEntre(OffsetDateTime desde, OffsetDateTime hasta) {
    if (desde == null || hasta == null) {
      throw new DatosInvalidosException("Los parámetros desde y hasta son obligatorios (fechas ISO 8601)");
    }
    if (!desde.isBefore(hasta)) {
      throw new DatosInvalidosException("desde debe ser anterior a hasta");
    }
    return ventas.completadasEntre(desde, hasta);
  }
}
