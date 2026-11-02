package com.licoreria.ventas.infrastructure.adapter.in.web;

import com.licoreria.ventas.application.port.out.IdempotenciaPort;
import com.licoreria.ventas.application.port.out.IdempotenciaPort.Registro;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

/**
 * CU03 – Idempotencia de POST /ventas y POST /ventas/sync.
 * Si el Idempotency-Key ya se usó, devuelve la respuesta guardada sin ejecutar nada; si no, deja pasar el pedido y
 * guarda su respuesta. Corre después de Spring Security, así que solo ve pedidos con token y rol válidos.
 */
@Component
public class IdempotencyFilter extends OncePerRequestFilter {

  public static final String ENCABEZADO = "Idempotency-Key";
  public static final String REPETIDA = "Idempotent-Replayed";
  private static final Set<String> RUTAS = Set.of("/ventas", "/ventas/sync");
  /** Una clave en proceso más vieja que esto se considera abandonada (el servicio se cayó a mitad). */
  static final Duration ABANDONO = Duration.ofMinutes(2);

  // Tomcat crea los filtros antes que JPA: el adaptador se pide recién en el primer pedido
  private final Supplier<IdempotenciaPort> proveedor;
  private final Clock reloj;
  private IdempotenciaPort claves;

  @Autowired
  public IdempotencyFilter(ObjectProvider<IdempotenciaPort> claves) {
    this.proveedor = claves::getObject;
    this.reloj = Clock.systemUTC();
  }

  IdempotencyFilter(IdempotenciaPort claves, Clock reloj) {
    this.proveedor = () -> claves;
    this.reloj = reloj;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest req) {
    return !"POST".equals(req.getMethod()) || !RUTAS.contains(ruta(req));
  }

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    if (claves == null) {
      claves = proveedor.get();
    }
    String valor = req.getHeader(ENCABEZADO);
    if (valor == null) {
      chain.doFilter(req, res);   // POST /ventas lo exige (400 en el controlador); en /sync es opcional
      return;
    }
    UUID clave;
    try {
      clave = UUID.fromString(valor.trim());
    } catch (IllegalArgumentException e) {
      error(res, 400, "DATOS_INVALIDOS", "El encabezado Idempotency-Key debe ser un UUID");
      return;
    }
    String endpoint = "POST " + ruta(req);

    if (!claves.reservar(clave, endpoint)) {
      Optional<Registro> previo = claves.buscar(clave);
      if (previo.isEmpty() && !claves.reservar(clave, endpoint)) {   // se borró justo ahora: se intenta de nuevo
        previo = claves.buscar(clave);
      }
      if (previo.isPresent() && !responderGuardada(previo.get(), clave, endpoint, res)) {
        return;
      }
    }

    ContentCachingResponseWrapper copia = new ContentCachingResponseWrapper(res);
    try {
      chain.doFilter(req, copia);
    } catch (IOException | ServletException | RuntimeException e) {
      claves.liberar(clave);
      throw e;
    }
    byte[] cuerpo = copia.getContentAsByteArray();
    if (debeGuardarse(copia.getStatus(), cuerpo)) {
      claves.guardar(clave, copia.getStatus(), new String(cuerpo, StandardCharsets.UTF_8));
    } else {
      claves.liberar(clave);
    }
    copia.copyBodyToResponse();
  }

  /**
   * Responde con lo que ya existe para la clave.
   *
   * @return true si el pedido debe ejecutarse de todos modos (la clave estaba abandonada y se retomó)
   */
  private boolean responderGuardada(Registro r, UUID clave, String endpoint, HttpServletResponse res) throws IOException {
    if (!r.endpoint().equals(endpoint)) {
      error(res, 422, "IDEMPOTENCY_KEY_REUSADA", "Ese Idempotency-Key ya se usó en " + r.endpoint());
      return false;
    }
    if (r.enProceso()) {
      if (r.creadoEn().isBefore(OffsetDateTime.now(reloj).minus(ABANDONO))) {
        claves.retomar(clave);
        return true;
      }
      error(res, 409, "EN_PROCESO", "Esa venta todavía se está procesando; reintente en unos segundos");
      return false;
    }
    res.setStatus(r.estadoHttp());
    res.setContentType("application/json;charset=UTF-8");
    res.setHeader(REPETIDA, "true");
    res.getOutputStream().write(r.cuerpo().getBytes(StandardCharsets.UTF_8));
    return false;
  }

  /**
   * Se guarda toda respuesta exitosa y los errores de una Saga que sí creó la venta (409 SIN_STOCK y 502
   * SAGA_COMPENSADA traen ventaId). Los demás (400, 404, servicio caído antes de crear la venta) se pueden reintentar.
   */
  static boolean debeGuardarse(int estado, byte[] cuerpo) {
    if (estado >= 200 && estado < 300) {
      return true;
    }
    return (estado == 409 || estado == 502) && new String(cuerpo, StandardCharsets.UTF_8).contains("\"ventaId\"");
  }

  private static String ruta(HttpServletRequest req) {
    String uri = req.getRequestURI().substring(req.getContextPath().length());
    return uri.endsWith("/") && uri.length() > 1 ? uri.substring(0, uri.length() - 1) : uri;
  }

  private static void error(HttpServletResponse res, int estado, String codigo, String mensaje) throws IOException {
    res.setStatus(estado);
    res.setContentType("application/json;charset=UTF-8");
    res.getOutputStream().write(("{\"codigo\":\"" + codigo + "\",\"mensaje\":\"" + mensaje + "\"}").getBytes(StandardCharsets.UTF_8));
  }
}
