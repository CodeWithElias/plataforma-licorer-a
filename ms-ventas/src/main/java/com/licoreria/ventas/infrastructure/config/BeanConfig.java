package com.licoreria.ventas.infrastructure.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.client.RestClient;

/**
 * Clientes HTTP hacia los otros servicios: tiempo máximo de 5 s por llamada (los reintentos están en LlamadaRemota).
 * Habilita también la tarea programada que reintenta compensaciones.
 */
@Configuration
@EnableScheduling
public class BeanConfig {

  private final Duration timeout;

  public BeanConfig(@Value("${remoto.timeout-ms:5000}") long timeoutMs) {
    this.timeout = Duration.ofMillis(timeoutMs);
  }

  @Bean
  RestClient inventarioRestClient(@Value("${inventario.url}") String url) {
    return cliente(url);
  }

  @Bean
  RestClient gestionRestClient(@Value("${gestion.url}") String url) {
    return cliente(url);
  }

  @Bean
  RestClient keycloakRestClient(@Value("${keycloak.token-url}") String url) {
    return cliente(url);
  }

  private RestClient cliente(String url) {
    JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(
        HttpClient.newBuilder().connectTimeout(timeout).build());
    fabrica.setReadTimeout(timeout);
    return RestClient.builder().baseUrl(url).requestFactory(fabrica).build();
  }
}
