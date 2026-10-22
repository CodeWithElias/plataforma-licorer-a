<?php

namespace Inventario\Entities;

final readonly class Producto
{
    public const TIPOS = ['CERVEZA', 'VINO', 'SINGANI', 'RON', 'WHISKY', 'VODKA', 'OTRO'];

    public function __construct(
        public string $codigo,
        public string $nombre,
        public ?string $marca,
        public string $tipo,
        public float $precio,
        public string $etiquetaModelo,
        public ?float $gradoAlcoholico = null,
        public ?int $volumenMl = null,
    ) {}
}
