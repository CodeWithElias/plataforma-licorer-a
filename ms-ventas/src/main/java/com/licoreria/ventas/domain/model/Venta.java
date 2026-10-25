package com.licoreria.ventas.domain.model;

import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Agregado Venta. Regla de cálculo: total = suma de subtotales (cantidad × precio unitario).
 * Estados: PENDIENTE → COMPLETADA (Saga terminada) o PENDIENTE → CANCELADA (Saga compensada, pago reembolsado).
 * Sin anotaciones de Spring ni JPA: es el centro del hexágono.
 */
public final class Venta {

  private final UUID id;
  private Long numero;
  private final UUID operationId;
  private final String cajeroId;
  private final OffsetDateTime fecha;
  private final List<DetalleVenta> items;
  private final Pago pago;
  private EstadoVenta estado;
  private final OrigenVenta origen;

  public Venta(UUID id, Long numero, UUID operationId, String cajeroId, OffsetDateTime fecha,
               List<DetalleVenta> items, Pago pago, EstadoVenta estado, OrigenVenta origen) {
    this.id = id;
    this.numero = numero;
    this.operationId = operationId;
    this.cajeroId = cajeroId;
    this.fecha = fecha;
    this.items = List.copyOf(items);
    this.pago = pago;
    this.estado = estado;
    this.origen = origen;
  }

  /** Venta nueva PENDIENTE con el pago simulado ya APROBADO (paso 1 de la Saga). */
  public static Venta nueva(UUID operationId, String cajeroId, List<DetalleVenta> items, MetodoPago metodo,
                            OrigenVenta origen, OffsetDateTime ahora) {
    if (operationId == null) {
      throw new DatosInvalidosException("operationId es obligatorio");
    }
    if (items == null || items.isEmpty()) {
      throw new DatosInvalidosException("items debe tener al menos un elemento");
    }
    if (metodo == null) {
      throw new DatosInvalidosException("pago.metodo es obligatorio (EFECTIVO, TARJETA o QR)");
    }
    BigDecimal total = items.stream().map(DetalleVenta::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    return new Venta(UUID.randomUUID(), null, operationId, cajeroId, ahora, items,
        Pago.aprobado(metodo, total), EstadoVenta.PENDIENTE, origen);
  }

  public BigDecimal total() {
    return items.stream().map(DetalleVenta::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  public void completar() {
    if (estado != EstadoVenta.PENDIENTE) {
      throw new IllegalStateException("Solo una venta PENDIENTE se puede completar (está " + estado + ")");
    }
    estado = EstadoVenta.COMPLETADA;
  }

  /** Compensación del paso 1: la venta queda CANCELADA y el pago REEMBOLSADO. */
  public void cancelar() {
    if (estado == EstadoVenta.COMPLETADA) {
      throw new IllegalStateException("Una venta COMPLETADA no se puede cancelar");
    }
    estado = EstadoVenta.CANCELADA;
    pago.reembolsar();
  }

  public void asignarNumero(Long numero) {
    this.numero = numero;
  }

  public UUID getId() { return id; }
  public Long getNumero() { return numero; }
  public UUID getOperationId() { return operationId; }
  public String getCajeroId() { return cajeroId; }
  public OffsetDateTime getFecha() { return fecha; }
  public List<DetalleVenta> getItems() { return items; }
  public Pago getPago() { return pago; }
  public EstadoVenta getEstado() { return estado; }
  public OrigenVenta getOrigen() { return origen; }
}
