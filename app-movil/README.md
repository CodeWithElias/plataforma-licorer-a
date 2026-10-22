# app-movil

App móvil de la Plataforma Licorería: escanea productos con la cámara y un modelo TFLite local, y consulta catálogo y stock sin internet (CU04).

| | |
|---|---|
| Dueño | Dev 3 |
| Tecnología | Flutter (Android e iOS) |
| Compose | No va en Docker: corre en el celular o emulador y apunta a `http://<IP de la PC>/` |
| Base local | `lib/db/esquema.sql` (SQLite) |
| Login | Keycloak, cliente `app-movil` (PKCE), redirect `com.licoreria.app:/oauth2redirect` |

## Correrlo

1. Levantar el sistema en la PC (desde la raíz): `docker compose up -d`
2. Ejecutar la app pasando la dirección de la PC:

```sh
flutter pub get
cp .env.example .env                           # pon en API_URL la IP de tu PC (emulador Android: http://10.0.2.2)
flutter run --dart-define-from-file=.env
```

También se puede pasar una sola variable: `flutter run --dart-define=API_URL=http://192.168.1.10`.

> Desde el celular, Keycloak emite tokens con `iss = http://localhost/auth/...`. Antes de integrar el login hay que decidir con Dev 1 si `KC_HOSTNAME` pasa a ser la IP de la PC.

## Pruebas

```sh
flutter test
```

## Estado

Esqueleto: pantalla inicial. Pendiente: flutter_appauth, cámara + tflite_flutter, SQLite (sqflite) con el esquema.
