<?php

namespace Inventario\Entities;

/**
 * Stock de un producto en la licorería (una sola sucursal). Regla: disponible = cantidad − reservado.
 * La version sirve de bloqueo optimista: toda escritura exige que no haya cambiado desde que se leyó.
 */
final readonly class Stock
{
    public function __construct(
        public string $productoCodigo,
        public int $cantidad,
        public int $reservado,
        public int $minimo,
        public int $version,
        public bool $avisoEnviado = false,
    ) {}

    public function disponible(): int
    {
        return $this->cantidad - $this->reservado;
    }

    public function alcanzaPara(int $unidades): bool
    {
        return $this->disponible() >= $unidades;
    }

    /** ¿Al descontar estas unidades queda por debajo del mínimo? */
    public function quedaBajoMinimo(int $unidadesDescontadas): bool
    {
        return $this->cantidad - $unidadesDescontadas < $this->minimo;
    }
}
