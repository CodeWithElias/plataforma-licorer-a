<?php

namespace Inventario\UseCases\Ports;

use Inventario\Entities\Stock;

interface StockRepository
{
    /** @return list<Stock> ordenados por código de producto */
    public function todos(): array;

    /**
     * Lectura consistente del stock de varios productos.
     *
     * @param  list<string>  $codigos
     * @return array<string, Stock> por código de producto; los que no existen no aparecen
     */
    public function buscarVarios(array $codigos): array;

    public function marcarAvisoEnviado(string $productoCodigo): void;
}
