#!/usr/bin/env bash
# One-time Vault configuration, part 1 of 2. Run as root on the host AFTER the
# human has run `vault operator init`, unsealed, and `vault login` with the
# root token (docs/ON-PREM-HOSTING.md section 5). Uses that login; takes no
# token on the command line and prints no secret.
#
# What it does:
#   - file audit device            every request logged, HMAC'd values
#   - kv-v2 at kv/                 the routeplanner secrets tree
#   - policies                     deploy/vault/policies/*.hcl
#   - AppRole for vault-agent      CIDR-bound to the compose vault network;
#                                  role_id + secret_id written to
#                                  /srv/routeplanner/secrets/approle (0400, uid 1200)
#   - userpass for the operator    password read from the terminal, not argv
#   - TOTP MFA method              enrolment is the human's step (part 2)
#
# Part 2 (bootstrap-finish.sh) turns MFA enforcement on and revokes root.
set -euo pipefail

: "${VAULT_ADDR:=https://127.0.0.1:8200}"
: "${VAULT_CACERT:=/srv/routeplanner/secrets/tls/ca.crt}"
export VAULT_ADDR VAULT_CACERT

HERE="$(cd "$(dirname "$0")" && pwd)"
APPROLE_DIR=/srv/routeplanner/secrets/approle
OPERATOR="${OPERATOR:-ops}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'bootstrap: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"
vault status >/dev/null 2>&1 || die "Vault is sealed or unreachable at $VAULT_ADDR"
vault token lookup >/dev/null 2>&1 || die "no Vault login. The human runs: vault login"

say "audit device (file)"
vault audit list -format=json | jq -e '."file/"' >/dev/null 2>&1 \
  || vault audit enable file file_path=/vault/logs/audit.log mode=0600

say "kv-v2 secrets engine at kv/"
vault secrets list -format=json | jq -e '."kv/"' >/dev/null 2>&1 \
  || vault secrets enable -path=kv -version=2 kv
vault write kv/config max_versions=20 cas_required=false >/dev/null

say "policies"
vault policy write routeplanner-agent "$HERE/policies/routeplanner-agent.hcl"
vault policy write operator "$HERE/policies/operator.hcl"

say "AppRole for vault-agent"
vault auth list -format=json | jq -e '."approle/"' >/dev/null 2>&1 \
  || vault auth enable approle
vault write auth/approle/role/routeplanner-agent \
  token_policies="routeplanner-agent" \
  token_ttl=1h token_max_ttl=24h \
  secret_id_ttl=0 secret_id_num_uses=0 \
  secret_id_bound_cidrs="172.28.0.0/24" \
  token_bound_cidrs="172.28.0.0/24" >/dev/null

umask 077
mkdir -p "$APPROLE_DIR"
vault read -field=role_id auth/approle/role/routeplanner-agent/role-id > "$APPROLE_DIR/role_id"
vault write -f -field=secret_id auth/approle/role/routeplanner-agent/secret-id > "$APPROLE_DIR/secret_id"
chown -R 1200:1200 "$APPROLE_DIR"
chmod 0750 "$APPROLE_DIR"
chmod 0400 "$APPROLE_DIR"/role_id "$APPROLE_DIR"/secret_id
echo "    wrote $APPROLE_DIR/{role_id,secret_id} (0400, uid 1200)"

say "userpass for the operator '$OPERATOR'"
vault auth list -format=json | jq -e '."userpass/"' >/dev/null 2>&1 \
  || vault auth enable userpass
if ! vault read "auth/userpass/users/$OPERATOR" >/dev/null 2>&1; then
  echo "    Type the operator's Vault password (not echoed). 16+ characters, from a password manager."
  read -r -s -p "    password: " pw; echo
  read -r -s -p "    again:    " pw2; echo
  [[ "$pw" == "$pw2" ]] || die "passwords differ"
  [[ ${#pw} -ge 16 ]] || die "too short"
  printf '%s' "$pw" | vault write "auth/userpass/users/$OPERATOR" password=- token_policies=operator token_ttl=8h token_max_ttl=8h >/dev/null
  unset pw pw2
fi

say "identity entity for '$OPERATOR'"
ACCESSOR="$(vault auth list -format=json | jq -r '."userpass/".accessor')"
ENTITY_ID="$(vault write -field=id identity/entity name="$OPERATOR" policies=operator 2>/dev/null \
  || vault read -field=id "identity/entity/name/$OPERATOR")"
vault write identity/entity-alias name="$OPERATOR" canonical_id="$ENTITY_ID" mount_accessor="$ACCESSOR" >/dev/null 2>&1 || true

say "TOTP MFA method"
METHOD_ID="$(vault list -format=json identity/mfa/method/totp 2>/dev/null | jq -r '.[0] // empty')"
if [[ -z "$METHOD_ID" ]]; then
  METHOD_ID="$(vault write -field=method_id identity/mfa/method/totp \
    generate=true issuer="Vault routeplanner" period=30 key_size=30 algorithm=SHA256 digits=6)"
fi
echo "    method_id: $METHOD_ID"
echo "    entity_id: $ENTITY_ID"

cat <<EOF

Part 1 done. The HUMAN now does, in their own terminal (this prints a TOTP
secret and must not be run by Claude):

  vault write identity/mfa/method/totp/admin-generate method_id=$METHOD_ID entity_id=$ENTITY_ID

Scan the QR / enter the url in an authenticator app, then run:

  sudo $HERE/bootstrap-finish.sh $METHOD_ID

EOF
