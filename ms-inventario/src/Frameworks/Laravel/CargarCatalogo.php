<?php

namespace Inventario\Frameworks\Laravel;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Aws\DynamoDb\Marshaler;
use Illuminate\Console\Command;

/**
 * php artisan inventario:seed            inserta los productos y el stock que falten (no pisa lo existente)
 * php artisan inventario:seed --forzar   vuelve a dejar productos y stock como están aquí
 *
 * Se ejecuta al arrancar el contenedor, así el catálogo siempre está disponible.
 */
class CargarCatalogo extends Command
{
    protected $signature = 'inventario:seed {--forzar : Sobrescribe productos y stock existentes}';

    protected $description = 'Carga los 20 productos de ejemplo y su stock en SUC-01 y SUC-02';

    private const SUCURSALES = ['SUC-01', 'SUC-02'];

    /** codigo, nombre, marca, tipo, grado, ml, precio, etiqueta, cantidad SUC-01, mínimo */
    private const PRODUCTOS = [
        ['CER-001', 'Cerveza Paceña 620 ml', 'Paceña', 'CERVEZA', 4.8, 620, 12.00, 'pacena_620', 48, 12],
        ['CER-002', 'Cerveza Paceña Lata 355 ml', 'Paceña', 'CERVEZA', 4.8, 355, 8.00, 'pacena_lata', 72, 24],
        ['CER-003', 'Cerveza Huari 620 ml', 'Huari', 'CERVEZA', 5.0, 620, 14.00, 'huari_620', 36, 12],
        ['CER-004', 'Cerveza Potosina 620 ml', 'Potosina', 'CERVEZA', 4.9, 620, 11.00, 'potosina_620', 24, 12],
        ['CER-005', 'Cerveza Taquiña 620 ml', 'Taquiña', 'CERVEZA', 5.0, 620, 12.00, 'taquina_620', 14, 12],
        ['VIN-001', 'Vino Kohlberg Tinto 750 ml', 'Kohlberg', 'VINO', 12.5, 750, 45.00, 'kohlberg_tinto', 20, 6],
        ['VIN-002', 'Vino Aranjuez Cabernet 750 ml', 'Aranjuez', 'VINO', 13.0, 750, 65.00, 'aranjuez_cabernet', 15, 5],
        ['VIN-003', 'Vino Campos de Solana Tannat 750 ml', 'Campos de Solana', 'VINO', 13.5, 750, 85.00, 'solana_tannat', 10, 4],
        ['SIN-001', 'Singani Casa Real Etiqueta Negra 750 ml', 'Casa Real', 'SINGANI', 40.0, 750, 95.00, 'casareal_negra', 18, 6],
        ['SIN-002', 'Singani Rujero 750 ml', 'Rujero', 'SINGANI', 40.0, 750, 120.00, 'rujero_750', 8, 4],
        ['SIN-003', 'Singani Los Parrales 750 ml', 'Los Parrales', 'SINGANI', 40.0, 750, 60.00, 'parrales_750', 22, 6],
        ['RON-001', 'Ron Havana Club 3 Años 750 ml', 'Havana Club', 'RON', 40.0, 750, 110.00, 'havana_3', 12, 4],
        ['RON-002', 'Ron Abuelo Añejo 750 ml', 'Abuelo', 'RON', 37.5, 750, 130.00, 'abuelo_anejo', 9, 3],
        ['WHI-001', 'Whisky Johnnie Walker Red Label 750 ml', 'Johnnie Walker', 'WHISKY', 40.0, 750, 180.00, 'jw_red', 10, 3],
        ['WHI-002', 'Whisky Johnnie Walker Black Label 750 ml', 'Johnnie Walker', 'WHISKY', 40.0, 750, 320.00, 'jw_black', 6, 2],
        ['WHI-003', 'Whisky Chivas Regal 12 Años 750 ml', 'Chivas Regal', 'WHISKY', 40.0, 750, 350.00, 'chivas_12', 5, 2],
        ['VOD-001', 'Vodka Absolut 750 ml', 'Absolut', 'VODKA', 40.0, 750, 150.00, 'absolut_750', 12, 4],
        ['VOD-002', 'Vodka Smirnoff 750 ml', 'Smirnoff', 'VODKA', 37.5, 750, 90.00, 'smirnoff_750', 16, 4],
        ['OTR-001', 'Fernet Branca 750 ml', 'Branca', 'OTRO', 39.0, 750, 115.00, 'fernet_branca', 14, 4],
        ['OTR-002', 'Licor Amarula 750 ml', 'Amarula', 'OTRO', 17.0, 750, 140.00, 'amarula_750', 7, 2],
    ];

    public function handle(DynamoDbClient $db): int
    {
        $m = new Marshaler;
        $forzar = (bool) $this->option('forzar');
        $productos = $stock = 0;

        foreach (self::PRODUCTOS as [$codigo, $nombre, $marca, $tipo, $grado, $ml, $precio, $etiqueta, $cantidad, $minimo]) {
            $productos += $this->poner($db, 'Productos', $m->marshalItem([
                'codigo' => $codigo, 'nombre' => $nombre, 'marca' => $marca, 'tipo' => $tipo,
                'gradoAlcoholico' => $grado, 'volumenMl' => $ml, 'precio' => $precio, 'etiquetaModelo' => $etiqueta,
            ]), 'codigo', $forzar);

            foreach (self::SUCURSALES as $i => $sucursal) {
                $stock += $this->poner($db, 'Stock', $m->marshalItem([
                    'productoCodigo' => $codigo, 'sucursalId' => $sucursal,
                    'cantidad' => $i === 0 ? $cantidad : intdiv($cantidad, 2) + $minimo,
                    'reservado' => 0, 'minimo' => $minimo, 'version' => 1, 'avisoEnviado' => false,
                ]), 'productoCodigo', $forzar);
            }
        }

        $this->info("Catálogo listo: {$productos} productos y {$stock} registros de stock nuevos".($forzar ? ' (forzado)' : ''));

        return self::SUCCESS;
    }

    /** @return int 1 si se escribió, 0 si ya existía */
    private function poner(DynamoDbClient $db, string $tabla, array $item, string $clave, bool $forzar): int
    {
        $params = ['TableName' => $tabla, 'Item' => $item];
        if (! $forzar) {
            $params['ConditionExpression'] = "attribute_not_exists({$clave})";
        }

        try {
            $db->putItem($params);

            return 1;
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() === 'ConditionalCheckFailedException') {
                return 0;
            }
            throw $e;
        }
    }
}
