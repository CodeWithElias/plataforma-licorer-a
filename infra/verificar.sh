#!/bin/sh
# Verifica que todo el sistema esté funcionando.
# Uso (desde la raíz del monorepo, con el compose levantado):  sh infra/verificar.sh
# Requiere: docker y curl (en Windows, Git Bash).

cd "$(dirname "$0")/.." || exit 1

# Secretos de los clientes de Keycloak, cada uno del .env de su dueño
leer() { sed -n "s/^$2=//p" "$1" 2>/dev/null | tr -d '\r'; }
N8N_CLIENT_SECRET=$(leer n8n/.env N8N_CLIENT_SECRET)
GESTION_ADMIN_CLIENT_SECRET=$(leer ms-gestion/.env KEYCLOAK_ADMIN_CLIENT_SECRET)
[ -n "$N8N_CLIENT_SECRET" ] && [ -n "$GESTION_ADMIN_CLIENT_SECRET" ] \
  || { echo "Faltan los .env de n8n o ms-gestion (sh infra/crear-env.sh)"; exit 1; }

ok=0; fallas=0
pasa()  { echo "  [OK]    $1"; ok=$((ok + 1)); }
falla() { echo "  [FALLA] $1"; fallas=$((fallas + 1)); }
corriendo() { docker compose ps --status running --services 2>/dev/null | grep -qx "$1"; }
http() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

KC=http://localhost/auth/realms/licoreria

echo "1. Contenedores"
for s in dynamodb keycloak nginx n8n \
         ms-ventas ms-inventario ms-gestion ms-ia web-shell mfe-gestion mfe-pos; do
  corriendo "$s" && pasa "$s corriendo" || falla "$s no está corriendo (docker compose logs $s)"
done
if docker compose ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}' 2>/dev/null | grep -q '^dynamodb-init exited 0$'; then
  pasa "dynamodb-init terminó sin errores"
else
  falla "dynamodb-init no terminó bien (docker compose logs dynamodb-init)"
fi

echo "2. Bases de datos"
# PostgreSQL de ms-ventas en Supabase (credenciales de ms-ventas/.env)
tablas=$(MSYS_NO_PATHCONV=1 docker run --rm -e PGPASSWORD="$(leer ms-ventas/.env POSTGRES_PASSWORD)" postgres:16 psql \
  "host=$(leer ms-ventas/.env DB_HOST) port=$(leer ms-ventas/.env DB_PORT) dbname=$(leer ms-ventas/.env POSTGRES_DB) user=$(leer ms-ventas/.env POSTGRES_USER) sslmode=require connect_timeout=10" \
  -tAc "SELECT string_agg(table_name, ' ' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null)
for t in detalle_venta idempotency_keys pago saga_instancia venta flyway_schema_history; do
  case " $tablas " in *" $t "*) pasa "PostgreSQL (Supabase): tabla $t" ;; *) falla "PostgreSQL (Supabase): falta la tabla $t (la crea Flyway al arrancar ms-ventas)" ;; esac
done
dyn=$(docker compose run --rm --no-deps --entrypoint aws dynamodb-init \
  dynamodb list-tables --endpoint-url http://dynamodb:8000 --output text 2>/dev/null)
for t in Productos Reservas Stock; do
  echo "$dyn" | grep -qw "$t" && pasa "DynamoDB: tabla $t" || falla "DynamoDB: falta la tabla $t"
done
# MongoDB de ms-gestion en Atlas (ms-gestion/.env)
col=$(MSYS_NO_PATHCONV=1 docker run --rm mongo:7 mongosh "$(leer ms-gestion/.env MONGO_URL)" --quiet \
  --eval "db.getSiblingDB('$(leer ms-gestion/.env MONGO_DB)').getCollectionNames().sort().join(' ')" 2>/dev/null)
for c in empleados ingresos ordenes_compra proveedores reportes sucursales; do
  case " $col " in *" $c "*) pasa "MongoDB (Atlas): colección $c" ;; *) falla "MongoDB (Atlas): falta la colección $c (docker compose run --rm mongo-init)" ;; esac
done

echo "3. Keycloak"
curl -s "$KC/.well-known/openid-configuration" | grep -q '"issuer":"http://localhost/auth/realms/licoreria"' \
  && pasa "realm licoreria con emisor http://localhost/auth/realms/licoreria" \
  || falla "el realm no responde o el emisor es otro"
