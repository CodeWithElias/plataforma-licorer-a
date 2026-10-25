package com.licoreria.ventas.infrastructure.adapter.out.gestion;

import static com.licoreria.ventas.infrastructure.adapter.out.LlamadaRemota.conReintentos;

import com.licoreria.ventas.application.port.out.GestionPort;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import com.licoreria.ventas.domain.model.Venta;
import com.licoreria.ventas.infrastructure.adapter.out.LlamadaRemota.ErrorTransitorio;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Adaptador GraphQL de ms-gestion (contrato: ms-gestion/schema.graphql). POST JSON simple, reenviando el token.
 */
@Component
public class GestionGraphqlAdapter implements GestionPort {

  private static final String REGISTRAR = """
      mutation RegistrarIngreso($in: IngresoInput!) {
        registrarIngreso(input: $in) { id estado }
      }""";

  private static final String ANULAR = """
      mutation AnularIngreso($operationId: String!) {
        anularIngreso(operationId: $operationId) { id estado }
      }""";

  private final RestClient http;

  public GestionGraphqlAdapter(@Qualifier("gestionRestClient") RestClient http) {
    this.http = http;
  }

  @Override
  public String registrarIngreso(Venta venta, String token) {
    Map<String, Object> entrada = Map.of(
        "operationId", venta.getOperationId().toString(),
        "ventaId", venta.getId().toString(),
        "monto", venta.total());
    Map<?, ?> datos = ejecutar("registrarIngreso", REGISTRAR, Map.of("in", entrada), token, null);
    return (String) ((Map<?, ?>) datos.get("registrarIngreso")).get("id");
  }

  @Override
  public void anularIngreso(UUID operationId, String token) {
    // Si el ingreso nunca se registró no hay nada que anular
    ejecutar("anularIngreso", ANULAR, Map.of("operationId", operationId.toString()), token, "INGRESO_NO_ENCONTRADO");
  }

  /** @param codigoAceptado código de error GraphQL que no se considera falla (o null) */
  private Map<?, ?> ejecutar(String nombre, String consulta, Map<String, Object> variables, String token, String codigoAceptado) {
    Map<?, ?> respuesta = conReintentos("ms-gestion " + nombre, () -> http.post().uri("")
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("query", consulta, "variables", variables))
        .exchange((req, res) -> {
          int estado = res.getStatusCode().value();
          if (estado >= 500) {
            throw new ErrorTransitorio("ms-gestion respondió " + estado);
          }
          if (estado != 200) {
            throw new ServicioRemotoException("ms-gestion " + nombre + " respondió " + estado);
          }
          return res.bodyTo(Map.class);
        }));

    Object errores = respuesta.get("errors");
    if (errores instanceof List<?> lista && !lista.isEmpty()) {
      Map<?, ?> error = (Map<?, ?>) lista.get(0);
      Object codigo = error.get("extensions") instanceof Map<?, ?> ext ? ext.get("code") : null;
      if (codigoAceptado != null && codigoAceptado.equals(codigo)) {
        return Map.of();
      }
      throw new ServicioRemotoException("ms-gestion " + nombre + ": " + error.get("message") + " (" + codigo + ")");
    }
    return (Map<?, ?>) respuesta.get("data");
  }
}
