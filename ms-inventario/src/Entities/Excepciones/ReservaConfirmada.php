<?php

namespace Inventario\Entities\Excepciones;

class ReservaConfirmada extends ErrorDeDominio
{
    public function __construct(string $reservaId)
    {
        parent::__construct("La reserva {$reservaId} ya fue confirmada");
    }

    public function codigo(): string
    {
        return 'RESERVA_CONFIRMADA';
    }
}
