#!/bin/sh
# Crea el .env de cada proyecto a partir de su .env.example (no toca los que ya existen).
# Uso (desde la raíz del monorepo):  sh infra/crear-env.sh
# Después revisa cada .env y cambia las claves de ejemplo.

cd "$(dirname "$0")/.." || exit 1

for ejemplo in */.env.example; do
  dir=$(dirname "$ejemplo")
  case "$dir" in web-shell|mfe-gestion) continue ;; esac   # Angular no lee .env (su .env.example solo documenta)
  if [ -f "$dir/.env" ]; then
    echo "  $dir/.env ya existe"
  else
    cp "$ejemplo" "$dir/.env"
    echo "  $dir/.env creado"
  fi
done

# Laravel necesita una clave propia
if grep -q '^APP_KEY=$' ms-inventario/.env 2>/dev/null; then
  clave="base64:$(head -c 32 /dev/urandom | base64)"
  sed -i "s#^APP_KEY=\$#APP_KEY=$clave#" ms-inventario/.env
  echo "  ms-inventario/.env: APP_KEY generada"
fi
