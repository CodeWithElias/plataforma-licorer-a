<?php

namespace Inventario\Entities\Excepciones;

class ReservaLiberada extends ErrorDeDominio
{
    public function __construct(string $reservaId)
    {
        parent::__construct("La reserva {$reservaId} fue liberada");
    }

    public function codigo(): string
    {
        return 'RESERVA_LIBERADA';
    }
}
