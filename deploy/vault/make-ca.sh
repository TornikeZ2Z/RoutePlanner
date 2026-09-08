#!/usr/bin/env bash
# Private CA and a server certificate for the Vault listener.
#
# Run once as root on the host:
#   deploy/vault/make-ca.sh /srv/routeplanner/secrets/tls
#
# Produces ca.crt (public, mounted into every Vault client), ca.key (kept only
# to renew vault.crt; 0400 root), vault.crt and vault.key (0440 root:1100, so
# the vault container's user 1100:1100 can read the key and nobody else can).
#
# The server cert is valid for two years. Renewal is the same command with
# the CA files already present; it will reuse them. Put the expiry in the
# calendar: docs/ON-PREM-HOSTING.md section 13.
set -euo pipefail

OUT="${1:?usage: make-ca.sh <output-dir>}"
DAYS_CA=3650
DAYS_SERVER=730

umask 077
mkdir -p "$OUT"
cd "$OUT"

if [[ ! -f ca.key ]]; then
  openssl ecparam -name prime256v1 -genkey -noout -out ca.key
  openssl req -x509 -new -key ca.key -sha256 -days "$DAYS_CA" \
    -subj "/CN=Route Planner internal CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out ca.crt
  echo "created CA: $OUT/ca.crt"
fi

openssl ecparam -name prime256v1 -genkey -noout -out vault.key
openssl req -new -key vault.key -subj "/CN=vault" -out vault.csr

cat > vault.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:vault,DNS:localhost,IP:127.0.0.1,IP:172.28.0.10
EOF

openssl x509 -req -in vault.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days "$DAYS_SERVER" -sha256 -extfile vault.ext -out vault.crt
rm -f vault.csr vault.ext

chown root:root ca.key ca.crt
chmod 0400 ca.key
chmod 0444 ca.crt
# Readable by the vault container (uid 1100, gid 1100) and root only.
chown root:1100 vault.key vault.crt
chmod 0440 vault.key
chmod 0444 vault.crt
chmod 0755 "$OUT"

echo "server certificate: $OUT/vault.crt"
openssl x509 -in vault.crt -noout -subject -enddate -ext subjectAltName
