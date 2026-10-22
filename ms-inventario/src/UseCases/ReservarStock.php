<?php

namespace Inventario\UseCases;

use DateTimeImmutable;
use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Excepciones\ProductoNoEncontrado;
use Inventario\Entities\Excepciones\SinStock;
use Inventario\Entities\ItemReserva;
use Inventario\Entities\Reserva;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\ReservaYaExiste;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Paso 2 de la Saga. Idempotente por reservaId (= operationId de la venta) y con bloqueo optimista:
 * si otro proceso cambia el stock entre la lectura y la escritura, se vuelve a leer y a evaluar.
 */
class ReservarStock
{
    public const MAX_INTENTOS = 3;

    private const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    public function __construct(
        private ReservaRepository $reservas,
        private StockRepository $stock,
    ) {}

    /**
     * @param  list<ItemReserva>  $items
     */
    public function ejecutar(string $reservaId, string $sucursalId, array $items): ResultadoReserva
    {
        if (! preg_match(self::UUID, $reservaId)) {
            throw new DatosInvalidos('reservaId debe ser un UUID');
        }

        if ($existente = $this->reservas->buscar($reservaId)) {
            return new ResultadoReserva($existente, creada: false);
        }

        $reserva = Reserva::nueva($reservaId, $sucursalId, $items, (new DateTimeImmutable)->format(DATE_ATOM));

        for ($intento = 1; $intento <= self::MAX_INTENTOS; $intento++) {
            $stocks = $this->stock->buscarVarios($reserva->sucursalId, $reserva->codigos());

            $faltantes = [];
            foreach ($reserva->items as $item) {
                $stock = $stocks[$item->productoCodigo]
                    ?? throw ProductoNoEncontrado::enSucursal($item->productoCodigo, $reserva->sucursalId);
                if (! $stock->alcanzaPara($item->cantidad)) {
                    $faltantes[] = ['productoCodigo' => $item->productoCodigo, 'pedido' => $item->cantidad, 'disponible' => $stock->disponible()];
                }
            }
            if ($faltantes !== []) {
                throw new SinStock($faltantes);
            }

            try {
                $this->reservas->crear($reserva, $stocks);

                return new ResultadoReserva($reserva, creada: true);
            } catch (ReservaYaExiste) {
                // Otra petición con el mismo id ganó la carrera
                return new ResultadoReserva($this->reservas->buscar($reservaId), creada: false);
            } catch (ConflictoConcurrencia) {
                continue;
            }
        }

        throw new ConflictoConcurrencia('El stock cambió varias veces durante la reserva; reintente');
    }
}
