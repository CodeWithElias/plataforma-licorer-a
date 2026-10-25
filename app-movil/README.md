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

> **Pendiente para probar el login en un dispositivo:** Keycloak publica su URL como `http://localhost/auth` (`KC_HOSTNAME`), así que la pantalla de login abierta desde el celular intenta volver a `localhost` y falla. Para la demo hay que poner en `KC_HOSTNAME` la dirección de la PC (p. ej. `http://192.168.1.10/auth`) y la misma en `KEYCLOAK_ISSUER` de cada servicio, y abrir la web también con esa dirección. Se decide en la integración de CU04 (semana 3).

## Pruebas

```sh
flutter test
```

## Estado

| Función | Estado |
|---|---|
| Login con Keycloak (`flutter_appauth`, PKCE; endpoints armados con `API_URL`) | ✅ Semana 2 (`lib/servicios/sesion.dart`) |
| Inicio con usuario y roles | ✅ Semana 2 |
| Vista de cámara → foto → `POST /api/ia/imagen/clasificar` | ✅ Semana 2 (`lib/pantallas/camara_page.dart`) |
| Clasificación en el teléfono con TFLite (`tflite_flutter`) y catálogo/stock en SQLite sin internet | Semana 3 (CU04) |

Configuración nativa ya hecha: esquema de redirección `com.licoreria.app` (Android `manifestPlaceholders`, iOS `CFBundleURLTypes`), permisos de cámara e internet, y tráfico HTTP permitido para la red local de desarrollo.