code=$(http "$KC/protocol/openid-connect/auth?client_id=web-shell&response_type=code&scope=openid&redirect_uri=http://localhost/&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256")
[ "$code" = 200 ] && pasa "página de login de web-shell con PKCE" || falla "login de web-shell respondió $code"
for c in "n8n:$N8N_CLIENT_SECRET" "ms-gestion-admin:$GESTION_ADMIN_CLIENT_SECRET"; do
  curl -s "$KC/protocol/openid-connect/token" -d grant_type=client_credentials -d "client_id=${c%%:*}" -d "client_secret=${c#*:}" \
    | grep -q '"access_token"' && pasa "token del cliente ${c%%:*}" || falla "no se obtuvo token de ${c%%:*}"
done
docker compose exec -T nginx curl -sf http://keycloak:8080/auth/realms/licoreria/protocol/openid-connect/certs 2>/dev/null | grep -q '"keys"' \
  && pasa "JWKS accesible por la red interna (http://keycloak:8080)" \
  || falla "JWKS no accesible por la red interna"

echo "4. Microservicios (a través de Nginx)"
for r in /api/ventas/health /api/inventario/health /health@ms-gestion /api/ia/health; do
  case "$r" in
    /health@ms-gestion) url=http://localhost/graphql; code=$(http -X POST -H 'Content-Type: application/json' -d '{"query":"{ salud }"}' "$url"); r="/graphql { salud }" ;;
    *) code=$(http "http://localhost$r") ;;
  esac
  [ "$code" = 200 ] && pasa "$r" || falla "$r respondió $code"
done
SRV=$(curl -s "$KC/protocol/openid-connect/token" -d grant_type=client_credentials -d client_id=n8n -d "client_secret=$N8N_CLIENT_SECRET" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
n=$(curl -s -H "Authorization: Bearer $SRV" http://localhost/api/inventario/productos | grep -o '"codigo"' | wc -l)
[ "$n" -ge 20 ] && pasa "GET /api/inventario/productos con token: $n productos" || falla "GET /api/inventario/productos devolvió $n productos (se esperaban 20; docker compose logs ms-inventario)"
n=$(curl -s -H "Authorization: Bearer $SRV" "http://localhost/api/inventario/stock?sucursal=SUC-01" | grep -o '"productoCodigo"' | wc -l)
[ "$n" -ge 20 ] && pasa "GET /api/inventario/stock?sucursal=SUC-01: $n registros" || falla "GET /api/inventario/stock devolvió $n registros"
code=$(http http://localhost/api/inventario/productos)
[ "$code" = 401 ] && pasa "GET /api/inventario/productos sin token responde 401" || falla "GET /api/inventario/productos sin token respondió $code (se esperaba 401)"
code=$(http -X POST http://localhost/api/ventas/ventas)
[ "$code" = 401 ] && pasa "POST /api/ventas/ventas sin token responde 401" || falla "POST /api/ventas/ventas sin token respondió $code (se esperaba 401)"
code=$(http http://localhost/api/ventas/swagger-ui/index.html)
[ "$code" = 200 ] && pasa "Swagger de ms-ventas" || falla "Swagger de ms-ventas respondió $code"
code=$(http http://localhost/api/ia/docs)
[ "$code" = 200 ] && pasa "Swagger de ms-ia" || falla "Swagger de ms-ia respondió $code"

echo "5. Frontends"
curl -s http://localhost/ | grep -q '<app-root' && pasa "Shell en http://localhost/" || falla "el Shell no responde en /"
code=$(http http://localhost/gestion)
[ "$code" = 200 ] && pasa "ruta /gestion del Shell (vuelve a index.html)" || falla "ruta /gestion respondió $code"
curl -s http://localhost/federation.manifest.json | grep -q 'mfe-gestion' && pasa "manifest de Native Federation" || falla "falta federation.manifest.json"
curl -s http://localhost/mfe-gestion/remoteEntry.json | grep -q '"name": *"mfe-gestion"' && pasa "remoteEntry.json de mfe-gestion" || falla "no responde /mfe-gestion/remoteEntry.json"
curl -s http://localhost/mfe-pos/pos-element.js | grep -q 'licoreria-pos' && pasa "Web Component de mfe-pos" || falla "no responde /mfe-pos/pos-element.js"
code=$(http http://localhost/mfe-pos/manifest.webmanifest)
[ "$code" = 200 ] && pasa "manifest PWA de mfe-pos" || falla "manifest PWA respondió $code"

echo "6. Otros"
code=$(http http://localhost:5678/)
[ "$code" = 200 ] && pasa "n8n en http://localhost:5678" || falla "n8n respondió $code"

echo
echo "Resultado: $ok correctas, $fallas fallas"
[ "$fallas" -eq 0 ]
