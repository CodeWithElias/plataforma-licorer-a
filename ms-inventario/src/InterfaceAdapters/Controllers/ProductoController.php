<?php

namespace Inventario\InterfaceAdapters\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inventario\InterfaceAdapters\Presenters\ProductoPresenter;
use Inventario\UseCases\ListarProductos;
use Inventario\UseCases\ObtenerProducto;

class ProductoController
{
    public function listar(Request $request, ListarProductos $casoDeUso): JsonResponse
    {
        return response()->json(ProductoPresenter::lista($casoDeUso->ejecutar($request->query('tipo'))));
    }

    public function obtener(string $codigo, ObtenerProducto $casoDeUso): JsonResponse
    {
        return response()->json(ProductoPresenter::uno($casoDeUso->ejecutar($codigo)));
    }
}
