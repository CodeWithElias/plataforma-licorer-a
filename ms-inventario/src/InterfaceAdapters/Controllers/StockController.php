<?php

namespace Inventario\InterfaceAdapters\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\InterfaceAdapters\Presenters\StockPresenter;
use Inventario\UseCases\ConsultarStock;
use Inventario\UseCases\ReponerStock;

class StockController
{
    public function consultar(ConsultarStock $casoDeUso): JsonResponse
    {
        return response()->json(StockPresenter::lista($casoDeUso->ejecutar()));
    }

    /** Entrada de mercadería (CU06: cierra el ciclo del aviso de stock bajo). */
    public function reponer(string $codigo, Request $request, ReponerStock $casoDeUso): JsonResponse
    {
        $cantidad = $request->input('cantidad');
        if (! is_int($cantidad)) {
            throw new DatosInvalidos('cantidad debe ser un número entero');
        }

        return response()->json(StockPresenter::uno($casoDeUso->ejecutar($codigo, $cantidad)));
    }
}
