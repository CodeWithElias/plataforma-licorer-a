<?php

namespace Inventario\Frameworks\Http;

use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Http\JsonResponse;
use Throwable;

/**
 * GET /health: estado del servicio y de su conexión a DynamoDB.
 * Va en Frameworks porque no es lógica de negocio, solo revisa la infraestructura.
 */
class HealthController
{
    public function __invoke(DynamoDbClient $dynamo): JsonResponse
    {
        try {
            $tablas = $dynamo->listTables()['TableNames'] ?? [];
            $db = ['status' => 'UP', 'tablas' => $tablas];
        } catch (Throwable $e) {
            $db = ['status' => 'DOWN', 'error' => $e->getMessage()];
        }

        $up = $db['status'] === 'UP';

        return response()->json([
            'status' => $up ? 'UP' : 'DOWN',
            'servicio' => 'ms-inventario',
            'components' => ['dynamodb' => $db],
        ], $up ? 200 : 503);
    }
}
