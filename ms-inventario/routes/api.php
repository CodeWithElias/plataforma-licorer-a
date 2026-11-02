<?php

use Illuminate\Support\Facades\Route;
use Inventario\Frameworks\Http\HealthController;
use Inventario\InterfaceAdapters\Controllers\ProductoController;
use Inventario\InterfaceAdapters\Controllers\ReservaController;
use Inventario\InterfaceAdapters\Controllers\StockController;

// Sin prefijo: Nginx publica este servicio en /api/inventario/. Contrato: docs/openapi.yaml

Route::get('/health', HealthController::class);

Route::middleware('jwt')->group(function () {
    Route::get('/productos', [ProductoController::class, 'listar']);
    Route::get('/productos/{codigo}', [ProductoController::class, 'obtener']);
});

Route::get('/stock', [StockController::class, 'consultar'])->middleware('jwt:GERENTE,ALMACEN');
Route::post('/stock/{codigo}/reposiciones', [StockController::class, 'reponer'])->middleware('jwt:ALMACEN,GERENTE');

// Reservas: las llama ms-ventas reenviando el token del cajero
Route::post('/stock/reservas', [ReservaController::class, 'reservar'])->middleware('jwt:CAJERO');
Route::get('/stock/reservas/{reservaId}', [ReservaController::class, 'obtener'])->middleware('jwt:CAJERO,GERENTE');
Route::post('/stock/reservas/{reservaId}/confirmar', [ReservaController::class, 'confirmar'])->middleware('jwt:CAJERO');
Route::delete('/stock/reservas/{reservaId}', [ReservaController::class, 'liberar'])->middleware('jwt:CAJERO');
