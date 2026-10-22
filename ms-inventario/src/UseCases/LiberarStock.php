<?php

namespace Inventario\UseCases;

use Inventario\Entities\EstadoReserva;
use Inventario\Entities\Excepciones\ReservaNoEncontrada;
use Inventario\Entities\Reserva;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Compensación del paso 2 de la Saga: devuelve lo reservado. Liberar dos veces no hace nada la segunda.
 */
class LiberarStock
{
    public const MAX_INTENTOS = 3;

    public function __construct(
        private ReservaRepository $reservas,
        private StockRepository $stock,
    ) {}

    public function ejecutar(string $reservaId): Reserva
    {
        for ($intento = 1; $intento <= self::MAX_INTENTOS; $intento++) {
            $reserva = $this->reservas->buscar($reservaId) ?? throw new ReservaNoEncontrada($reservaId);
            if ($reserva->estado === EstadoReserva::Liberada) {
                return $reserva;
            }

            $liberada = $reserva->liberar();   // falla si estaba CONFIRMADA
            $stocks = $this->stock->buscarVarios($reserva->sucursalId, $reserva->codigos());

            try {
                $this->reservas->liberar($liberada, $stocks);

                return $liberada;
            } catch (ConflictoConcurrencia) {
                continue;
            }
        }

        throw new ConflictoConcurrencia('No se pudo liberar la reserva por cambios concurrentes; reintente');
    }
}
