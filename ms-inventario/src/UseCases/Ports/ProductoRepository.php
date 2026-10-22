<?php

namespace Inventario\UseCases\Ports;

use Inventario\Entities\Producto;

interface ProductoRepository
{
    /** @return list<Producto> ordenados por código */
    public function listar(?string $tipo = null): array;

    public function buscar(string $codigo): ?Producto;
}
