<?php

namespace Tests\Unit\Dobles;

use Inventario\Entities\Reserva;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\ReservaYaExiste;

/**
 * Reservas en memoria. Igual que en DynamoDB: no se crea dos veces el mismo id y el stock exige su version.
 */
class ReservasEnMemoria implements ReservaRepository
{
    /** @var array<string, Reserva> */
    public array $reservas = [];

    /** Cuántas veces simular que otro proceso cambió el stock justo antes de escribir */
    public int $conflictosSimulados = 0;

    public function __construct(private StockEnMemoria $stock) {}

    public function buscar(string $reservaId): ?Reserva
    {
        return $this->reservas[$reservaId] ?? null;
    }

    public function crear(Reserva $reserva, array $stocks): void
    {
        if (isset($this->reservas[$reserva->reservaId])) {
            throw new ReservaYaExiste;
        }
        $this->simularConflicto();
        foreach ($reserva->items as $i) {
            $this->stock->aplicar($stocks[$i->productoCodigo], 0, $i->cantidad);
        }
        $this->reservas[$reserva->reservaId] = $reserva;
    }

    public function confirmar(Reserva $reserva, array $stocks): void
    {
        $this->simularConflicto();
        foreach ($reserva->items as $i) {
            $this->stock->aplicar($stocks[$i->productoCodigo], -$i->cantidad, -$i->cantidad);
        }
        $this->reservas[$reserva->reservaId] = $reserva;
    }

    public function liberar(Reserva $reserva, array $stocks): void
    {
        $this->simularConflicto();
        foreach ($reserva->items as $i) {
            $this->stock->aplicar($stocks[$i->productoCodigo], 0, -$i->cantidad);
        }
        $this->reservas[$reserva->reservaId] = $reserva;
    }

    private function simularConflicto(): void
    {
        if ($this->conflictosSimulados > 0) {
            $this->conflictosSimulados--;
            throw new ConflictoConcurrencia;
        }
    }
}
