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

    /**
     * Marca el aviso de stock bajo solo si no estaba marcado (escritura condicional).
     *
     * @return bool true si lo marcó este proceso: es el único que debe avisar
     */
    public function marcarAvisoEnviado(string $productoCodigo): bool;

    /** Borra la marca (el aviso no se pudo entregar y debe reintentarse). */
    public function quitarAviso(string $productoCodigo): void;

    /**
     * Guarda el stock repuesto exigiendo que la version no haya cambiado desde que se leyó.
     *
     * @throws ConflictoConcurrencia
     */
    public function reponer(Stock $leido, Stock $nuevo): void;
}
