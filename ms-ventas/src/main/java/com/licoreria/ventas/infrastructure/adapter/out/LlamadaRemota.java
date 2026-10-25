package com.licoreria.ventas.infrastructure.adapter.out;

import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.ResourceAccessException;

/**
 * Reintentos de las llamadas a otros servicios: 1 intento + 2 reintentos con espera (300 ms y 900 ms).
 * Solo se reintenta lo transitorio (timeout, conexión rechazada, 5xx). Es seguro porque ms-inventario
 * y ms-gestion no repiten una operación con el mismo operationId.
 */
public final class LlamadaRemota {

  /** Error que vale la pena reintentar (5xx). */
  public static class ErrorTransitorio extends RuntimeException {
    public ErrorTransitorio(String mensaje) {
      super(mensaje);
    }
  }

  private static final Logger log = LoggerFactory.getLogger(LlamadaRemota.class);
  private static final long[] ESPERAS_MS = {300, 900};

  private LlamadaRemota() {}

  public static <T> T conReintentos(String nombre, Supplier<T> llamada) {
    RuntimeException ultimo = null;
    for (int intento = 0; intento <= ESPERAS_MS.length; intento++) {
      try {
        return llamada.get();
      } catch (ResourceAccessException | ErrorTransitorio e) {
        ultimo = e;
        if (intento < ESPERAS_MS.length) {
          log.warn("{} falló (intento {}): {}. Reintentando…", nombre, intento + 1, e.getMessage());
          dormir(ESPERAS_MS[intento]);
        }
      }
    }
    throw new ServicioRemotoException(nombre + " no respondió: " + ultimo.getMessage(), ultimo);
  }

  public static void conReintentos(String nombre, Runnable llamada) {
    conReintentos(nombre, () -> {
      llamada.run();
      return null;
    });
  }

  private static void dormir(long ms) {
    try {
      Thread.sleep(ms);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
