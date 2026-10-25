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

echo "2. Bases de datos (a través de cada servicio)"
SRV=$(curl -s "$KC/protocol/openid-connect/token" -d grant_type=client_credentials -d client_id=n8n -d "client_secret=$N8N_CLIENT_SECRET" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
# PostgreSQL de ms-ventas (Supabase): conexión y migraciones de Flyway
curl -s http://localhost/api/ventas/health | grep -o '"db":{"details":{[^}]*},"status":"[A-Z]*"' | grep -q '"status":"UP"' \
  && pasa "PostgreSQL (Supabase): ms-ventas conectado" || falla "PostgreSQL (Supabase): ms-ventas no conecta (docker compose logs ms-ventas)"
curl -s -H "Authorization: Bearer $SRV" http://localhost/api/ventas/flyway | grep -q '"version":"1".*"state":"SUCCESS"\|"state":"SUCCESS".*"version":"1"' \
  && pasa "PostgreSQL (Supabase): migración V1 (tablas de ventas) aplicada" || falla "PostgreSQL (Supabase): falta la migración V1 de Flyway"
dyn=$(docker compose run --rm --no-deps --entrypoint aws dynamodb-init \
  dynamodb list-tables --endpoint-url http://dynamodb:8000 --output text 2>/dev/null)
for t in Productos Reservas Stock; do
  echo "$dyn" | grep -qw "$t" && pasa "DynamoDB: tabla $t" || falla "DynamoDB: falta la tabla $t"
done
# MongoDB de ms-gestion (Atlas): su /health lista las colecciones
col=$(docker compose exec -T ms-gestion wget -qO- http://127.0.0.1:3000/health 2>/dev/null)
for c in empleados ingresos ordenes_compra proveedores reportes; do
  case "$col" in *"\"$c\""*) pasa "MongoDB (Atlas): colección $c" ;; *) falla "MongoDB (Atlas): falta la colección $c (docker compose run --rm mongo-init)" ;; esac
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
n=$(curl -s -H "Authorization: Bearer $SRV" http://localhost/api/inventario/productos | grep -o '"codigo"' | wc -l)
[ "$n" -ge 20 ] && pasa "GET /api/inventario/productos con token: $n productos" || falla "GET /api/inventario/productos devolvió $n productos (se esperaban 20; docker compose logs ms-inventario)"
n=$(curl -s -H "Authorization: Bearer $SRV" "http://localhost/api/inventario/stock" | grep -o '"productoCodigo"' | wc -l)
[ "$n" -ge 20 ] && pasa "GET /api/inventario/stock: $n registros" || falla "GET /api/inventario/stock devolvió $n registros"
code=$(http http://localhost/api/inventario/productos)
[ "$code" = 401 ] && pasa "GET /api/inventario/productos sin token responde 401" || falla "GET /api/inventario/productos sin token respondió $code (se esperaba 401)"
code=$(http -X POST http://localhost/api/ventas/ventas)
[ "$code" = 401 ] && pasa "POST /api/ventas/ventas sin token responde 401" || falla "POST /api/ventas/ventas sin token respondió $code (se esperaba 401)"
code=$(http http://localhost/api/ventas/swagger-ui/index.html)
[ "$code" = 200 ] && pasa "Swagger de ms-ventas" || falla "Swagger de ms-ventas respondió $code"
code=$(http http://localhost/api/ia/docs)
[ "$code" = 200 ] && pasa "Swagger de ms-ia" || falla "Swagger de ms-ia respondió $code"

echo "4b. Semana 2 (con el token de la cuenta de servicio n8n, rol GERENTE)"
DESDE=$(date -u -d '-30 days' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-01T00:00:00Z)
HASTA=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT23:59:59Z)
code=$(http -H "Authorization: Bearer $SRV" "http://localhost/api/ventas/ventas?desde=$DESDE&hasta=$HASTA")
[ "$code" = 200 ] && pasa "GET /api/ventas/ventas?desde&hasta (ventas por periodo)" || falla "ventas por periodo respondió $code"
curl -s -X POST http://localhost/graphql -H "Authorization: Bearer $SRV" -H 'Content-Type: application/json' -d '{"query":"{ yo { usuario } }"}' | grep -q '"usuario":"service-account-n8n"' \
  && pasa "GraphQL yo valida el token de Keycloak (ms-gestion)" || falla "GraphQL yo no validó el token"
curl -s -X POST http://localhost/graphql -H "Authorization: Bearer $SRV" -H 'Content-Type: application/json' -d '{"query":"{ proveedores { id } }"}' | grep -q '"proveedores":\[' \
  && pasa "GraphQL proveedores (CU05)" || falla "GraphQL proveedores no respondió"
curl -s -X POST http://localhost/graphql -H 'Content-Type: application/json' -d '{"query":"{ yo { usuario } }"}' | grep -q 'UNAUTHENTICATED' \
  && pasa "GraphQL yo sin token responde UNAUTHENTICATED" || falla "GraphQL yo sin token no fue rechazado"
curl -s -H "Authorization: Bearer $SRV" http://localhost/api/ia/yo | grep -q '"usuario":"service-account-n8n"' \
  && pasa "ms-ia /yo valida el token de Keycloak" || falla "ms-ia /yo no validó el token"
code=$(http -H "Authorization: Bearer $SRV" http://localhost/api/ia/modelos/latest)
case "$code" in
  200) pasa "ms-ia /modelos/latest: hay modelo entrenado" ;;
  503) pasa "ms-ia /modelos/latest responde 503 MODELO_NO_DISPONIBLE (falta entrenar; ver ms-ia/dataset/README.md)" ;;
  *) falla "ms-ia /modelos/latest respondió $code" ;;
esac

echo "5. Frontends"
curl -s http://localhost/ | grep -q '<app-root' && pasa "Shell en http://localhost/" || falla "el Shell no responde en /"
code=$(http http://localhost/gestion)
[ "$code" = 200 ] && pasa "ruta /gestion del Shell (vuelve a index.html)" || falla "ruta /gestion respondió $code"
curl -s http://localhost/federation.manifest.json | grep -q 'mfe-gestion' && pasa "manifest de Native Federation" || falla "falta federation.manifest.json"
curl -s http://localhost/mfe-gestion/remoteEntry.json | grep -q '"name": *"mfe-gestion"' && pasa "remoteEntry.json de mfe-gestion" || falla "no responde /mfe-gestion/remoteEntry.json"
curl -s http://localhost/mfe-pos/pos-element.js | grep -q 'licoreria-pos' && pasa "Web Component de mfe-pos" || falla "no responde /mfe-pos/pos-element.js"
code=$(http http://localhost/mfe-pos/manifest.webmanifest)
[ "$code" = 200 ] && pasa "manifest PWA de mfe-pos" || falla "manifest PWA respondió $code"

echo "6. Puertos directos de cada servicio"
for p in "ms-ventas|http://localhost:8080/health" "ms-inventario|http://localhost:8001/health" \
         "ms-gestion|http://localhost:3000/health" "ms-ia|http://localhost:8002/health" \
         "web-shell|http://localhost:4200/" "mfe-gestion|http://localhost:4201/mfe-gestion/" \
         "mfe-pos|http://localhost:4202/mfe-pos/" "n8n|http://localhost:5678/"; do
  code=$(http "${p#*|}")
  [ "$code" = 200 ] && pasa "${p%%|*} en ${p#*|}" || falla "${p%%|*} no responde en ${p#*|} ($code)"
done
curl -s http://localhost/api/ventas/v3/api-docs | grep -q '"url":"http://localhost/api/ventas"' \
  && pasa "el gateway envía X-Forwarded-Prefix (Swagger de ms-ventas con /api/ventas)" \
  || falla "Swagger de ms-ventas por el gateway no tiene el prefijo /api/ventas (revisar infra/nginx.conf)"

echo
echo "Resultado: $ok correctas, $fallas fallas"
[ "$fallas" -eq 0 ]
