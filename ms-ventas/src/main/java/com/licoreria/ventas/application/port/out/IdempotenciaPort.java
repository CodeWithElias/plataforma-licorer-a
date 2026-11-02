package com.licoreria.ventas.application.port.out;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Tabla idempotency_keys: la respuesta que ya se dio a cada Idempotency-Key.
 * Una clave se reserva antes de ejecutar (estadoHttp = 0, en proceso) y se completa con la respuesta al terminar.
 */
public interface IdempotenciaPort {

  record Registro(String endpoint, int estadoHttp, String cuerpo, OffsetDateTime creadoEn) {
    public boolean enProceso() {
      return estadoHttp == 0;
    }
  }

  /** @return true si este pedido reservó la clave; false si ya existía */
  boolean reservar(UUID clave, String endpoint);

  Optional<Registro> buscar(UUID clave);

  /** Vuelve a tomar una clave que quedó en proceso (p. ej. el servicio se reinició a mitad de la Saga). */
  void retomar(UUID clave);

  /** Guarda la respuesta que se devolverá igual si la clave se repite. */
  void guardar(UUID clave, int estadoHttp, String cuerpo);

  /** Borra la reserva cuando no hubo venta (datos inválidos, error inesperado) para que se pueda reintentar. */
  void liberar(UUID clave);
}
