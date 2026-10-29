<?php

namespace Inventario\Frameworks\Laravel;

use Aws\DynamoDb\DynamoDbClient;
use Illuminate\Support\ServiceProvider;
use Inventario\Frameworks\Http\N8nNotificador;
use Inventario\Frameworks\Persistence\DynamoDbProductoRepository;
use Inventario\Frameworks\Persistence\DynamoDbReservaRepository;
use Inventario\Frameworks\Persistence\DynamoDbStockRepository;
use Inventario\UseCases\Ports\NotificadorStockBajo;
use Inventario\UseCases\Ports\ProductoRepository;
use Inventario\UseCases\Ports\ReservaRepository;
use Inventario\UseCases\Ports\StockRepository;

/**
 * Une las interfaces de UseCases/Ports con sus implementaciones de Frameworks.
 */
class InventarioServiceProvider extends ServiceProvider
{
    public array $singletons = [
        ProductoRepository::class => DynamoDbProductoRepository::class,
        StockRepository::class => DynamoDbStockRepository::class,
        ReservaRepository::class => DynamoDbReservaRepository::class,
    ];

    public function register(): void
    {
        $this->app->singleton(DynamoDbClient::class, function () {
            $config = [
                'region' => config('inventario.dynamodb.region'),
                'version' => 'latest',
            ];

            // DynamoDB Local; sin endpoint el SDK usa AWS real
            if ($endpoint = config('inventario.dynamodb.endpoint')) {
                $config['endpoint'] = $endpoint;
            }

            return new DynamoDbClient($config);
        });

        $this->app->singleton(NotificadorStockBajo::class, fn ($app) => new N8nNotificador(
            config('inventario.n8n_webhook_stock_bajo'), $app->make(ProductoRepository::class),
        ));
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([CargarCatalogo::class]);
        }
    }
}
