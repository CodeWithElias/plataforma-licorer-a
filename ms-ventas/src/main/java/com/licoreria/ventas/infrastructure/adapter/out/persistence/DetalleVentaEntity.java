package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "detalle_venta")
public class DetalleVentaEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  Long id;

  @ManyToOne(optional = false)
  @JoinColumn(name = "venta_id")
  VentaEntity venta;

  @Column(name = "producto_codigo", nullable = false)
  String productoCodigo;

  @Column(name = "producto_nombre", nullable = false)
  String productoNombre;

  @Column(nullable = false)
  int cantidad;

  @Column(name = "precio_unitario", nullable = false)
  BigDecimal precioUnitario;

  @Column(nullable = false)
  BigDecimal subtotal;
}
