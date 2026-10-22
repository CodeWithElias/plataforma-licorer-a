<?php

namespace Tests\Unit\Dobles;

use Inventario\UseCases\Ports\NotificadorStockBajo;

/** Registra los avisos de stock bajo en lugar de llamar a n8n. */
class NotificadorEspia implements NotificadorStockBajo
{
    /** @var list<array> */
    public array $avisos = [];

    public function notificar(string $productoCodigo, string $sucursalId, int $cantidad, int $minimo): bool
    {
        $this->avisos[] = compact('productoCodigo', 'sucursalId', 'cantidad', 'minimo');

        return true;
    }
}
