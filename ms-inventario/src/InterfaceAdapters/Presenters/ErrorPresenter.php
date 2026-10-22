<?php

namespace Inventario\InterfaceAdapters\Presenters;

use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Excepciones\ErrorDeDominio;
use Inventario\Entities\Excepciones\ProductoNoEncontrado;
use Inventario\Entities\Excepciones\ReservaNoEncontrada;
use Inventario\Entities\Excepciones\SinStock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Throwable;

/**
 * Traduce los errores de negocio al formato del contrato: { codigo, mensaje } y su código HTTP.
 */
class ErrorPresenter
{
    /** @return array{0: int, 1: array}|null null si no es un error conocido */
    public static function presentar(Throwable $e): ?array
    {
        if ($e instanceof ConflictoConcurrencia) {
            // 5xx: ms-ventas lo reintenta
            return [503, ['codigo' => 'ERROR_INTERNO', 'mensaje' => $e->getMessage()]];
        }
        if (! $e instanceof ErrorDeDominio) {
            return null;
        }

        $cuerpo = ['codigo' => $e->codigo(), 'mensaje' => $e->getMessage()];
        if ($e instanceof SinStock) {
            $cuerpo['faltantes'] = $e->faltantes;
        }

        $estado = match (true) {
            $e instanceof DatosInvalidos => 400,
            $e instanceof ProductoNoEncontrado, $e instanceof ReservaNoEncontrada => 404,
            default => 409,   // SIN_STOCK, RESERVA_LIBERADA, RESERVA_CONFIRMADA
        };

        return [$estado, $cuerpo];
    }
}
