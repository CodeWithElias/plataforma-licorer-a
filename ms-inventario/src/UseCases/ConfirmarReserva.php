<?php

namespace Inventario\UseCases;

use Inventario\Entities\EstadoReserva;
use Inventario\Entities\Excepciones\ReservaNoEncontrada;
use Inventario\Entities\Reserva;
use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\NotificadorStockBajo;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Paso 4 de la Saga: descuenta el stock definitivamente. Si algún producto queda bajo el mínimo,
 * avisa una sola vez (CU06). Confirmar dos veces no hace nada la segunda.
 */
class ConfirmarReserva
{
    public const MAX_INTENTOS = 3;

    public function __construct(
        private ReservaRepository $reservas,
        private StockRepository $stock,
        private NotificadorStockBajo $notificador,
    ) {}

    public function ejecutar(string $reservaId): Reserva
    {
        for ($intento = 1; $intento <= self::MAX_INTENTOS; $intento++) {
            $reserva = $this->reservas->buscar($reservaId) ?? throw new ReservaNoEncontrada($reservaId);
            if ($reserva->estado === EstadoReserva::Confirmada) {
                return $reserva;
            }

            $confirmada = $reserva->confirmar();   // falla si estaba LIBERADA
            $stocks = $this->stock->buscarVarios($reserva->codigos());

            try {
                $this->reservas->confirmar($confirmada, $stocks);
            } catch (ConflictoConcurrencia) {
                continue;
            }

            $this->avisarStockBajo($confirmada, $stocks);

            return $confirmada;
        }

        throw new ConflictoConcurrencia('No se pudo confirmar la reserva por cambios concurrentes; reintente');
    }

    /** @param array<string, Stock> $antes stock leído antes de descontar */
    private function avisarStockBajo(Reserva $reserva, array $antes): void
    {
        foreach ($reserva->items as $item) {
            $stock = $antes[$item->productoCodigo] ?? null;
            if ($stock === null || $stock->avisoEnviado || ! $stock->quedaBajoMinimo($item->cantidad)) {
                continue;
            }

            // Se marca antes de avisar: si dos ventas confirman a la vez, solo una gana la escritura condicional
            if (! $this->stock->marcarAvisoEnviado($stock->productoCodigo)) {
                continue;
            }
            $entregado = $this->notificador->notificar(
                $stock->productoCodigo, $stock->cantidad - $item->cantidad, $stock->minimo,
            );
            if (! $entregado) {
                $this->stock->quitarAviso($stock->productoCodigo);   // se reintenta en la siguiente confirmación
            }
        }
    }
}
