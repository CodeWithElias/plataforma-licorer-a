<?php

return [

    // DynamoDB: con endpoint vacío se usa AWS real (credenciales IAM del entorno)
    'dynamodb' => [
        'endpoint' => env('DYNAMODB_ENDPOINT'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Keycloak: emisor público del token y claves por la red interna
    'keycloak' => [
        'issuer' => env('KEYCLOAK_ISSUER', 'http://localhost/auth/realms/licoreria'),
        'jwks' => env('KEYCLOAK_JWKS', 'http://localhost/auth/realms/licoreria/protocol/openid-connect/certs'),
    ],

    // Aviso de stock bajo (CU06)
    'n8n_webhook_stock_bajo' => env('N8N_WEBHOOK_STOCK_BAJO'),

];
