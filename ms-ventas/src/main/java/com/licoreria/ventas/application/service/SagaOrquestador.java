package com.licoreria.ventas.application.service;

import com.licoreria.ventas.application.port.out.GestionPort;
import com.licoreria.ventas.application.port.out.InventarioPort;
import com.licoreria.ventas.application.port.out.SagaRepositoryPort;
import com.licoreria.ventas.application.port.out.VentaRepositoryPort;
import com.licoreria.ventas.domain.exception.ProductoNoEncontradoException;
import com.licoreria.ventas.domain.exception.SagaCompensadaException;
import com.licoreria.ventas.domain.exception.SinStockException;
import com.licoreria.ventas.domain.model.EstadoVenta;
import com.licoreria.ventas.domain.model.Venta;
import com.licoreria.ventas.domain.saga.PasoSaga;
import com.licoreria.ventas.domain.saga.SagaInstancia;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Saga orquestada de CU02. Pasos: 1) venta PENDIENTE + pago simulado → 2) reservar stock (ms-inventario)
 * → 3) registrar ingreso (ms-gestion) → 4) confirmar reserva y venta COMPLETADA.
 * Si un paso falla, compensa en orden inverso. El estado se guarda en saga_instancia después de cada paso.
 * Solo conoce los puertos InventarioPort y GestionPort: no sabe que uno es REST y el otro GraphQL.
 */
@Service
public class SagaOrquestador {

  private static final Logger log = LoggerFactory.getLogger(SagaOrquestador.class);

  private final VentaRepositoryPort ventas;
  private final SagaRepositoryPort sagas;
  private final InventarioPort inventario;
  private final GestionPort gestion;

  public SagaOrquestador(VentaRepositoryPort ventas, SagaRepositoryPort sagas, InventarioPort inventario, GestionPort gestion) {
    this.ventas = ventas;
    this.sagas = sagas;
    this.inventario = inventario;
    this.gestion = gestion;
  }

  public Venta ejecutar(Venta venta, String token) {
    // 1. Venta PENDIENTE + pago simulado APROBADO (transacción local)
    venta = ventas.guardar(venta);
    SagaInstancia saga = SagaInstancia.iniciar(venta.getId(), OffsetDateTime.now());
    sagas.guardar(saga);

    try {
      // 2. Reservar stock. El reservaId es el operationId: se anota antes de llamar para poder liberarla
      //    aunque la respuesta se pierda.
      saga.avanzar(PasoSaga.RESERVAR_STOCK);
      saga.setReservaId(venta.getOperationId().toString());
      sagas.guardar(saga);
      inventario.reservar(venta.getOperationId(), venta.getItems(), token);

      // 3. Registrar el ingreso (GraphQL)
      saga.avanzar(PasoSaga.REGISTRAR_INGRESO);
      sagas.guardar(saga);
      saga.setIngresoId(gestion.registrarIngreso(venta, token));

      // 4. Confirmar la reserva y completar la venta
      saga.avanzar(PasoSaga.CONFIRMAR);
      sagas.guardar(saga);
      inventario.confirmar(venta.getOperationId(), token);
      venta.completar();
      venta = ventas.guardar(venta);
      saga.completar();
      sagas.guardar(saga);
      return venta;

    } catch (SinStockException | ProductoNoEncontradoException e) {
      compensar(saga, venta, token, e.getMessage());
      throw e instanceof SinStockException s ? s.deVenta(venta.getId()) : e;   // 409 / 404 al cliente
    } catch (RuntimeException e) {
      log.warn("Saga de la venta {} falló en {}: {}", venta.getId(), saga.getPasoActual(), e.getMessage());
      compensar(saga, venta, token, e.getMessage());
      throw new SagaCompensadaException(venta.getId(), mensajeDeFalla(saga.getPasoActual()), e);   // 502 al cliente
    }
  }

  /**
   * Compensa en orden inverso según el paso al que llegó la Saga: anula el ingreso, libera la reserva y
   * cancela la venta (pago REEMBOLSADO). Las compensaciones son independientes e idempotentes (por operationId):
   * si una falla (p. ej. ms-gestion sigue caído) las demás se hacen igual, la saga queda COMPENSANDO y la tarea
   * ReintentoCompensaciones repite lo pendiente cada 30 s hasta dejarla COMPENSADA.
   */
  public void compensar(SagaInstancia saga, Venta venta, String token, String motivo) {
    saga.compensando(motivo);
    sagas.guardar(saga);
    List<String> pendientes = new ArrayList<>();
    PasoSaga paso = saga.getPasoActual();

    if (paso.compareTo(PasoSaga.REGISTRAR_INGRESO) >= 0) {
      try {
        gestion.anularIngreso(venta.getOperationId(), token);
        saga.ingresoAnulado();
      } catch (RuntimeException e) {
        pendientes.add("anular ingreso (" + e.getMessage() + ")");
      }
    }
    if (paso.compareTo(PasoSaga.RESERVAR_STOCK) >= 0 && saga.getReservaId() != null) {
      try {
        inventario.liberar(venta.getOperationId(), token);
        saga.reservaLiberada();
      } catch (RuntimeException e) {
        pendientes.add("liberar reserva (" + e.getMessage() + ")");
      }
    }
    if (venta.getEstado() == EstadoVenta.PENDIENTE) {
      venta.cancelar();   // también marca el pago REEMBOLSADO
      ventas.guardar(venta);
    }

    if (pendientes.isEmpty()) {
      saga.compensada();
    } else {
      log.error("Compensación pendiente de la venta {}: {}", venta.getId(), pendientes);
      saga.compensando(motivo + " | pendiente: " + String.join("; ", pendientes));
    }
    sagas.guardar(saga);
  }

  private static String mensajeDeFalla(PasoSaga paso) {
    return switch (paso) {
      case CREAR_VENTA, RESERVAR_STOCK -> "No se pudo reservar el stock; venta revertida";
      case REGISTRAR_INGRESO -> "No se pudo registrar el ingreso; venta revertida";
      case CONFIRMAR -> "No se pudo confirmar la venta; venta revertida";
    };
  }
}
