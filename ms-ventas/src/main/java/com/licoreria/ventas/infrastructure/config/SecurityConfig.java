package com.licoreria.ventas.infrastructure.config;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain api(HttpSecurity http) throws Exception {
    http.csrf(c -> c.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(a -> a
            .requestMatchers("/health", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
            .requestMatchers(HttpMethod.POST, "/ventas/**").hasRole("CAJERO")
            .requestMatchers(HttpMethod.GET, "/ventas").hasRole("GERENTE")                 // por periodo
            .requestMatchers(HttpMethod.GET, "/ventas/*").hasAnyRole("CAJERO", "GERENTE")  // detalle
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(rolesDeKeycloak())));
    return http.build();
  }

  @Bean
  JwtDecoder jwtDecoder(@Value("${keycloak.jwks}") String jwks, @Value("${keycloak.issuer}") String issuer) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();   // claves por la red interna
    decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));    // emisor público
    return decoder;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(@Value("${cors.origins}") String origins) {
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    List<String> permitidos = Arrays.stream(origins.split(",")).map(String::trim).filter(o -> !o.isEmpty()).toList();
    if (!permitidos.isEmpty()) {
      CorsConfiguration cors = new CorsConfiguration();
      cors.setAllowedOrigins(permitidos);
      cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
      cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
      source.registerCorsConfiguration("/**", cors);
    }
    return source;
  }

  private JwtAuthenticationConverter rolesDeKeycloak() {
    JwtAuthenticationConverter conv = new JwtAuthenticationConverter();
    conv.setJwtGrantedAuthoritiesConverter(jwt -> {
      Map<String, Object> realm = jwt.getClaimAsMap("realm_access");
      @SuppressWarnings("unchecked")
      List<String> roles = realm == null ? List.of() : (List<String>) realm.get("roles");
      return roles.stream().map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
    });
    return conv;
  }
}
