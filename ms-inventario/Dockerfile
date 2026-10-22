# --- Dependencias ---
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-scripts

# --- Ejecución ---
FROM php:8.4-cli
WORKDIR /app
COPY --from=vendor /app /app
# Sin .env en la imagen: la configuración (APP_KEY incluida) la da el compose desde ms-inventario/.env
RUN php artisan package:discover
# Servidor de PHP directo (artisan serve se cuelga en Docker e ignora los workers)
ENV PHP_CLI_SERVER_WORKERS=4
EXPOSE 8000
# Carga el catálogo que falte y arranca el servidor
CMD ["sh", "-c", "php artisan inventario:seed && exec php -S 0.0.0.0:8000 -t public public/index.php"]
