<?php

namespace Inventario\InterfaceAdapters\Controllers;

use Illuminate\Http\JsonResponse;
use Inventario\InterfaceAdapters\Presenters\StockPresenter;
use Inventario\UseCases\ConsultarStock;

class StockController
{
    public function consultar(ConsultarStock $casoDeUso): JsonResponse
    {
        return response()->json(StockPresenter::lista($casoDeUso->ejecutar()));
    }
}
