# What the AppRole used by vault-agent may do. Read the production secrets,
# and take a Raft snapshot for the backup job. Nothing else: no list, no
# write, no metadata, no other environment.

path "kv/data/routeplanner/prod/*" {
  capabilities = ["read"]
}

path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
