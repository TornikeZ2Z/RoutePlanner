# Vault server, single node, integrated Raft storage.
#
# TLS is on even though the only client is on the same Docker network: the
# AppRole secret_id and every rendered secret cross this listener, and a
# plaintext listener is one packet capture away from all of them. The
# certificate comes from deploy/vault/make-ca.sh.

ui = true

# Integrated storage requires an explicit value. The 2.x image no longer has
# cap_ipc_lock, so mlock cannot work; swap is disabled on the host instead
# (docs section 3) so nothing pages Vault's memory to disk.
disable_mlock = true

api_addr     = "https://vault:8200"
cluster_addr = "https://vault:8201"

storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  tls_cert_file   = "/vault/tls/vault.crt"
  tls_key_file    = "/vault/tls/vault.key"
  tls_min_version = "tls12"
}

log_level  = "info"
log_format = "json"

# Vault CE has no LTS. Track minor releases; see docs section 13.
