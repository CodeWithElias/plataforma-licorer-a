<?php

namespace Inventario\InterfaceAdapters\Presenters;

use Inventario\Entities\ItemReserva;
use Inventario\Entities\Reserva;

class ReservaPresenter
{
    public static function uno(Reserva $r): array
    {
        return [
            'reservaId' => $r->reservaId,
            'sucursalId' => $r->sucursalId,
            'items' => array_map(fn (ItemReserva $i) => ['productoCodigo' => $i->productoCodigo, 'cantidad' => $i->cantidad], $r->items),
            'estado' => $r->estado->value,
            'creadoEn' => $r->creadoEn,
        ];
    }
}
