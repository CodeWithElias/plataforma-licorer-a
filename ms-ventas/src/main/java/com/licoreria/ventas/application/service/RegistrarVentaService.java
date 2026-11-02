package com.licoreria.ventas.application.service;

import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase;
import com.licoreria.ventas.application.port.out.InventarioPort;
import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.domain.model.Venta;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class RegistrarVentaService implements RegistrarVentaUseCase {

  private final VentaRepositoryPort ventas;
  private final InventarioPort inventario;
  private final SagaOrquestador saga;

  public RegistrarVentaService(VentaRepositoryPort ventas, InventarioPort inventario, SagaOrquestador saga) {
    this.ventas = ventas;
    this.inventario = inventario;
    this.saga = saga;
  }

  @Override
  public Resultado registrar(Comando comando, String token) {
    // Si el mismo operationId ya se procesó, no se ejecuta nada otra vez. IdempotencyFilter ya devuelve la respuesta
    // guardada para un Idempotency-Key repetido; esto cubre las ventas de /ventas/sync y los reintentos sin encabezado.
    Optional<Venta> existente = ventas.buscarPorOperationId(comando.operationId());
    if (existente.isPresent()) {
      return new Resultado(existente.get(), false);
    }

    // Nombre y precio los pone el servidor con el catálogo de ms-inventario; el cliente solo manda códigos
    List<DetalleVenta> detalles = new ArrayList<>();
    for (Map.Entry<String, Integer> linea : unirLineas(comando.items()).entrySet()) {
      InventarioPort.ProductoCatalogo p = inventario.obtenerProducto(linea.getKey(), token);
      detalles.add(new DetalleVenta(p.codigo(), p.nombre(), linea.getValue(), p.precio()));
    }

    Venta venta = Venta.nueva(comando.operationId(), comando.cajeroId(), detalles, comando.metodo(),
        comando.origen(), fecha(comando.fechaLocal()));
    return new Resultado(saga.ejecutar(venta, token), true);
  }

  /** Una venta offline conserva la hora en que se hizo; una fecha futura (reloj del cliente adelantado) no se acepta. */
  private static OffsetDateTime fecha(OffsetDateTime fechaLocal) {
    OffsetDateTime ahora = OffsetDateTime.now();
    return fechaLocal == null || fechaLocal.isAfter(ahora) ? ahora : fechaLocal;
  }

  /** Une productos repetidos sumando cantidades. */
  private static Map<String, Integer> unirLineas(List<LineaPedida> items) {
    if (items == null || items.isEmpty()) {
      throw new DatosInvalidosException("items debe tener al menos un elemento");
    }
    Map<String, Integer> lineas = new LinkedHashMap<>();
    for (LineaPedida i : items) {
      if (i.productoCodigo() == null || i.productoCodigo().isBlank()) {
        throw new DatosInvalidosException("productoCodigo es obligatorio");
      }
      if (i.cantidad() < 1) {
        throw new DatosInvalidosException("La cantidad de " + i.productoCodigo() + " debe ser al menos 1");
      }
      lineas.merge(i.productoCodigo().trim().toUpperCase(), i.cantidad(), Integer::sum);
    }
    return lineas;
  }
}
