<?php

namespace Inventario\Frameworks\Persistence;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Marshaler;
use Inventario\Entities\Producto;
use Inventario\UseCases\Ports\ProductoRepository;

class DynamoDbProductoRepository implements ProductoRepository
{
    private const TABLA = 'Productos';

    private Marshaler $m;

    public function __construct(private DynamoDbClient $db)
    {
        $this->m = new Marshaler;
    }

    public function listar(?string $tipo = null): array
    {
        $params = ['TableName' => self::TABLA];
        if ($tipo !== null) {
            $params['FilterExpression'] = '#tipo = :tipo';
            $params['ExpressionAttributeNames'] = ['#tipo' => 'tipo'];
            $params['ExpressionAttributeValues'] = [':tipo' => ['S' => $tipo]];
        }

        $productos = [];
        foreach ($this->db->getPaginator('Scan', $params) as $pagina) {
            foreach ($pagina['Items'] as $item) {
                $productos[] = $this->aProducto($this->m->unmarshalItem($item));
            }
        }
        usort($productos, fn (Producto $a, Producto $b) => strcmp($a->codigo, $b->codigo));

        return $productos;
    }

    public function buscar(string $codigo): ?Producto
    {
        $r = $this->db->getItem([
            'TableName' => self::TABLA,
            'Key' => ['codigo' => ['S' => $codigo]],
            'ConsistentRead' => true,
        ]);

        return isset($r['Item']) ? $this->aProducto($this->m->unmarshalItem($r['Item'])) : null;
    }

    private function aProducto(array $i): Producto
    {
        return new Producto(
            codigo: $i['codigo'],
            nombre: $i['nombre'],
            marca: $i['marca'] ?? null,
            tipo: $i['tipo'],
            precio: (float) $i['precio'],
            etiquetaModelo: $i['etiquetaModelo'],
            gradoAlcoholico: isset($i['gradoAlcoholico']) ? (float) $i['gradoAlcoholico'] : null,
            volumenMl: isset($i['volumenMl']) ? (int) $i['volumenMl'] : null,
        );
    }
}
