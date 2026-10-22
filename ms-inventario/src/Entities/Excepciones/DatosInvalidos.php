<?php

namespace Inventario\Entities\Excepciones;

class DatosInvalidos extends ErrorDeDominio
{
    public function codigo(): string
    {
        return 'DATOS_INVALIDOS';
    }
}
