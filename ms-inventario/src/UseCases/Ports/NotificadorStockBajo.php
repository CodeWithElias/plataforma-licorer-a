<?php

namespace Inventario\UseCases\Ports;

interface NotificadorStockBajo
{
    /** @return bool true si el aviso se entregó */
    public function notificar(string $productoCodigo, int $cantidad, int $minimo): bool;
}
