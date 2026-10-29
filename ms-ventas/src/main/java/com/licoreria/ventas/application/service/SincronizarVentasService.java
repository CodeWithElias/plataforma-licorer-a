package com.licoreria.ventas.application.service;

import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.Comando;
import com.licoreria.ventas.application.port.in.SincronizarVentasUseCase;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.domain.exception.DominioException;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import com.licoreria.ventas.domain.model.MetodoPago;
import com.licoreria.ventas.domain.model.OrigenVenta;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class SincronizarVentasService implements SincronizarVentasUseCase {

  /** Un lote grande retiene al cajero mucho tiempo (cada venta es una Saga de ~1 s); el POS lo parte en varios. */
  public static final int MAX_LOTE = 50;

  private final RegistrarVentaUseCase registrar;

  public SincronizarVentasService(RegistrarVentaUseCase registrar) {
    this.registrar = registrar;
  }

  @Override
  public List<ResultadoItem> sincronizar(String cajeroId, List<VentaOffline> lote, String token) {
    if (lote == null || lote.isEmpty()) {
      throw new DatosInvalidosException("El lote debe tener al menos una venta");
    }
    if (lote.size() > MAX_LOTE) {
      throw new DatosInvalidosException("El lote admite como máximo " + MAX_LOTE + " ventas");
    }

    Set<UUID> vistos = new HashSet<>();
    List<ResultadoItem> resultados = new ArrayList<>();
    for (VentaOffline v : lote) {
      UUID operationId;
      try {
        operationId = UUID.fromString(String.valueOf(v.operationId()).trim());
      } catch (IllegalArgumentException e) {
        resultados.add(error(v.operationId(), "DATOS_INVALIDOS", "operationId debe ser un UUID"));
        continue;
      }
      if (!vistos.add(operationId)) {
        resultados.add(new ResultadoItem(v.operationId(), Resultado.DUPLICADO, null, "Repetida en el mismo lote", null));
        continue;
      }
      resultados.add(procesar(operationId, cajeroId, v, token));
    }
    return resultados;
  }

  private ResultadoItem procesar(UUID operationId, String cajeroId, VentaOffline v, String token) {
    String id = operationId.toString();
    try {
      Comando comando = new Comando(operationId, cajeroId, v.items(), metodo(v.metodo()), OrigenVenta.OFFLINE, v.fechaLocal());
      RegistrarVentaUseCase.Resultado r = registrar.registrar(comando, token);
      return r.nueva()
          ? new ResultadoItem(id, Resultado.OK, null, null, r.venta())
          : new ResultadoItem(id, Resultado.DUPLICADO, null, "Ya se había registrado", r.venta());
    } catch (DominioException e) {
      return error(id, e.codigo(), e.getMessage());   // SIN_STOCK, PRODUCTO_NO_ENCONTRADO, SAGA_COMPENSADA…
    } catch (ServicioRemotoException e) {
      return error(id, "ERROR_INTERNO", e.getMessage());   // mismo código que POST /ventas
    }
  }

  private static ResultadoItem error(String operationId, String motivo, String mensaje) {
    return new ResultadoItem(operationId, Resultado.ERROR, motivo, mensaje, null);
  }

  private static MetodoPago metodo(String valor) {
    if (valor == null) {
      throw new DatosInvalidosException("pago.metodo es obligatorio (EFECTIVO, TARJETA o QR)");
    }
    try {
      return MetodoPago.valueOf(valor.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new DatosInvalidosException("pago.metodo debe ser EFECTIVO, TARJETA o QR");
    }
  }
}
