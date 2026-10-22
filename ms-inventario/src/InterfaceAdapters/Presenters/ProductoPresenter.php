<?php

namespace Inventario\InterfaceAdapters\Presenters;

use Inventario\Entities\Producto;

class ProductoPresenter
{
    public static function uno(Producto $p): array
    {
        return array_filter([
            'codigo' => $p->codigo,
            'nombre' => $p->nombre,
            'marca' => $p->marca,
            'tipo' => $p->tipo,
            'gradoAlcoholico' => $p->gradoAlcoholico,
            'volumenMl' => $p->volumenMl,
            'precio' => $p->precio,
            'etiquetaModelo' => $p->etiquetaModelo,
        ], fn ($v) => $v !== null);
    }

    /** @param list<Producto> $productos */
    public static function lista(array $productos): array
    {
        return array_map(self::uno(...), $productos);
    }
}
