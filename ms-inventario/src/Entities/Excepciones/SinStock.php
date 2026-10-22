<?php

namespace Inventario\Entities\Excepciones;

class SinStock extends ErrorDeDominio
{
    /**
     * @param list<array{productoCodigo: string, pedido: int, disponible: int}> $faltantes
     */
    public function __construct(public readonly array $faltantes)
    {
        parent::__construct('No hay stock suficiente');
    }

    public function codigo(): string
    {
        return 'SIN_STOCK';
    }
}
