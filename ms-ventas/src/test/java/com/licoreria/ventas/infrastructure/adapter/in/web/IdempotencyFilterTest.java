package com.licoreria.ventas.infrastructure.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.licoreria.ventas.application.port.out.IdempotenciaPort;
import jakarta.servlet.FilterChain;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** CU03 – la misma Idempotency-Key 3 veces ejecuta la venta una sola vez y responde lo mismo. */
class IdempotencyFilterTest {

  private static final Instant AHORA = Instant.parse("2026-10-28T15:00:00Z");

  private ClavesEnMemoria claves;
  private IdempotencyFilter filtro;
  private AtomicInteger ejecuciones;

  @BeforeEach
  void preparar() {
    claves = new ClavesEnMemoria();
    filtro = new IdempotencyFilter(claves, Clock.fixed(AHORA, ZoneOffset.UTC));
    ejecuciones = new AtomicInteger();
  }

  private MockHttpServletResponse enviar(String ruta, String clave, int estado, String cuerpo) throws Exception {
    MockHttpServletRequest req = new MockHttpServletRequest("POST", ruta);
    if (clave != null) {
      req.addHeader(IdempotencyFilter.ENCABEZADO, clave);
    }
    MockHttpServletResponse res = new MockHttpServletResponse();
    FilterChain controlador = (rq, rs) -> {
      ejecuciones.incrementAndGet();
      ((jakarta.servlet.http.HttpServletResponse) rs).setStatus(estado);
      rs.getWriter().write(cuerpo);
    };
    filtro.doFilter(req, res, controlador);
    return res;
  }

  @Test
  void laMismaClaveTresVecesEjecutaUnaSolaVez() throws Exception {
    String clave = UUID.randomUUID().toString();
    String venta = "{\"id\":\"v1\",\"numero\":7,\"estado\":\"COMPLETADA\"}";

    MockHttpServletResponse r1 = enviar("/ventas", clave, 201, venta);
    MockHttpServletResponse r2 = enviar("/ventas", clave, 201, "otra cosa");
    MockHttpServletResponse r3 = enviar("/ventas", clave, 201, "otra cosa");

    assertThat(ejecuciones).hasValue(1);
    assertThat(r1.getContentAsString()).isEqualTo(venta);
    assertThat(r2.getStatus()).isEqualTo(201);
    assertThat(r2.getContentAsString()).isEqualTo(venta);
    assertThat(r3.getContentAsString()).isEqualTo(venta);
    assertThat(r3.getHeader(IdempotencyFilter.REPETIDA)).isEqualTo("true");
  }

  @Test
  void unaVentaCanceladaPorSinStockTambienSeRepiteIgual() throws Exception {
    String clave = UUID.randomUUID().toString();
    String error = "{\"codigo\":\"SIN_STOCK\",\"ventaId\":\"v2\"}";
    enviar("/ventas", clave, 409, error);
    MockHttpServletResponse r = enviar("/ventas", clave, 201, "no debe ejecutarse");

    assertThat(ejecuciones).hasValue(1);
    assertThat(r.getStatus()).isEqualTo(409);
    assertThat(r.getContentAsString()).isEqualTo(error);
  }

  @Test
  void unErrorSinVentaLiberaLaClaveParaReintentar() throws Exception {
    String clave = UUID.randomUUID().toString();
    enviar("/ventas", clave, 400, "{\"codigo\":\"DATOS_INVALIDOS\"}");
    MockHttpServletResponse r = enviar("/ventas", clave, 201, "{\"id\":\"v3\"}");

    assertThat(ejecuciones).hasValue(2);
    assertThat(r.getStatus()).isEqualTo(201);
  }

  @Test
  void claveEnProcesoResponde409() throws Exception {
    UUID clave = UUID.randomUUID();
    claves.reservar(clave, "POST /ventas");
    MockHttpServletResponse r = enviar("/ventas", clave.toString(), 201, "{}");

    assertThat(ejecuciones).hasValue(0);
    assertThat(r.getStatus()).isEqualTo(409);
    assertThat(r.getContentAsString()).contains("EN_PROCESO");
  }

  @Test
  void claveAbandonadaSeRetomaYSeEjecuta() throws Exception {
    UUID clave = UUID.randomUUID();
    claves.reservar(clave, "POST /ventas");
    claves.envejecer(clave, IdempotencyFilter.ABANDONO.plusMinutes(1));
    MockHttpServletResponse r = enviar("/ventas", clave.toString(), 200, "{\"id\":\"v4\"}");

    assertThat(ejecuciones).hasValue(1);
    assertThat(r.getStatus()).isEqualTo(200);
  }

  @Test
  void laClaveDeUnaVentaNoSirveParaElSync() throws Exception {
    String clave = UUID.randomUUID().toString();
    enviar("/ventas", clave, 201, "{}");
    MockHttpServletResponse r = enviar("/ventas/sync", clave, 200, "[]");

    assertThat(r.getStatus()).isEqualTo(422);
  }

  @Test
  void claveQueNoEsUuidResponde400YSinClavePasaDirecto() throws Exception {
    assertThat(enviar("/ventas", "abc", 201, "{}").getStatus()).isEqualTo(400);
    assertThat(ejecuciones).hasValue(0);
    enviar("/ventas/sync", null, 200, "[]");
    assertThat(ejecuciones).hasValue(1);
  }

  /** Mismo comportamiento que JpaIdempotenciaAdapter, en memoria. */
  static class ClavesEnMemoria implements IdempotenciaPort {
    private final Map<UUID, Registro> filas = new HashMap<>();

    @Override
    public boolean reservar(UUID clave, String endpoint) {
      return filas.putIfAbsent(clave, new Registro(endpoint, 0, "{}", OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC))) == null;
    }

    @Override
    public Optional<Registro> buscar(UUID clave) {
      return Optional.ofNullable(filas.get(clave));
    }

    @Override
    public void retomar(UUID clave) {
      filas.computeIfPresent(clave, (k, r) -> new Registro(r.endpoint(), 0, r.cuerpo(), OffsetDateTime.ofInstant(AHORA, ZoneOffset.UTC)));
    }

    @Override
    public void guardar(UUID clave, int estadoHttp, String cuerpo) {
      filas.computeIfPresent(clave, (k, r) -> new Registro(r.endpoint(), estadoHttp, cuerpo, r.creadoEn()));
    }

    @Override
    public void liberar(UUID clave) {
      filas.computeIfPresent(clave, (k, r) -> r.enProceso() ? null : r);
    }

    void envejecer(UUID clave, java.time.Duration tiempo) {
      filas.computeIfPresent(clave, (k, r) -> new Registro(r.endpoint(), r.estadoHttp(), r.cuerpo(), r.creadoEn().minus(tiempo)));
    }
  }
}
