<?php

namespace Inventario\Entities\Excepciones;

class ProductoNoEncontrado extends ErrorDeDominio
{
    public static function enCatalogo(string $codigo): self
    {
        return new self("No existe el producto {$codigo}");
    }

    public static function sinStock(string $codigo): self
    {
        return new self("{$codigo} no tiene stock registrado");
    }

    public function codigo(): string
    {
        return 'PRODUCTO_NO_ENCONTRADO';
    }
}
