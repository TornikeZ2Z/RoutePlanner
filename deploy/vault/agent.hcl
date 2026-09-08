# Vault Agent: the only process that ever holds secret values in this stack.
#
# It authenticates with an AppRole whose secret_id lives in a root-owned file
# on the host, then renders each consumer's secrets into its own directory
# under /secrets (a host tmpfs, /run/routeplanner/secrets). Files are owned
# by the agent's uid/gid (1200) and readable by that group only; each consumer
# container joins the group and mounts just its own directory.
#
# One agent, several templates, rather than one agent per consumer: on a
# single host with one root, per-consumer AppRoles would add containers and
# bootstrap files without changing who can read what.
#
# Process-supervisor mode (exec + env_template) is deliberately NOT used: it
# cannot coexist with file templates in one agent, and the app's entrypoint
# sourcing a file achieves the same "secrets in process env only" result.

pid_file        = "/tmp/vault-agent.pid"
exit_after_auth = false
log_level       = "info"

vault {
  address = "https://vault:8200"
  ca_cert = "/vault/tls/ca.crt"
}

auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path                   = "/vault/approle/role_id"
      secret_id_file_path                 = "/vault/approle/secret_id"
      remove_secret_id_file_after_reading = false
    }
  }

  # The agent's own token, for the Raft snapshot job (vault-snapshot service).
  sink "file" {
    config = {
      path = "/secrets/backup/vault-token"
      mode = 0440
    }
  }
}

template_config {
  # A template that cannot render is a deployment that must not start.
  exit_on_retry_failure         = true
  static_secret_render_interval = "5m"
}

# ---- app --------------------------------------------------------------------
# Everything config.ts marks secret. Public configuration is in
# deploy/env/app.public.env, not here.
template {
  destination = "/secrets/app/app.env"
  perms       = "0440"
  contents    = <<EOT
{{ with secret "kv/data/routeplanner/prod/postgres" -}}
DATABASE_URL=postgres://routeplanner:{{ .Data.data.APP_PASSWORD }}@postgres:5432/routeplanner
{{- end }}
{{ with secret "kv/data/routeplanner/prod/garage" -}}
S3_ACCESS_KEY_ID={{ .Data.data.ACCESS_KEY_ID }}
S3_SECRET_ACCESS_KEY={{ .Data.data.SECRET_ACCESS_KEY }}
{{- end }}
{{ with secret "kv/data/routeplanner/prod/app" -}}
SESSION_SECRET={{ .Data.data.SESSION_SECRET }}
CHANGE_REQUEST_TOKEN={{ .Data.data.CHANGE_REQUEST_TOKEN }}
SMTP_PASSWORD={{ .Data.data.SMTP_PASSWORD }}
RESEND_API_KEY={{ .Data.data.RESEND_API_KEY }}
SMSOFFICE_API_KEY={{ .Data.data.SMSOFFICE_API_KEY }}
ROUTING_API_KEY={{ .Data.data.ROUTING_API_KEY }}
{{- end }}
EOT
}

# ---- image build ------------------------------------------------------------
# Same secrets, but Postgres addressed over the host loopback: the build runs
# with --network=host so prerendering can query the live database.
template {
  destination = "/secrets/build/build.env"
  perms       = "0440"
  contents    = <<EOT
{{ with secret "kv/data/routeplanner/prod/postgres" -}}
DATABASE_URL=postgres://routeplanner:{{ .Data.data.APP_PASSWORD }}@127.0.0.1:5432/routeplanner
{{- end }}
{{ with secret "kv/data/routeplanner/prod/garage" -}}
S3_ACCESS_KEY_ID={{ .Data.data.ACCESS_KEY_ID }}
S3_SECRET_ACCESS_KEY={{ .Data.data.SECRET_ACCESS_KEY }}
{{- end }}
{{ with secret "kv/data/routeplanner/prod/app" -}}
SESSION_SECRET={{ .Data.data.SESSION_SECRET }}
CHANGE_REQUEST_TOKEN={{ .Data.data.CHANGE_REQUEST_TOKEN }}
SMTP_PASSWORD={{ .Data.data.SMTP_PASSWORD }}
RESEND_API_KEY={{ .Data.data.RESEND_API_KEY }}
SMSOFFICE_API_KEY={{ .Data.data.SMSOFFICE_API_KEY }}
ROUTING_API_KEY={{ .Data.data.ROUTING_API_KEY }}
{{- end }}
EOT
}

# ---- postgres ---------------------------------------------------------------
template {
  destination = "/secrets/postgres/superuser_password"
  perms       = "0440"
  contents    = "{{ with secret \"kv/data/routeplanner/prod/postgres\" }}{{ .Data.data.SUPERUSER_PASSWORD }}{{ end }}"
}
template {
  destination = "/secrets/postgres/app_password"
  perms       = "0440"
  contents    = "{{ with secret \"kv/data/routeplanner/prod/postgres\" }}{{ .Data.data.APP_PASSWORD }}{{ end }}"
}
template {
  destination = "/secrets/postgres/backup_password"
  perms       = "0440"
  contents    = "{{ with secret \"kv/data/routeplanner/prod/postgres\" }}{{ .Data.data.BACKUP_PASSWORD }}{{ end }}"
}

# ---- garage -----------------------------------------------------------------
template {
  destination = "/secrets/garage/rpc_secret"
  perms       = "0440"
  contents    = "{{ with secret \"kv/data/routeplanner/prod/garage\" }}{{ .Data.data.RPC_SECRET }}{{ end }}"
}
template {
  destination = "/secrets/garage/admin_token"
  perms       = "0440"
  contents    = "{{ with secret \"kv/data/routeplanner/prod/garage\" }}{{ .Data.data.ADMIN_TOKEN }}{{ end }}"
}

# ---- backup (restic to Cloudflare R2) ---------------------------------------
# Read by deploy/scripts/backup.sh as root on the host.
template {
  destination = "/secrets/backup/backup.env"
  perms       = "0440"
  contents    = <<EOT
{{ with secret "kv/data/routeplanner/prod/backup" -}}
RESTIC_REPOSITORY={{ .Data.data.RESTIC_REPOSITORY }}
RESTIC_PASSWORD={{ .Data.data.RESTIC_PASSWORD }}
AWS_ACCESS_KEY_ID={{ .Data.data.R2_ACCESS_KEY_ID }}
AWS_SECRET_ACCESS_KEY={{ .Data.data.R2_SECRET_ACCESS_KEY }}
KUMA_PUSH_URL={{ .Data.data.KUMA_PUSH_URL }}
{{- end }}
EOT
}
