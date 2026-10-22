<?php

namespace Inventario\UseCases;

use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\StockRepository;

class ConsultarStock
{
    public function __construct(private StockRepository $stock) {}

    /** @return list<Stock> */
    public function ejecutar(?string $sucursalId): array
    {
        if ($sucursalId === null || trim($sucursalId) === '') {
            throw new DatosInvalidos('El parámetro sucursal es obligatorio');
        }

        return $this->stock->porSucursal($sucursalId);
    }
}
