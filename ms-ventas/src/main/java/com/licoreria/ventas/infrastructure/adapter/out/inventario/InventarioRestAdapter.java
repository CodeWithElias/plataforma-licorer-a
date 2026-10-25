package com.licoreria.ventas.infrastructure.adapter.out.inventario;

import static com.licoreria.ventas.infrastructure.adapter.out.LlamadaRemota.conReintentos;

import com.licoreria.ventas.application.port.out.InventarioPort;
import com.licoreria.ventas.domain.exception.ProductoNoEncontradoException;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import com.licoreria.ventas.domain.exception.SinStockException;
import com.licoreria.ventas.domain.model.DetalleVenta;
import com.licoreria.ventas.infrastructure.adapter.out.LlamadaRemota.ErrorTransitorio;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Adaptador REST de ms-inventario (contrato: ms-inventario/docs/openapi.yaml). Reenvía el token recibido.
 */
@Component
public class InventarioRestAdapter implements InventarioPort {

  private final RestClient http;

  public InventarioRestAdapter(@Qualifier("inventarioRestClient") RestClient http) {
    this.http = http;
  }

  @Override
  public ProductoCatalogo obtenerProducto(String codigo, String token) {
    return conReintentos("ms-inventario GET /productos/" + codigo, () -> http.get()
        .uri("/productos/{codigo}", codigo)
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
        .exchange((req, res) -> {
          int estado = res.getStatusCode().value();
          if (estado == 200) {
            Map<?, ?> p = res.bodyTo(Map.class);
            return new ProductoCatalogo((String) p.get("codigo"), (String) p.get("nombre"), new BigDecimal(p.get("precio").toString()));
          }
          if (estado == 404) {
            throw new ProductoNoEncontradoException("No existe el producto " + codigo);
          }
          throw error("GET /productos/" + codigo, res);
        }));
  }

  @Override
  public void reservar(UUID reservaId, List<DetalleVenta> items, String token) {
    Map<String, Object> cuerpo = Map.of(
        "reservaId", reservaId.toString(),
        "items", items.stream().map(i -> Map.of("productoCodigo", i.productoCodigo(), "cantidad", i.cantidad())).toList());
    conReintentos("ms-inventario POST /stock/reservas", () -> http.post()
        .uri("/stock/reservas")
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
        .contentType(MediaType.APPLICATION_JSON)
        .body(cuerpo)
        .exchange((req, res) -> {
          int estado = res.getStatusCode().value();
          if (estado == 200 || estado == 201) {
            return null;   // 200 = la reserva ya existía (reintento)
          }
          if (estado == 409) {
            Map<?, ?> error = res.bodyTo(Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> faltantes = (List<Map<String, Object>>) error.get("faltantes");
            throw new SinStockException(faltantes);
          }
          if (estado == 404) {
            throw new ProductoNoEncontradoException(mensaje(res, "Algún producto no tiene stock registrado"));
          }
          throw error("POST /stock/reservas", res);
        }));
  }

  @Override
  public void confirmar(UUID reservaId, String token) {
    conReintentos("ms-inventario POST /stock/reservas/" + reservaId + "/confirmar", () -> http.post()
        .uri("/stock/reservas/{id}/confirmar", reservaId)
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
        .exchange((req, res) -> {
          if (res.getStatusCode().value() == 200) {
            return null;
          }
          throw error("POST /stock/reservas/" + reservaId + "/confirmar", res);
        }));
  }

  @Override
  public void liberar(UUID reservaId, String token) {
    conReintentos("ms-inventario DELETE /stock/reservas/" + reservaId, () -> http.delete()
        .uri("/stock/reservas/{id}", reservaId)
        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
        .exchange((req, res) -> {
          int estado = res.getStatusCode().value();
          if (estado == 200 || estado == 404) {
            return null;   // 404: la reserva nunca se creó, no hay nada que liberar
          }
          throw error("DELETE /stock/reservas/" + reservaId, res);
        }));
  }

  /** 5xx se reintenta; 4xx es definitivo. */
  private static RuntimeException error(String operacion, ClientHttpResponse res) throws IOException {
    int estado = res.getStatusCode().value();
    String detalle = "ms-inventario " + operacion + " respondió " + estado + ": " + mensaje(res, "");
    return estado >= 500 ? new ErrorTransitorio(detalle) : new ServicioRemotoException(detalle);
  }

  private static String mensaje(ClientHttpResponse res, String porDefecto) {
    try {
      String cuerpo = new String(res.getBody().readAllBytes());
      return cuerpo.isBlank() ? porDefecto : cuerpo;
    } catch (IOException e) {
      return porDefecto;
    }
  }
}
