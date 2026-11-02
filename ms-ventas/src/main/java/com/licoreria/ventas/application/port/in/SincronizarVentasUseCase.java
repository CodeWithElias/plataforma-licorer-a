package com.licoreria.ventas.application.port.in;

import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.LineaPedida;
import com.licoreria.ventas.domain.model.Venta;
import java.time.OffsetDateTime;
import java.util.List;

/** CU03 – Sincronizar las ventas que el POS hizo sin internet (puerto de entrada). */
public interface SincronizarVentasUseCase {

  /** Una venta de la cola offline tal como llega; se valida aquí para que un ítem malo no tumbe el lote. */
  record VentaOffline(String operationId, List<LineaPedida> items, String metodo, OffsetDateTime fechaLocal) {}

  enum Resultado { OK, DUPLICADO, ERROR }

  /**
   * @param motivo código del error (SIN_STOCK, DATOS_INVALIDOS…) o null
   * @param venta  la venta creada (OK) o la que ya existía (DUPLICADO); null si hubo ERROR antes de crearla
   */
  record ResultadoItem(String operationId, Resultado resultado, String motivo, String mensaje, Venta venta) {}

  /**
   * Procesa cada venta con la Saga, una por una y en orden, con origen OFFLINE.
   * Una venta cuyo operationId ya existe (o se repite en el lote) no se registra otra vez: queda DUPLICADO.
   */
  List<ResultadoItem> sincronizar(String cajeroId, List<VentaOffline> lote, String token);
}
