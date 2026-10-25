package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "saga_instancia")
public class SagaInstanciaEntity {

  @Id
  UUID id;

  @Column(name = "venta_id", nullable = false)
  UUID ventaId;

  @Column(name = "paso_actual", nullable = false)
  String pasoActual;

  @Column(nullable = false)
  String estado;

  @Column(name = "reserva_id")
  String reservaId;

  @Column(name = "ingreso_id")
  String ingresoId;

  String error;

  @Column(name = "creado_en", nullable = false)
  OffsetDateTime creadoEn;

  @Column(name = "actualizado_en", nullable = false)
  OffsetDateTime actualizadoEn;
}
