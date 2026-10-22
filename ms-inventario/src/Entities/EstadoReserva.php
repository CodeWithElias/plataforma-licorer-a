<?php

namespace Inventario\Entities;

enum EstadoReserva: string
{
    case Activa = 'ACTIVA';
    case Confirmada = 'CONFIRMADA';
    case Liberada = 'LIBERADA';
}
