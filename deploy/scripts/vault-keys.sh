#!/usr/bin/env bash
# List the KEY NAMES at a KV path, and whether each is empty, without ever
# printing a value. The one sanctioned way for a Claude session to check that
# a secret is populated. (`vault kv get` itself is on the deny list.)
#
#   deploy/scripts/vault-keys.sh kv/routeplanner/prod/app
set -euo pipefail

: "${VAULT_ADDR:=https://127.0.0.1:8200}"
: "${VAULT_CACERT:=/srv/routeplanner/secrets/tls/ca.crt}"
export VAULT_ADDR VAULT_CACERT

path="${1:?usage: vault-keys.sh <kv-path>}"
vault kv get -format=json "$path" \
  | jq -r '.data.data | to_entries[] | "\(.key)\t\(if (.value|length) > 0 then "set (\(.value|length) chars)" else "EMPTY" end)"' \
  | column -t -s $'\t'
