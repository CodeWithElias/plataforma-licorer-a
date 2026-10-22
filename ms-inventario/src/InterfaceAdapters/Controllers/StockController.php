<?php

namespace Inventario\InterfaceAdapters\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inventario\InterfaceAdapters\Presenters\StockPresenter;
use Inventario\UseCases\ConsultarStock;

class StockController
{
    public function consultar(Request $request, ConsultarStock $casoDeUso): JsonResponse
    {
        return response()->json(StockPresenter::lista($casoDeUso->ejecutar($request->query('sucursal'))));
    }
}
