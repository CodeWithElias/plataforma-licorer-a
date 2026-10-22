<?php

namespace Inventario\Frameworks\Http;

use Closure;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use stdClass;
use Throwable;
use UnexpectedValueException;

/**
 * Valida el token de Keycloak: firma (claves del JWKS, en caché 10 min), vencimiento y emisor.
 * Uso en rutas: ->middleware('jwt') o ->middleware('jwt:CAJERO,GERENTE') para exigir alguno de esos roles.
 * Deja los claims en $request->attributes->get('jwt').
 */
class ValidarJwt
{
    private const CACHE_JWKS = 'keycloak_jwks';

    public function handle(Request $request, Closure $next, string ...$roles): mixed
    {
        $token = $request->bearerToken();
        if (! $token) {
            return $this->rechazar(401, 'NO_AUTENTICADO', 'Falta el token (Authorization: Bearer ...)');
        }

        try {
            $claims = $this->decodificar($token);
        } catch (Throwable $e) {
            return $this->rechazar(401, 'NO_AUTENTICADO', 'Token inválido: '.$e->getMessage());
        }

        if (($claims->iss ?? null) !== config('inventario.keycloak.issuer')) {
            return $this->rechazar(401, 'NO_AUTENTICADO', 'El emisor del token no es válido');
        }

        $rolesToken = (array) ($claims->realm_access->roles ?? []);
        if ($roles !== [] && array_intersect($roles, $rolesToken) === []) {
            return $this->rechazar(403, 'SIN_PERMISO', 'Se requiere el rol '.implode(' o ', $roles));
        }

        $request->attributes->set('jwt', $claims);

        return $next($request);
    }

    private function decodificar(string $token): stdClass
    {
        JWT::$leeway = 30;

        try {
            return JWT::decode($token, $this->claves());
        } catch (UnexpectedValueException $e) {
            // Keycloak rotó las claves: se vuelve a descargar el JWKS una vez
            if (! str_contains($e->getMessage(), 'kid')) {
                throw $e;
            }
            Cache::forget(self::CACHE_JWKS);

            return JWT::decode($token, $this->claves());
        }
    }

    private function claves(): array
    {
        $jwks = Cache::remember(self::CACHE_JWKS, 600, function () {
            $respuesta = Http::timeout(5)->get(config('inventario.keycloak.jwks'))->throw()->json();
            // Solo las claves de firma (Keycloak publica también una de cifrado)
            $respuesta['keys'] = array_values(array_filter($respuesta['keys'] ?? [], fn ($k) => ($k['use'] ?? 'sig') === 'sig'));

            return $respuesta;
        });

        return JWK::parseKeySet($jwks, 'RS256');
    }

    private function rechazar(int $estado, string $codigo, string $mensaje): JsonResponse
    {
        return response()->json(['codigo' => $codigo, 'mensaje' => $mensaje], $estado);
    }
}
