<?php

namespace Inventario\Frameworks\Http;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inventario\UseCases\Ports\NotificadorStockBajo;
use Inventario\UseCases\Ports\ProductoRepository;
use Throwable;

/**
 * Aviso de stock bajo al webhook de n8n (CU06): POST {productoCodigo, nombre, cantidad, minimo, fecha}.
 * Si n8n no responde no se interrumpe la venta: se registra en el log y el aviso se reintenta en la siguiente
 * confirmación.
 */
class N8nNotificador implements NotificadorStockBajo
{
    public function __construct(private ?string $url, private ProductoRepository $productos) {}

    public function notificar(string $productoCodigo, int $cantidad, int $minimo): bool
    {
        if (! $this->url) {
            return false;
        }

        try {
            Http::timeout(3)->post($this->url, [
                'productoCodigo' => $productoCodigo,
                'nombre' => $this->nombre($productoCodigo),
                'cantidad' => $cantidad,
                'minimo' => $minimo,
                'fecha' => now()->toIso8601String(),
            ])->throw();

            return true;
        } catch (Throwable $e) {
            Log::warning("No se pudo avisar stock bajo de {$productoCodigo}: {$e->getMessage()}");

            return false;
        }
    }

    /** El nombre es solo para el correo; si el catálogo falla se avisa igual con el código. */
    private function nombre(string $codigo): string
    {
        try {
            return $this->productos->buscar($codigo)?->nombre ?? $codigo;
        } catch (Throwable) {
            return $codigo;
        }
    }
}
