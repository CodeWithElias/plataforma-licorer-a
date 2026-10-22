<?php

namespace Inventario\UseCases;

use Inventario\Entities\Excepciones\ProductoNoEncontrado;
use Inventario\Entities\Producto;
use Inventario\UseCases\Ports\ProductoRepository;

class ObtenerProducto
{
    public function __construct(private ProductoRepository $productos) {}

    public function ejecutar(string $codigo): Producto
    {
        return $this->productos->buscar($codigo) ?? throw ProductoNoEncontrado::enCatalogo($codigo);
    }
}
