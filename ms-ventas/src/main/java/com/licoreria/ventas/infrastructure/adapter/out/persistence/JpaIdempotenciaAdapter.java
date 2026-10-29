package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import com.licoreria.ventas.application.port.out.IdempotenciaPort;
import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Adaptador de salida: tabla idempotency_keys (SQL nativo: INSERT ... ON CONFLICT). */
@Component
public class JpaIdempotenciaAdapter implements IdempotenciaPort {

  private final EntityManager em;

  public JpaIdempotenciaAdapter(EntityManager em) {
    this.em = em;
  }

  @Override
  @Transactional
  public boolean reservar(UUID clave, String endpoint) {
    // La clave primaria decide quién gana si llegan dos pedidos iguales a la vez
    int filas = em.createNativeQuery("""
        INSERT INTO idempotency_keys (clave, endpoint, estado_http, respuesta)
        VALUES (?1, ?2, 0, '') ON CONFLICT (clave) DO NOTHING""")
        .setParameter(1, clave).setParameter(2, endpoint).executeUpdate();
    return filas == 1;
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<Registro> buscar(UUID clave) {
    @SuppressWarnings("unchecked")
    List<Object[]> filas = em.createNativeQuery("""
        SELECT endpoint, estado_http, respuesta, creado_en FROM idempotency_keys WHERE clave = ?1""")
        .setParameter(1, clave).getResultList();
    return filas.stream().findFirst().map(f -> new Registro((String) f[0], ((Number) f[1]).intValue(), (String) f[2], fecha(f[3])));
  }

  @Override
  @Transactional
  public void retomar(UUID clave) {
    em.createNativeQuery("UPDATE idempotency_keys SET creado_en = now() WHERE clave = ?1 AND estado_http = 0")
        .setParameter(1, clave).executeUpdate();
  }

  @Override
  @Transactional
  public void guardar(UUID clave, int estadoHttp, String cuerpo) {
    em.createNativeQuery("UPDATE idempotency_keys SET estado_http = ?2, respuesta = ?3 WHERE clave = ?1")
        .setParameter(1, clave).setParameter(2, estadoHttp).setParameter(3, cuerpo).executeUpdate();
  }

  @Override
  @Transactional
  public void liberar(UUID clave) {
    em.createNativeQuery("DELETE FROM idempotency_keys WHERE clave = ?1 AND estado_http = 0")
        .setParameter(1, clave).executeUpdate();
  }

  private static OffsetDateTime fecha(Object valor) {
    if (valor instanceof OffsetDateTime o) {
      return o;
    }
    if (valor instanceof java.time.Instant i) {
      return i.atOffset(ZoneOffset.UTC);
    }
    if (valor instanceof java.sql.Timestamp t) {
      return t.toInstant().atOffset(ZoneOffset.UTC);
    }
    return OffsetDateTime.now();
  }
}
