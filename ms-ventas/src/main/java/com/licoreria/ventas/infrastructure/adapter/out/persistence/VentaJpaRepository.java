package com.licoreria.ventas.infrastructure.adapter.out.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface VentaJpaRepository extends JpaRepository<VentaEntity, UUID> {

  Optional<VentaEntity> findByOperationId(UUID operationId);

  List<VentaEntity> findByEstadoAndFechaGreaterThanEqualAndFechaLessThanOrderByFechaAsc(
      String estado, OffsetDateTime desde, OffsetDateTime hasta);
}
