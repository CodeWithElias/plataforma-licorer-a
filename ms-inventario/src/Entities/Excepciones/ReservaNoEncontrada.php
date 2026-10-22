<?php

namespace Inventario\Entities\Excepciones;

class ReservaNoEncontrada extends ErrorDeDominio
{
    public function __construct(string $reservaId)
    {
        parent::__construct("No existe la reserva {$reservaId}");
    }

    public function codigo(): string
    {
        return 'RESERVA_NO_ENCONTRADA';
    }
}
