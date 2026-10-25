package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface SagaJpaRepository extends JpaRepository<SagaInstanciaEntity, UUID> {

  Optional<SagaInstanciaEntity> findFirstByVentaIdOrderByCreadoEnDesc(UUID ventaId);

  @Query("select s from SagaInstanciaEntity s where s.estado = 'COMPENSANDO' "
      + "or (s.estado = 'EN_CURSO' and s.actualizadoEn < :limite)")
  List<SagaInstanciaEntity> pendientes(@Param("limite") OffsetDateTime limite);
}
