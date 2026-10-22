<?php

namespace Inventario\UseCases;

use Inventario\Entities\Excepciones\ReservaNoEncontrada;
use Inventario\Entities\Reserva;
use Inventario\UseCases\Ports\ReservaRepository;

class ObtenerReserva
{
    public function __construct(private ReservaRepository $reservas) {}

    public function ejecutar(string $reservaId): Reserva
    {
        return $this->reservas->buscar($reservaId) ?? throw new ReservaNoEncontrada($reservaId);
    }
}
