package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.domain.model.EstadoVenta;
import com.licoreria.ventas.domain.model.MetodoPago;
import com.licoreria.ventas.domain.model.OrigenVenta;
import com.licoreria.ventas.domain.model.Pago;
import com.licoreria.ventas.domain.model.Venta;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Adaptador de salida: guarda el agregado Venta en PostgreSQL (venta, detalle_venta, pago). */
@Component
public class JpaVentaAdapter implements VentaRepositoryPort {

  private final VentaJpaRepository repo;
  private final EntityManager em;

  public JpaVentaAdapter(VentaJpaRepository repo, EntityManager em) {
    this.repo = repo;
    this.em = em;
  }

  @Override
  @Transactional
  public Venta guardar(Venta venta) {
    VentaEntity e = repo.findById(venta.getId()).orElse(null);
    if (e == null) {
      e = aEntidad(venta);
      em.persist(e);
      em.flush();   // PostgreSQL asigna el número (BIGSERIAL)
      em.refresh(e);
    } else {
      // Después de crearla solo cambian los estados de la venta y del pago
      e.estado = venta.getEstado().name();
      e.pago.estado = venta.getPago().getEstado().name();
    }
    venta.asignarNumero(e.numero);
    return venta;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Venta> buscarPorId(UUID id) {
    return repo.findById(id).map(JpaVentaAdapter::aDominio);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Venta> buscarPorOperationId(UUID operationId) {
    return repo.findByOperationId(operationId).map(JpaVentaAdapter::aDominio);
  }

  @Override
  @Transactional(readOnly = true)
  public List<Venta> completadasEntre(OffsetDateTime desde, OffsetDateTime hasta) {
    return repo.findByEstadoAndFechaGreaterThanEqualAndFechaLessThanOrderByFechaAsc(EstadoVenta.COMPLETADA.name(), desde, hasta)
        .stream().map(JpaVentaAdapter::aDominio).toList();
  }

  private static VentaEntity aEntidad(Venta v) {
    VentaEntity e = new VentaEntity();
    e.id = v.getId();
    e.operationId = v.getOperationId();
    e.cajeroId = v.getCajeroId();
    e.fecha = v.getFecha();
    e.total = v.total();
    e.estado = v.getEstado().name();
    e.origen = v.getOrigen().name();
    for (DetalleVenta d : v.getItems()) {
      DetalleVentaEntity de = new DetalleVentaEntity();
      de.venta = e;
      de.productoCodigo = d.productoCodigo();
      de.productoNombre = d.productoNombre();
      de.cantidad = d.cantidad();
      de.precioUnitario = d.precioUnitario();
      de.subtotal = d.subtotal();
      e.detalles.add(de);
    }
    PagoEntity p = new PagoEntity();
    p.venta = e;
    p.metodo = v.getPago().getMetodo().name();
    p.monto = v.getPago().getMonto();
    p.estado = v.getPago().getEstado().name();
    e.pago = p;
    return e;
  }

  private static Venta aDominio(VentaEntity e) {
    List<DetalleVenta> items = e.detalles.stream()
        .sorted((a, b) -> Long.compare(a.id, b.id))
        .map(d -> new DetalleVenta(d.productoCodigo, d.productoNombre, d.cantidad, d.precioUnitario))
        .toList();
    Pago pago = new Pago(MetodoPago.valueOf(e.pago.metodo), e.pago.monto, Pago.Estado.valueOf(e.pago.estado));
    return new Venta(e.id, e.numero, e.operationId, e.cajeroId, e.fecha, items, pago,
        EstadoVenta.valueOf(e.estado), OrigenVenta.valueOf(e.origen));
  }
}
