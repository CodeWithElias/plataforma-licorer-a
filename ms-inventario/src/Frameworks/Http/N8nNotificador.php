<?php

namespace Inventario\Frameworks\Http;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inventario\UseCases\Ports\NotificadorStockBajo;
use Throwable;

/**
 * Aviso de stock bajo al webhook de n8n (CU06). Si n8n no responde no se interrumpe la venta:
 * se registra en el log y el aviso se reintenta en la siguiente confirmación.
 */
class N8nNotificador implements NotificadorStockBajo
{
    public function __construct(private ?string $url) {}

    public function notificar(string $productoCodigo, int $cantidad, int $minimo): bool
    {
        if (! $this->url) {
            return false;
        }

        try {
            Http::timeout(3)->post($this->url, compact('productoCodigo', 'cantidad', 'minimo'))->throw();

            return true;
        } catch (Throwable $e) {
            Log::warning("No se pudo avisar stock bajo de {$productoCodigo}: {$e->getMessage()}");

            return false;
        }
    }
}
