package com.licoreria.ventas.infrastructure.adapter.out.keycloak;

import com.licoreria.ventas.application.port.out.TokenServicioPort;
import com.licoreria.ventas.domain.exception.ServicioRemotoException;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;

/** Token del cliente ms-ventas (client credentials), en caché hasta 30 s antes de vencer. */
@Component
public class KeycloakTokenServicioAdapter implements TokenServicioPort {

  private final RestClient http;
  private final String clientId;
  private final String clientSecret;
  private String token;
  private Instant vence = Instant.EPOCH;

  public KeycloakTokenServicioAdapter(@Qualifier("keycloakRestClient") RestClient http,
                                      @Value("${servicio.client-id}") String clientId,
                                      @Value("${servicio.client-secret}") String clientSecret) {
    this.http = http;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  @Override
  public synchronized String token() {
    if (token != null && Instant.now().isBefore(vence)) {
      return token;
    }
    if (clientSecret == null || clientSecret.isBlank()) {
      throw new ServicioRemotoException("Falta VENTAS_CLIENT_SECRET en ms-ventas/.env");
    }
    var formulario = new LinkedMultiValueMap<String, String>();
    formulario.add("grant_type", "client_credentials");
    formulario.add("client_id", clientId);
    formulario.add("client_secret", clientSecret);
    Map<?, ?> r = http.post().uri("").contentType(MediaType.APPLICATION_FORM_URLENCODED).body(formulario).retrieve().body(Map.class);
    token = (String) r.get("access_token");
    vence = Instant.now().plusSeconds(((Number) r.get("expires_in")).longValue() - 30);
    return token;
  }
}
