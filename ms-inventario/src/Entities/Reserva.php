<?php

namespace Inventario\Entities;

use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Excepciones\ReservaConfirmada;
use Inventario\Entities\Excepciones\ReservaLiberada;

/**
 * Reserva de stock de una venta. Su id es el operationId de la venta.
 * Transiciones: ACTIVA → CONFIRMADA (venta completada) o ACTIVA → LIBERADA (compensación).
 */
final readonly class Reserva
{
    /**
     * @param list<ItemReserva> $items
     */
    public function __construct(
        public string $reservaId,
        public string $sucursalId,
        public array $items,
        public EstadoReserva $estado,
        public string $creadoEn,
    ) {}

    /**
     * @param list<ItemReserva> $items Si un producto se repite, se suman sus cantidades.
     */
    public static function nueva(string $reservaId, string $sucursalId, array $items, string $ahora): self
    {
        if (trim($sucursalId) === '') {
            throw new DatosInvalidos('sucursalId es obligatorio');
        }
        if ($items === []) {
            throw new DatosInvalidos('items debe tener al menos un elemento');
        }

        $porProducto = [];
        foreach ($items as $item) {
            $porProducto[$item->productoCodigo] = ($porProducto[$item->productoCodigo] ?? 0) + $item->cantidad;
        }
        $unidos = [];
        foreach ($porProducto as $codigo => $cantidad) {
            $unidos[] = new ItemReserva((string) $codigo, $cantidad);
        }

        return new self($reservaId, $sucursalId, $unidos, EstadoReserva::Activa, $ahora);
    }

    public function confirmar(): self
    {
        return match ($this->estado) {
            EstadoReserva::Activa => $this->conEstado(EstadoReserva::Confirmada),
            EstadoReserva::Confirmada => $this,
            EstadoReserva::Liberada => throw new ReservaLiberada($this->reservaId),
        };
    }

    public function liberar(): self
    {
        return match ($this->estado) {
            EstadoReserva::Activa => $this->conEstado(EstadoReserva::Liberada),
            EstadoReserva::Liberada => $this,
            EstadoReserva::Confirmada => throw new ReservaConfirmada($this->reservaId),
        };
    }

    /** @return list<string> */
    public function codigos(): array
    {
        return array_map(fn (ItemReserva $i) => $i->productoCodigo, $this->items);
    }

    private function conEstado(EstadoReserva $estado): self
    {
        return new self($this->reservaId, $this->sucursalId, $this->items, $estado, $this->creadoEn);
    }
}
