<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inventario\Frameworks\Http\ValidarJwt;
use Inventario\InterfaceAdapters\Presenters\ErrorPresenter;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['jwt' => ValidarJwt::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Es una API: los errores siempre se responden en JSON con el formato del contrato
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => true);

        $exceptions->render(function (Throwable $e) {
            if ($error = ErrorPresenter::presentar($e)) {
                [$estado, $cuerpo] = $error;

                return response()->json($cuerpo, $estado);
            }
        });
        $exceptions->render(fn (NotFoundHttpException $e) => response()->json(
            ['codigo' => 'NO_ENCONTRADO', 'mensaje' => 'Ruta no encontrada'], 404,
        ));
        $exceptions->render(fn (MethodNotAllowedHttpException $e) => response()->json(
            ['codigo' => 'NO_ENCONTRADO', 'mensaje' => 'Método no permitido en esta ruta'], 405,
        ));
        $exceptions->dontReport([\Inventario\Entities\Excepciones\ErrorDeDominio::class]);
    })->create();
