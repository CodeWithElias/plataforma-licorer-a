<?php

namespace Inventario\Frameworks\Persistence;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Marshaler;
use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\StockRepository;

class DynamoDbStockRepository implements StockRepository
{
    public const TABLA = 'Stock';

    private Marshaler $m;

    public function __construct(private DynamoDbClient $db)
    {
        $this->m = new Marshaler;
    }

    public function todos(): array
    {
        $stock = [];
        foreach ($this->db->getPaginator('Scan', ['TableName' => self::TABLA]) as $pagina) {
            foreach ($pagina['Items'] as $item) {
                $stock[] = self::aStock($this->m->unmarshalItem($item));
            }
        }
        usort($stock, fn (Stock $a, Stock $b) => strcmp($a->productoCodigo, $b->productoCodigo));

        return $stock;
    }

    public function buscarVarios(array $codigos): array
    {
        $stock = [];
        foreach (array_unique($codigos) as $codigo) {
            $r = $this->db->getItem([
                'TableName' => self::TABLA,
                'Key' => self::clave($codigo),
                'ConsistentRead' => true,
            ]);
            if (isset($r['Item'])) {
                $stock[$codigo] = self::aStock($this->m->unmarshalItem($r['Item']));
            }
        }

        return $stock;
    }

    public function marcarAvisoEnviado(string $productoCodigo): void
    {
        $this->db->updateItem([
            'TableName' => self::TABLA,
            'Key' => self::clave($productoCodigo),
            'UpdateExpression' => 'SET avisoEnviado = :si',
            'ExpressionAttributeValues' => [':si' => ['BOOL' => true]],
        ]);
    }

    public static function clave(string $productoCodigo): array
    {
        return ['productoCodigo' => ['S' => $productoCodigo]];
    }

    private static function aStock(array $i): Stock
    {
        return new Stock(
            productoCodigo: $i['productoCodigo'],
            cantidad: (int) $i['cantidad'],
            reservado: (int) $i['reservado'],
            minimo: (int) $i['minimo'],
            version: (int) ($i['version'] ?? 1),
            avisoEnviado: (bool) ($i['avisoEnviado'] ?? false),
        );
    }
}
