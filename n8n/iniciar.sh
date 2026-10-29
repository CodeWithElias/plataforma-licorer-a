#!/bin/sh
# Arranque de n8n en Docker: crea las credenciales con los valores de n8n/.env, importa los workflows de
# n8n/workflows y los activa. Se repite en cada arranque, así un cambio en los JSON o en el .env se aplica solo.
set -e

CREDENCIALES=/tmp/credenciales-licoreria.json

# Se arman con node para que los secretos queden bien escapados en el JSON
node -e '
const env = process.env;
const credenciales = [
  {
    id: "keycloakN8nCred1",
    name: "Keycloak (cliente n8n)",
    type: "oAuth2Api",
    data: {
      grantType: "clientCredentials",
      accessTokenUrl: env.KEYCLOAK_TOKEN_URL,
      clientId: env.N8N_CLIENT_ID,
      clientSecret: env.N8N_CLIENT_SECRET,
      scope: "",
      authentication: "body",
    },
  },
  {
    id: "smtpLicoreria001",
    name: "SMTP licorería",
    type: "smtp",
    data: {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465),
      secure: env.SMTP_SECURE === "true",
      user: env.SMTP_USER || "",
      password: env.SMTP_PASSWORD || "",
    },
  },
];
require("fs").writeFileSync(process.argv[1], JSON.stringify(credenciales));
' "$CREDENCIALES"

n8n import:credentials --input="$CREDENCIALES"
rm -f "$CREDENCIALES"

n8n import:workflow --separate --input=/licoreria/workflows
for id in cu06Reabastecer1 cu07ReporteDiar1; do
  n8n publish:workflow --id="$id"
done

exec n8n start
