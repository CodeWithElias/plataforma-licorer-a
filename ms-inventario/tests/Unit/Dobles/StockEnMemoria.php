<?php

namespace Tests\Unit\Dobles;

use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Stock en memoria para probar los casos de uso sin DynamoDB.
 * Reproduce la misma condición que la implementación real (version = la leída).
 */
class StockEnMemoria implements StockRepository
{
    /** @var array<string, Stock> por código de producto */
    public array $stock = [];

    public function poner(string $codigo, int $cantidad, int $minimo = 0, int $reservado = 0): void
    {
        $this->stock[$codigo] = new Stock($codigo, $cantidad, $reservado, $minimo, 1);
    }

    public function de(string $codigo): Stock
    {
        return $this->stock[$codigo];
    }

    public function todos(): array
    {
        return array_values($this->stock);
    }

    public function buscarVarios(array $codigos): array
    {
        return array_intersect_key($this->stock, array_flip($codigos));
    }

    public function marcarAvisoEnviado(string $productoCodigo): void
    {
        $s = $this->de($productoCodigo);
        $this->stock[$productoCodigo] = new Stock($s->productoCodigo, $s->cantidad, $s->reservado, $s->minimo, $s->version, true);
    }

    /** Aplica un cambio exigiendo que la version no haya cambiado (bloqueo optimista). */
    public function aplicar(Stock $leido, int $deltaCantidad, int $deltaReservado): void
    {
        $actual = $this->de($leido->productoCodigo);
        if ($actual->version !== $leido->version) {
            throw new ConflictoConcurrencia;
        }
        $this->stock[$leido->productoCodigo] = new Stock(
            $actual->productoCodigo, $actual->cantidad + $deltaCantidad,
            $actual->reservado + $deltaReservado, $actual->minimo, $actual->version + 1, $actual->avisoEnviado,
        );
    }
}
