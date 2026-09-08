#!/usr/bin/env bash
# One-time Vault configuration, part 2 of 2. Run as root AFTER the operator
# has enrolled their TOTP (see the message bootstrap.sh printed).
#
#   bootstrap-finish.sh <totp-method-id>
#
# Turns MFA enforcement on for every userpass login, proves the operator can
# still log in, then revokes the root token. From here on the operator is
# the only human identity, and root can only be regenerated with a quorum of
# unseal keys (vault operator generate-root).
set -euo pipefail

: "${VAULT_ADDR:=https://127.0.0.1:8200}"
: "${VAULT_CACERT:=/srv/routeplanner/secrets/tls/ca.crt}"
export VAULT_ADDR VAULT_CACERT

METHOD_ID="${1:?usage: bootstrap-finish.sh <totp-method-id>}"
OPERATOR="${OPERATOR:-ops}"

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'bootstrap-finish: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"
vault token lookup >/dev/null 2>&1 || die "no Vault login"

say "MFA enforcement on userpass"
ACCESSOR="$(vault auth list -format=json | jq -r '."userpass/".accessor')"
vault write identity/mfa/login-enforcement/userpass-totp \
  mfa_method_ids="$METHOD_ID" auth_method_accessors="$ACCESSOR" >/dev/null

say "operator login test (the human types password and TOTP code)"
echo "    In ANOTHER terminal, as the operator, run and confirm it succeeds:"
echo "      vault login -method=userpass username=$OPERATOR"
read -r -p "    Did it succeed? [yes/NO] " ok
[[ "$ok" == "yes" ]] || die "not revoking root until the operator can log in"

say "revoking the root token"
vault token revoke -self
rm -f /root/.vault-token
echo "    done. Root is gone; generate-root needs 3 unseal keys if it is ever needed again."
