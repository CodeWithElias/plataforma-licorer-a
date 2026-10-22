<?php

namespace Inventario\UseCases\Ports;

use Inventario\Entities\Reserva;
use Inventario\Entities\Stock;

/**
 * Cada escritura cambia la reserva y el stock de sus productos de forma atómica.
 * Los $stocks son los que leyó el caso de uso: la escritura exige que su version no haya cambiado.
 */
interface ReservaRepository
{
    public function buscar(string $reservaId): ?Reserva;

    /**
     * Guarda la reserva ACTIVA y suma sus cantidades a "reservado".
     *
     * @param  array<string, Stock>  $stocks
     *
     * @throws ReservaYaExiste si ya hay una reserva con ese id
     * @throws ConflictoConcurrencia si otro proceso cambió el stock
     */
    public function crear(Reserva $reserva, array $stocks): void;

    /**
     * Pasa la reserva de ACTIVA a CONFIRMADA y descuenta sus cantidades de "cantidad" y "reservado".
     *
     * @param  array<string, Stock>  $stocks
     *
     * @throws ConflictoConcurrencia
     */
    public function confirmar(Reserva $reserva, array $stocks): void;

    /**
     * Pasa la reserva de ACTIVA a LIBERADA y resta sus cantidades de "reservado".
     *
     * @param  array<string, Stock>  $stocks
     *
     * @throws ConflictoConcurrencia
     */
    public function liberar(Reserva $reserva, array $stocks): void;
}
