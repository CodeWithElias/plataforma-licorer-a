<?php

namespace Inventario\UseCases;

use Inventario\Entities\Excepciones\DatosInvalidos;
use Inventario\Entities\Excepciones\ProductoNoEncontrado;
use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Entrada de mercadería: suma unidades al stock. Si el producto vuelve a quedar en o sobre el mínimo, borra la
 * marca del aviso de stock bajo para que n8n se entere la próxima vez que baje.
 */
class ReponerStock
{
    public const MAX_INTENTOS = 3;

    public function __construct(private StockRepository $stock) {}

    public function ejecutar(string $productoCodigo, int $unidades): Stock
    {
        if ($unidades < 1) {
            throw new DatosInvalidos('La cantidad a reponer debe ser al menos 1');
        }
        $codigo = strtoupper(trim($productoCodigo));

        for ($intento = 1; $intento <= self::MAX_INTENTOS; $intento++) {
            $leido = $this->stock->buscarVarios([$codigo])[$codigo] ?? throw ProductoNoEncontrado::sinStock($codigo);
            $nuevo = $leido->reponer($unidades);
            try {
                $this->stock->reponer($leido, $nuevo);

                return $nuevo;
            } catch (ConflictoConcurrencia) {
                continue;   // una venta cambió el stock justo ahora: se vuelve a leer
            }
        }

        throw new ConflictoConcurrencia('No se pudo reponer el stock por cambios concurrentes; reintente');
    }
}
