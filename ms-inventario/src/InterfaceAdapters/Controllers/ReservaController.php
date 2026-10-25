<?php

namespace Inventario\InterfaceAdapters\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\ItemReserva;
use Inventario\InterfaceAdapters\Presenters\ReservaPresenter;
use Inventario\UseCases\ConfirmarReserva;
use Inventario\UseCases\LiberarStock;
use Inventario\UseCases\ObtenerReserva;
use Inventario\UseCases\ReservarStock;

class ReservaController
{
    public function reservar(Request $request, ReservarStock $casoDeUso): JsonResponse
    {
        $items = $request->input('items');
        if (! is_array($items) || ! array_is_list($items)) {
            throw new DatosInvalidos('items debe ser una lista');
        }

        $resultado = $casoDeUso->ejecutar(
            $this->texto($request->input('reservaId'), 'reservaId'),
            array_map(fn ($i) => new ItemReserva(
                $this->texto($i['productoCodigo'] ?? null, 'productoCodigo'),
                $this->entero($i['cantidad'] ?? null, 'cantidad'),
            ), $items),
        );

        return response()->json(ReservaPresenter::uno($resultado->reserva), $resultado->creada ? 201 : 200);
    }

    public function obtener(string $reservaId, ObtenerReserva $casoDeUso): JsonResponse
    {
        return response()->json(ReservaPresenter::uno($casoDeUso->ejecutar($reservaId)));
    }

    public function confirmar(string $reservaId, ConfirmarReserva $casoDeUso): JsonResponse
    {
        return response()->json(ReservaPresenter::uno($casoDeUso->ejecutar($reservaId)));
    }

    public function liberar(string $reservaId, LiberarStock $casoDeUso): JsonResponse
    {
        return response()->json(ReservaPresenter::uno($casoDeUso->ejecutar($reservaId)));
    }

    private function texto(mixed $valor, string $campo): string
    {
        if (! is_string($valor) || trim($valor) === '') {
            throw new DatosInvalidos("{$campo} es obligatorio");
        }

        return $valor;
    }

    private function entero(mixed $valor, string $campo): int
    {
        if (! is_int($valor)) {
            throw new DatosInvalidos("{$campo} debe ser un número entero");
        }

        return $valor;
    }
}
