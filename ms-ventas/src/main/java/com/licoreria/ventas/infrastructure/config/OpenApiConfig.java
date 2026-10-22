package com.licoreria.ventas.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Información de Swagger UI (/swagger-ui.html) y botón "Authorize" para probar con un token de Keycloak.
 * El contrato acordado es docs/openapi.yaml.
 */
@Configuration
public class OpenApiConfig {

  @Bean
  OpenAPI openApi() {
    return new OpenAPI()
        .info(new Info()
            .title("ms-ventas")
            .version("1.0.0")
            .description("Registro de ventas con Saga orquestada (CU02) y sincronización offline (CU03)."))
        .components(new Components().addSecuritySchemes("bearer",
            new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
        .addSecurityItem(new SecurityRequirement().addList("bearer"));
  }
}
