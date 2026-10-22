<?php

namespace Inventario\UseCases\Ports;

use Inventario\Entities\Stock;

interface StockRepository
{
    /** @return list<Stock> ordenados por código de producto */
    public function porSucursal(string $sucursalId): array;

    /**
     * Lectura consistente del stock de varios productos de una sucursal.
     *
     * @param  list<string>  $codigos
     * @return array<string, Stock> por código de producto; los que no existen no aparecen
     */
    public function buscarVarios(string $sucursalId, array $codigos): array;

    public function marcarAvisoEnviado(string $productoCodigo, string $sucursalId): void;
}
