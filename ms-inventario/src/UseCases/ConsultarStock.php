<?php

namespace Inventario\UseCases;

use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\StockRepository;

class ConsultarStock
{
    public function __construct(private StockRepository $stock) {}

    /** @return list<Stock> */
    public function ejecutar(): array
    {
        return $this->stock->todos();
    }
}
