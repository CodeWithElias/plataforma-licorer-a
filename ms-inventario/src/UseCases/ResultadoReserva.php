<?php

namespace Inventario\UseCases;

use Inventario\Entities\Reserva;

final readonly class ResultadoReserva
{
    /** @param bool $creada false si la reserva ya existía (reintento) */
    public function __construct(
        public Reserva $reserva,
        public bool $creada,
    ) {}
}
