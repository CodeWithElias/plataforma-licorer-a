<?php

namespace Inventario\InterfaceAdapters\Presenters;

use Inventario\Entities\Stock;

class StockPresenter
{
    /** @param list<Stock> $stock */
    public static function lista(array $stock): array
    {
        return array_map(self::uno(...), $stock);
    }

    public static function uno(Stock $s): array
    {
        return [
            'productoCodigo' => $s->productoCodigo,
            'cantidad' => $s->cantidad,
            'reservado' => $s->reservado,
            'disponible' => $s->disponible(),
            'minimo' => $s->minimo,
            'bajoMinimo' => $s->cantidad < $s->minimo,
            'avisoEnviado' => $s->avisoEnviado,
        ];
    }
}
