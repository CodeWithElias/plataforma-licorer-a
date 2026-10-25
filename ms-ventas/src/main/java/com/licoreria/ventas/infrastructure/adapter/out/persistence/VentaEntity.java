package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.Generated;

/** Tabla venta (db/V1__ventas.sql). Separada del modelo de dominio. */
@Entity
@Table(name = "venta")
public class VentaEntity {

  @Id
  UUID id;

  @Generated   // BIGSERIAL: lo asigna PostgreSQL al insertar
  @Column(insertable = false, updatable = false)
  Long numero;

  @Column(name = "operation_id", nullable = false, unique = true)
  UUID operationId;

  @Column(name = "cajero_id", nullable = false)
  String cajeroId;

  @Column(nullable = false)
  OffsetDateTime fecha;

  @Column(nullable = false)
  BigDecimal total;

  @Column(nullable = false)
  String estado;

  @Column(nullable = false)
  String origen;

  @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
  List<DetalleVentaEntity> detalles = new ArrayList<>();

  @OneToOne(mappedBy = "venta", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
  PagoEntity pago;
}
