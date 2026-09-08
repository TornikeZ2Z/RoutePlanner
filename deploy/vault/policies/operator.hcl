# The human operator. Signs in with userpass + TOTP through the UI over an SSH
# port-forward. Manages secrets, policies, auth and audit; cannot use the
# root token (which is revoked after bootstrap) and cannot rekey or generate
# a root token without the unseal-key holders.

# Secrets: full control of the routeplanner tree, including version history.
path "kv/*" {
  capabilities = ["create", "read", "update", "delete", "list", "patch"]
}

# Auth methods, roles and the AppRole used by the agent (rotate secret_id).
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/auth/*" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}
path "sys/auth" {
  capabilities = ["read", "list"]
}

# Policies.
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/policies/acl" {
  capabilities = ["list"]
}

# Identity, for Login MFA enforcement and entity lookups.
path "identity/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Mounts and audit devices.
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}
path "sys/mounts" {
  capabilities = ["read", "list"]
}
path "sys/audit/*" {
  capabilities = ["create", "read", "update", "delete", "sudo"]
}
path "sys/audit" {
  capabilities = ["read", "list", "sudo"]
}

# Health, leases, Raft snapshots and the seal status.
path "sys/health" {
  capabilities = ["read", "sudo"]
}
path "sys/leases/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/storage/raft/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/seal-status" {
  capabilities = ["read"]
}
path "sys/seal" {
  capabilities = ["update", "sudo"]
}
