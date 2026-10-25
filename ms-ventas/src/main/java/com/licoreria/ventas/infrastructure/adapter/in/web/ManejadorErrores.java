package com.licoreria.ventas.infrastructure.adapter.in.web;

import com.licoreria.ventas.domain.exception.DominioException;
import com.licoreria.ventas.domain.exception.ProductoNoEncontradoException;
import com.licoreria.ventas.domain.exception.SagaCompensadaException;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import com.licoreria.ventas.domain.exception.SinStockException;
import com.licoreria.ventas.domain.exception.VentaNoEncontradaException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Traduce las excepciones al formato del contrato: { codigo, mensaje } (+ ventaId y estado en la Saga). */
@RestControllerAdvice
public class ManejadorErrores {

  private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);

  @ExceptionHandler(DominioException.class)
  ResponseEntity<Map<String, Object>> dominio(DominioException e) {
    Map<String, Object> cuerpo = cuerpo(e.codigo(), e.getMessage());
    HttpStatus estado = HttpStatus.BAD_REQUEST;   // DatosInvalidosException y cualquier otra regla
    if (e instanceof ProductoNoEncontradoException || e instanceof VentaNoEncontradaException) {
      estado = HttpStatus.NOT_FOUND;
    } else if (e instanceof SinStockException x) {
      cuerpo.put("ventaId", x.getVentaId());
      cuerpo.put("estado", "CANCELADA");
      cuerpo.put("faltantes", x.getFaltantes());
      estado = HttpStatus.CONFLICT;
    } else if (e instanceof SagaCompensadaException x) {
      cuerpo.put("ventaId", x.getVentaId());
      cuerpo.put("estado", "CANCELADA");
      estado = HttpStatus.BAD_GATEWAY;
    }
    return ResponseEntity.status(estado).body(cuerpo);
  }

  @ExceptionHandler(ServicioRemotoException.class)
  ResponseEntity<Map<String, Object>> remoto(ServicioRemotoException e) {
    log.warn("Servicio remoto: {}", e.getMessage());
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(cuerpo("ERROR_INTERNO", e.getMessage()));
  }

  @ExceptionHandler(MissingRequestHeaderException.class)
  ResponseEntity<Map<String, Object>> sinEncabezado(MissingRequestHeaderException e) {
    return ResponseEntity.badRequest().body(cuerpo("DATOS_INVALIDOS", "Falta el encabezado " + e.getHeaderName()));
  }

  @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
  ResponseEntity<Map<String, Object>> malFormado(Exception e) {
    return ResponseEntity.badRequest().body(cuerpo("DATOS_INVALIDOS", "El cuerpo o los parámetros no son válidos"));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<Map<String, Object>> noEncontrado(NoResourceFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(cuerpo("NO_ENCONTRADO", "Ruta no encontrada"));
  }

  private static Map<String, Object> cuerpo(String codigo, String mensaje) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("codigo", codigo);
    m.put("mensaje", mensaje);
    return m;
  }
}
