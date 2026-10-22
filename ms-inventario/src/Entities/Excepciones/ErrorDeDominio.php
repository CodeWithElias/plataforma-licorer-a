<?php

namespace Inventario\Entities\Excepciones;

use DomainException;

/**
 * Regla de negocio incumplida. El código es estable y es el que ve el cliente (ver docs/openapi.yaml).
 */
abstract class ErrorDeDominio extends DomainException
{
    abstract public function codigo(): string;
}
