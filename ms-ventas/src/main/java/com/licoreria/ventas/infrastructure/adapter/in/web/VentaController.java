package com.licoreria.ventas.infrastructure.adapter.in.web;

import com.licoreria.ventas.application.port.in.ConsultarVentasUseCase;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.Comando;
import com.licoreria.ventas.application.port.in.RegistrarVentaUseCase.LineaPedida;
import com.licoreria.ventas.domain.exception.DatosInvalidosException;
import com.licoreria.ventas.domain.model.MetodoPago;
import com.licoreria.ventas.domain.model.OrigenVenta;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.VentaCreada;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.VentaDetalle;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.VentaRequest;
import com.licoreria.ventas.infrastructure.adapter.in.web.VentaDtos.VentaResumen;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Adaptador de entrada HTTP. Contrato: docs/openapi.yaml. */
@RestController
@RequestMapping("/ventas")
public class VentaController {

  private final RegistrarVentaUseCase registrar;
  private final ConsultarVentasUseCase consultar;

  public VentaController(RegistrarVentaUseCase registrar, ConsultarVentasUseCase consultar) {
    this.registrar = registrar;
    this.consultar = consultar;
  }

  /** CU02. El Idempotency-Key es el operationId de la venta en los 3 servicios. Rol CAJERO (SecurityConfig). */
  @PostMapping
  public ResponseEntity<VentaCreada> registrar(@RequestHeader("Idempotency-Key") String idempotencyKey,
                                               @RequestBody VentaRequest cuerpo,
                                               @AuthenticationPrincipal Jwt jwt) {
    UUID operationId = uuid(idempotencyKey, "El encabezado Idempotency-Key debe ser un UUID");
    if (cuerpo == null || cuerpo.items() == null) {
      throw new DatosInvalidosException("items es obligatorio");
    }
    List<LineaPedida> items = cuerpo.items().stream()
        .map(i -> new LineaPedida(i.productoCodigo(), i.cantidad() == null ? 0 : i.cantidad()))
        .toList();
    Comando comando = new Comando(operationId, jwt.getSubject(), items, metodo(cuerpo), OrigenVenta.ONLINE, null);

    RegistrarVentaUseCase.Resultado r = registrar.registrar(comando, jwt.getTokenValue());
    return ResponseEntity.status(r.nueva() ? HttpStatus.CREATED : HttpStatus.OK).body(VentaCreada.de(r.venta()));
  }

  /** Detalle con el estado de la Saga. Roles CAJERO, GERENTE. */
  @GetMapping("/{id}")
  public VentaDetalle obtener(@PathVariable String id) {
    var v = consultar.obtener(uuid(id, "El id de la venta debe ser un UUID"));
    return VentaDetalle.de(v.venta(), v.saga());
  }

  /** Ventas COMPLETADAS en [desde, hasta). Rol GERENTE. Lo usa la tool MCP ventas_por_periodo. */
  @GetMapping
  public List<VentaResumen> porPeriodo(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime desde,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime hasta) {
    return consultar.completadasEntre(desde, hasta).stream().map(VentaResumen::de).toList();
  }

  private static MetodoPago metodo(VentaRequest cuerpo) {
    if (cuerpo.pago() == null || cuerpo.pago().metodo() == null) {
      throw new DatosInvalidosException("pago.metodo es obligatorio (EFECTIVO, TARJETA o QR)");
    }
    try {
      return MetodoPago.valueOf(cuerpo.pago().metodo().toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new DatosInvalidosException("pago.metodo debe ser EFECTIVO, TARJETA o QR");
    }
  }

  private static UUID uuid(String valor, String mensaje) {
    try {
      return UUID.fromString(valor);
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new DatosInvalidosException(mensaje);
    }
  }
}
