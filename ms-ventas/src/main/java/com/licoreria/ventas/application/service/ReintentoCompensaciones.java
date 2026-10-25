package com.licoreria.ventas.application.service;

import com.licoreria.ventas.application.port.out.SagaRepositoryPort;
import com.licoreria.ventas.application.port.out.TokenServicioPort;
import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.domain.saga.EstadoSaga;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Cada 30 s retoma las sagas que quedaron a medias: COMPENSANDO (falló una compensación, p. ej. ms-gestion
 * seguía caído) o EN_CURSO sin cambios hace más de 2 minutos (ms-ventas se cayó en medio de la Saga).
 * Usa el token propio de ms-ventas porque el del cajero ya no está disponible.
 */
@Service
public class ReintentoCompensaciones {

  private static final Logger log = LoggerFactory.getLogger(ReintentoCompensaciones.class);

  private final SagaRepositoryPort sagas;
  private final VentaRepositoryPort ventas;
  private final SagaOrquestador orquestador;
  private final TokenServicioPort tokenServicio;

  public ReintentoCompensaciones(SagaRepositoryPort sagas, VentaRepositoryPort ventas,
                                 SagaOrquestador orquestador, TokenServicioPort tokenServicio) {
    this.sagas = sagas;
    this.ventas = ventas;
    this.orquestador = orquestador;
    this.tokenServicio = tokenServicio;
  }

  @Scheduled(fixedDelayString = "${saga.reintento-ms:30000}", initialDelayString = "${saga.reintento-ms:30000}")
  public void reintentar() {
    var pendientes = sagas.pendientes(OffsetDateTime.now().minusMinutes(2));
    if (pendientes.isEmpty()) {
      return;
    }
    String token;
    try {
      token = tokenServicio.token();
    } catch (RuntimeException e) {
      log.warn("No se pudo obtener el token de servicio para reintentar {} sagas: {}", pendientes.size(), e.getMessage());
      return;
    }
    for (SagaInstancia saga : pendientes) {
      ventas.buscarPorId(saga.getVentaId()).ifPresent(venta -> {
        String motivo = saga.getEstado() == EstadoSaga.EN_CURSO ? "Saga interrumpida" : saga.getError();
        log.info("Reintentando compensación de la venta {} (saga {})", venta.getId(), saga.getEstado());
        orquestador.compensar(saga, venta, token, motivo);
      });
    }
  }
}
