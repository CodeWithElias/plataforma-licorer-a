package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import com.licoreria.ventas.application.port.out.SagaRepositoryPort;
import com.licoreria.ventas.domain.saga.EstadoSaga;
import com.licoreria.ventas.domain.saga.PasoSaga;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Adaptador de salida: tabla saga_instancia. */
@Component
public class JpaSagaAdapter implements SagaRepositoryPort {

  private final SagaJpaRepository repo;

  public JpaSagaAdapter(SagaJpaRepository repo) {
    this.repo = repo;
  }

  @Override
  @Transactional
  public void guardar(SagaInstancia s) {
    SagaInstanciaEntity e = repo.findById(s.getId()).orElseGet(SagaInstanciaEntity::new);
    e.id = s.getId();
    e.ventaId = s.getVentaId();
    e.pasoActual = s.getPasoActual().name();
    e.estado = s.getEstado().name();
    e.reservaId = s.getReservaId();
    e.ingresoId = s.getIngresoId();
    e.error = s.getError();
    e.creadoEn = s.getCreadoEn();
    e.actualizadoEn = s.getActualizadoEn();
    repo.save(e);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<SagaInstancia> buscarPorVenta(UUID ventaId) {
    return repo.findFirstByVentaIdOrderByCreadoEnDesc(ventaId).map(JpaSagaAdapter::aDominio);
  }

  @Override
  @Transactional(readOnly = true)
  public List<SagaInstancia> pendientes(OffsetDateTime enCursoSinCambiosDesde) {
    return repo.pendientes(enCursoSinCambiosDesde).stream().map(JpaSagaAdapter::aDominio).toList();
  }

  private static SagaInstancia aDominio(SagaInstanciaEntity e) {
    return new SagaInstancia(e.id, e.ventaId, PasoSaga.valueOf(e.pasoActual), EstadoSaga.valueOf(e.estado),
        e.reservaId, e.ingresoId, e.error, e.creadoEn, e.actualizadoEn);
  }
}
