<?php

namespace Inventario\Frameworks\Persistence;

use Aws\DynamoDb\DynamoDbClient;
use Aws\DynamoDb\Exception\DynamoDbException;
use Aws\DynamoDb\Marshaler;
use DateTimeImmutable;
use Inventario\Entities\EstadoReserva;
use Inventario\Entities\ItemReserva;
use Inventario\Entities\Reserva;
use Inventario\Entities\Stock;
use Inventario\UseCases\Ports\ConflictoConcurrencia;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\ReservaYaExiste;

/**
 * Cada operación es un TransactWriteItems: la reserva y el stock de todos sus productos cambian juntos o no cambia nada.
 * Bloqueo optimista: cada Update del stock exige "version = la que se leyó" y la incrementa.
 */
class DynamoDbReservaRepository implements ReservaRepository
{
    private const TABLA = 'Reservas';

    private Marshaler $m;

    public function __construct(private DynamoDbClient $db)
    {
        $this->m = new Marshaler;
    }

    public function buscar(string $reservaId): ?Reserva
    {
        $r = $this->db->getItem([
            'TableName' => self::TABLA,
            'Key' => ['reservaId' => ['S' => $reservaId]],
            'ConsistentRead' => true,
        ]);

        return isset($r['Item']) ? $this->aReserva($this->m->unmarshalItem($r['Item'])) : null;
    }

    public function crear(Reserva $reserva, array $stocks): void
    {
        $operaciones = [[
            'Put' => [
                'TableName' => self::TABLA,
                'Item' => $this->m->marshalItem($this->aItem($reserva)),
                'ConditionExpression' => 'attribute_not_exists(reservaId)',   // idempotencia
            ],
        ]];
        foreach ($reserva->items as $item) {
            $operaciones[] = $this->actualizarStock($stocks[$item->productoCodigo], 'SET reservado = reservado + :c', $item->cantidad);
        }

        $motivos = $this->ejecutar($operaciones);
        if ($motivos === []) {
            return;
        }
        if (($motivos[0] ?? null) === 'ConditionalCheckFailed') {
            throw new ReservaYaExiste($reserva->reservaId);
        }
        throw new ConflictoConcurrencia('El stock cambió durante la reserva');
    }

    public function confirmar(Reserva $reserva, array $stocks): void
    {
        $this->transicion($reserva, $stocks, 'SET cantidad = cantidad - :c, reservado = reservado - :c');
    }

    public function liberar(Reserva $reserva, array $stocks): void
    {
        $this->transicion($reserva, $stocks, 'SET reservado = reservado - :c');
    }

    /** Cambia la reserva de ACTIVA al estado de $reserva y aplica $actualizacion al stock de cada ítem. */
    private function transicion(Reserva $reserva, array $stocks, string $actualizacion): void
    {
        $operaciones = [[
            'Update' => [
                'TableName' => self::TABLA,
                'Key' => ['reservaId' => ['S' => $reserva->reservaId]],
                'UpdateExpression' => 'SET estado = :nuevo, actualizadoEn = :ahora',
                'ConditionExpression' => 'estado = :activa',
                'ExpressionAttributeValues' => [
                    ':nuevo' => ['S' => $reserva->estado->value],
                    ':activa' => ['S' => EstadoReserva::Activa->value],
                    ':ahora' => ['S' => (new DateTimeImmutable)->format(DATE_ATOM)],
                ],
            ],
        ]];
        foreach ($reserva->items as $item) {
            if (! isset($stocks[$item->productoCodigo])) {
                throw new ConflictoConcurrencia("No se encontró el stock de {$item->productoCodigo}");
            }
            $operaciones[] = $this->actualizarStock($stocks[$item->productoCodigo], $actualizacion, $item->cantidad);
        }

        if ($this->ejecutar($operaciones) !== []) {
            throw new ConflictoConcurrencia("La reserva {$reserva->reservaId} o su stock cambiaron");
        }
    }

    private function actualizarStock(Stock $stock, string $actualizacion, int $cantidad): array
    {
        return [
            'Update' => [
                'TableName' => DynamoDbStockRepository::TABLA,
                'Key' => DynamoDbStockRepository::clave($stock->productoCodigo),
                'UpdateExpression' => $actualizacion.', version = version + :uno',
                'ConditionExpression' => 'version = :v',   // bloqueo optimista
                'ExpressionAttributeValues' => [
                    ':c' => ['N' => (string) $cantidad],
                    ':uno' => ['N' => '1'],
                    ':v' => ['N' => (string) $stock->version],
                ],
            ],
        ];
    }

    /**
     * @return list<string> motivos de cancelación por operación (vacío si la transacción se aplicó)
     */
    private function ejecutar(array $operaciones): array
    {
        try {
            $this->db->transactWriteItems(['TransactItems' => $operaciones]);

            return [];
        } catch (DynamoDbException $e) {
            if ($e->getAwsErrorCode() !== 'TransactionCanceledException') {
                throw $e;
            }
            $motivos = array_map(fn ($r) => $r['Code'] ?? 'None', $e->get('CancellationReasons') ?? []);
            if ($motivos === [] && preg_match('/\[(.*)\]/', (string) $e->getAwsErrorMessage(), $m)) {
                $motivos = array_map('trim', explode(',', $m[1]));   // DynamoDB Local los manda en el mensaje
            }

            return $motivos === [] ? ['Desconocido'] : $motivos;
        }
    }

    private function aItem(Reserva $r): array
    {
        return [
            'reservaId' => $r->reservaId,
            'items' => array_map(fn (ItemReserva $i) => ['productoCodigo' => $i->productoCodigo, 'cantidad' => $i->cantidad], $r->items),
            'estado' => $r->estado->value,
            'creadoEn' => $r->creadoEn,
        ];
    }

    private function aReserva(array $i): Reserva
    {
        return new Reserva(
            reservaId: $i['reservaId'],
            items: array_map(fn (array $x) => new ItemReserva($x['productoCodigo'], (int) $x['cantidad']), $i['items']),
            estado: EstadoReserva::from($i['estado']),
            creadoEn: $i['creadoEn'],
        );
    }
}
