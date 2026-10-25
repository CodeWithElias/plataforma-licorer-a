package com.licoreria.ventas.domain.saga;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Estado persistido de la Saga de una venta. Se guarda después de cada paso para saber,
 * aunque el servicio se caiga, qué se hizo y qué hay que compensar.
 */
public final class SagaInstancia {

  private final UUID id;
  private final UUID ventaId;
  private PasoSaga pasoActual;
  private EstadoSaga estado;
  private String reservaId;
  private String ingresoId;
  private String error;
  private final OffsetDateTime creadoEn;
  private OffsetDateTime actualizadoEn;

  public SagaInstancia(UUID id, UUID ventaId, PasoSaga pasoActual, EstadoSaga estado, String reservaId,
                       String ingresoId, String error, OffsetDateTime creadoEn, OffsetDateTime actualizadoEn) {
    this.id = id;
    this.ventaId = ventaId;
    this.pasoActual = pasoActual;
    this.estado = estado;
    this.reservaId = reservaId;
    this.ingresoId = ingresoId;
    this.error = error;
    this.creadoEn = creadoEn;
    this.actualizadoEn = actualizadoEn;
  }

  public static SagaInstancia iniciar(UUID ventaId, OffsetDateTime ahora) {
    return new SagaInstancia(UUID.randomUUID(), ventaId, PasoSaga.CREAR_VENTA, EstadoSaga.EN_CURSO,
        null, null, null, ahora, ahora);
  }

  public void avanzar(PasoSaga paso) {
    pasoActual = paso;
    tocar();
  }

  public void completar() {
    estado = EstadoSaga.COMPLETADA;
    tocar();
  }

  public void compensando(String motivo) {
    estado = EstadoSaga.COMPENSANDO;
    error = motivo;
    tocar();
  }

  public void compensada() {
    estado = EstadoSaga.COMPENSADA;
    tocar();
  }

  public void ingresoAnulado() {
    ingresoId = null;
    tocar();
  }

  public void reservaLiberada() {
    reservaId = null;
    tocar();
  }

  public void setReservaId(String reservaId) {
    this.reservaId = reservaId;
    tocar();
  }

  public void setIngresoId(String ingresoId) {
    this.ingresoId = ingresoId;
    tocar();
  }

  public boolean pendienteDeCompensar() {
    return estado == EstadoSaga.COMPENSANDO;
  }

  private void tocar() {
    actualizadoEn = OffsetDateTime.now();
  }

  public UUID getId() { return id; }
  public UUID getVentaId() { return ventaId; }
  public PasoSaga getPasoActual() { return pasoActual; }
  public EstadoSaga getEstado() { return estado; }
  public String getReservaId() { return reservaId; }
  public String getIngresoId() { return ingresoId; }
  public String getError() { return error; }
  public OffsetDateTime getCreadoEn() { return creadoEn; }
  public OffsetDateTime getActualizadoEn() { return actualizadoEn; }
}
