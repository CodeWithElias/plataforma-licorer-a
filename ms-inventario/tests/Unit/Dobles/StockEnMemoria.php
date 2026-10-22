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
    /** @var array<string, Stock> por "codigo|sucursal" */
    public array $stock = [];

    public function poner(string $codigo, int $cantidad, int $minimo = 0, int $reservado = 0, string $sucursal = 'SUC-01'): void
    {
        $this->stock["{$codigo}|{$sucursal}"] = new Stock($codigo, $sucursal, $cantidad, $reservado, $minimo, 1);
    }

    public function de(string $codigo, string $sucursal = 'SUC-01'): Stock
    {
        return $this->stock["{$codigo}|{$sucursal}"];
    }

    public function porSucursal(string $sucursalId): array
    {
        return array_values(array_filter($this->stock, fn (Stock $s) => $s->sucursalId === $sucursalId));
    }

    public function buscarVarios(string $sucursalId, array $codigos): array
    {
        $r = [];
        foreach ($codigos as $c) {
            if (isset($this->stock["{$c}|{$sucursalId}"])) {
                $r[$c] = $this->stock["{$c}|{$sucursalId}"];
            }
        }

        return $r;
    }

    public function marcarAvisoEnviado(string $productoCodigo, string $sucursalId): void
    {
        $s = $this->de($productoCodigo, $sucursalId);
        $this->stock["{$productoCodigo}|{$sucursalId}"] = new Stock($s->productoCodigo, $s->sucursalId, $s->cantidad, $s->reservado, $s->minimo, $s->version, true);
    }

    /** Aplica un cambio exigiendo que la version no haya cambiado (bloqueo optimista). */
    public function aplicar(Stock $leido, int $deltaCantidad, int $deltaReservado): void
    {
        $actual = $this->de($leido->productoCodigo, $leido->sucursalId);
        if ($actual->version !== $leido->version) {
            throw new ConflictoConcurrencia;
        }
        $this->stock["{$leido->productoCodigo}|{$leido->sucursalId}"] = new Stock(
            $actual->productoCodigo, $actual->sucursalId, $actual->cantidad + $deltaCantidad,
            $actual->reservado + $deltaReservado, $actual->minimo, $actual->version + 1, $actual->avisoEnviado,
        );
    }
}
