<?php

namespace Inventario\Entities;

use Inventario\Entities\Excepciones\DatosInvalidos;

final readonly class ItemReserva
{
    public function __construct(
        public string $productoCodigo,
        public int $cantidad,
    ) {
        if (trim($productoCodigo) === '') {
            throw new DatosInvalidos('productoCodigo es obligatorio');
        }
        if ($cantidad < 1) {
            throw new DatosInvalidos("La cantidad de {$productoCodigo} debe ser al menos 1");
        }
    }
}
