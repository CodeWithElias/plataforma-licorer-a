<?php

namespace Inventario\UseCases;

use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Producto;
use Inventario\UseCases\Ports\ProductoRepository;

class ListarProductos
{
    public function __construct(private ProductoRepository $productos) {}

    /** @return list<Producto> */
    public function ejecutar(?string $tipo = null): array
    {
        if ($tipo !== null && ! in_array($tipo, Producto::TIPOS, true)) {
            throw new DatosInvalidos('tipo debe ser uno de: '.implode(', ', Producto::TIPOS));
        }

        return $this->productos->listar($tipo);
    }
}
