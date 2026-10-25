#!/bin/sh
# ms-inventario – DynamoDB Local
# Dentro de Docker lo ejecuta el servicio dynamodb-init (DYNAMO_URL=http://dynamodb:8000);
# fuera de Docker: sh db/inventario.sh  (usa http://localhost:8000).
# Es idempotente: si una tabla ya existe, no la vuelve a crear.

EP="--endpoint-url ${DYNAMO_URL:-http://localhost:8000}"
export AWS_PAGER=""

# Esperar a que DynamoDB Local responda
until aws dynamodb list-tables $EP >/dev/null 2>&1; do
  echo "Esperando a DynamoDB en ${DYNAMO_URL:-http://localhost:8000}..."
  sleep 2
done

existe() {
  aws dynamodb describe-table $EP --table-name "$1" >/dev/null 2>&1
}

# Productos: clave = codigo
existe Productos || aws dynamodb create-table $EP --table-name Productos \
  --attribute-definitions AttributeName=codigo,AttributeType=S \
  --key-schema AttributeName=codigo,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Stock: clave = productoCodigo (la licorería tiene una sola sucursal)
existe Stock || aws dynamodb create-table $EP --table-name Stock \
  --attribute-definitions AttributeName=productoCodigo,AttributeType=S \
  --key-schema AttributeName=productoCodigo,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Reservas: clave = reservaId (igual al operationId de la venta)
existe Reservas || aws dynamodb create-table $EP --table-name Reservas \
  --attribute-definitions AttributeName=reservaId,AttributeType=S \
  --key-schema AttributeName=reservaId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Producto de ejemplo (los 20 productos los carga php artisan inventario:seed al arrancar ms-inventario).
# Condicional: no pisa el stock si el script se vuelve a ejecutar.
aws dynamodb put-item $EP --table-name Productos --condition-expression "attribute_not_exists(codigo)" --item '{
  "codigo": {"S": "CER-001"}, "nombre": {"S": "Cerveza Paceña 620 ml"}, "marca": {"S": "Paceña"},
  "tipo": {"S": "CERVEZA"}, "gradoAlcoholico": {"N": "4.8"}, "volumenMl": {"N": "620"},
  "precio": {"N": "12.00"}, "etiquetaModelo": {"S": "pacena_620"}}'   2>/dev/null || true

aws dynamodb put-item $EP --table-name Stock --condition-expression "attribute_not_exists(productoCodigo)" --item '{
  "productoCodigo": {"S": "CER-001"},
  "cantidad": {"N": "48"}, "reservado": {"N": "0"}, "minimo": {"N": "12"}, "version": {"N": "1"}}'   2>/dev/null || echo "Producto de ejemplo ya existía"

echo "Tablas de DynamoDB listas:"
aws dynamodb list-tables $EP --output text
