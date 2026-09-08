#!/usr/bin/env bash
# Create every GENERATED secret in Vault in one go, without any value ever
# appearing on a command line, in a log, or in a Claude transcript.
#
#   deploy/scripts/vault-seed.sh
#
# Human-supplied secrets (SMTP app password, smsoffice key, R2 backup token,
# restic password, Kuma push URL) are NOT created here: the human enters
# them with `vault kv patch ... KEY=-` or in the UI. See docs section 6.
#
# Idempotent in the safe direction: refuses to overwrite a path that already
# exists, because regenerating SUPERUSER_PASSWORD after initdb, or RPC_SECRET
# after Garage has data, is an outage. Delete the path deliberately first.
set -euo pipefail

: "${VAULT_ADDR:=https://127.0.0.1:8200}"
: "${VAULT_CACERT:=/srv/routeplanner/secrets/tls/ca.crt}"
export VAULT_ADDR VAULT_CACERT

die() { printf 'vault-seed: %s\n' "$*" >&2; exit 1; }
vault token lookup >/dev/null 2>&1 || die "no Vault login (operator: vault login -method=userpass username=ops)"

hex()    { openssl rand -hex 32; }
urltok() { openssl rand -base64 33 | tr -d '/+=' | cut -c1-40; }

put_once() {
  local path="$1"; shift
  if vault kv metadata get "$path" >/dev/null 2>&1; then
    echo "  $path exists, leaving it alone"
    return 0
  fi
  # Values travel through stdin as JSON, never argv.
  jq -n "$@" '$ARGS.named' | vault kv put "$path" - >/dev/null
  echo "  $path created"
}

put_once kv/routeplanner/prod/postgres \
  --arg SUPERUSER_PASSWORD "$(hex)" \
  --arg APP_PASSWORD "$(hex)" \
  --arg BACKUP_PASSWORD "$(hex)"

put_once kv/routeplanner/prod/garage \
  --arg RPC_SECRET "$(hex)" \
  --arg ADMIN_TOKEN "$(hex)" \
  --arg ACCESS_KEY_ID "GK$(openssl rand -hex 12)" \
  --arg SECRET_ACCESS_KEY "$(hex)"

put_once kv/routeplanner/prod/app \
  --arg SESSION_SECRET "$(hex)" \
  --arg CHANGE_REQUEST_TOKEN "$(urltok)" \
  --arg SMTP_PASSWORD "" \
  --arg RESEND_API_KEY "" \
  --arg SMSOFFICE_API_KEY "" \
  --arg ROUTING_API_KEY ""

put_once kv/routeplanner/prod/backup \
  --arg RESTIC_REPOSITORY "s3:https://ACCOUNT_ID.r2.cloudflarestorage.com/routeplanner-backups" \
  --arg RESTIC_PASSWORD "" \
  --arg R2_ACCESS_KEY_ID "" \
  --arg R2_SECRET_ACCESS_KEY "" \
  --arg KUMA_PUSH_URL ""

cat <<'EOF'

Generated secrets are in place. Still empty, for the HUMAN to fill in
(each command reads the value from the terminal, nothing is echoed):

  vault kv patch kv/routeplanner/prod/app     SMTP_PASSWORD=-
  vault kv patch kv/routeplanner/prod/app     SMSOFFICE_API_KEY=-
  vault kv patch kv/routeplanner/prod/backup  RESTIC_REPOSITORY=-      (fix ACCOUNT_ID)
  vault kv patch kv/routeplanner/prod/backup  RESTIC_PASSWORD=-        (ALSO store offline)
  vault kv patch kv/routeplanner/prod/backup  R2_ACCESS_KEY_ID=-
  vault kv patch kv/routeplanner/prod/backup  R2_SECRET_ACCESS_KEY=-
  vault kv patch kv/routeplanner/prod/backup  KUMA_PUSH_URL=-          (after Kuma exists)

Type the value, press Enter, then Ctrl-D.
EOF
