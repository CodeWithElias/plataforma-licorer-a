package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "pago")
public class PagoEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @OneToOne(optional = false)
  @JoinColumn(name = "venta_id")
  VentaEntity venta;

  @Column(nullable = false)
  String metodo;

  @Column(nullable = false)
  BigDecimal monto;

  @Column(nullable = false)
  String estado;
}
