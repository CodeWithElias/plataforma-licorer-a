<?php

namespace Inventario\UseCases\Ports;

use RuntimeException;

/** Otro proceso modificó el stock o la reserva entre la lectura y la escritura (bloqueo optimista). */
class ConflictoConcurrencia extends RuntimeException {}
