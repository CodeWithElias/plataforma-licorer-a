<?php

namespace Inventario\InterfaceAdapters\Presenters;

use Inventario\Entities\Stock;

class StockPresenter
{
    /** @param list<Stock> $stock */
    public static function lista(array $stock): array
    {
        return array_map(fn (Stock $s) => [
            'productoCodigo' => $s->productoCodigo,
            'sucursalId' => $s->sucursalId,
            'cantidad' => $s->cantidad,
            'reservado' => $s->reservado,
            'disponible' => $s->disponible(),
            'minimo' => $s->minimo,
        ], $stock);
    }
}
