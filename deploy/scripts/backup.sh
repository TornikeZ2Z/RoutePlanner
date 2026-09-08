#!/usr/bin/env bash
# Nightly backup to Cloudflare R2 through restic. Run as root by
# routeplanner-backup.timer.
#
# What goes into a snapshot:
#   - a fresh pg_dump (custom format) of the routeplanner database
#   - a fresh Vault Raft snapshot (encrypted by Vault's own barrier key)
#   - Garage: the latest consistent metadata snapshot plus the data blobs
#     (blobs are immutable, so copying them live is safe)
#   - /srv/routeplanner/secrets: tunnel credentials, AppRole files, TLS CA.
#     Enough to rebuild the host from nothing, given the restic password and
#     the Vault unseal keys, which must therefore live OFFLINE, not only here.
#
# restic encrypts everything client-side; R2 only ever sees ciphertext.
set -euo pipefail

DEPLOY=/srv/routeplanner/repo/deploy
BACKUPS=/srv/routeplanner/backups
DATA=/srv/routeplanner/data
BACKUP_ENV=/run/routeplanner/secrets/backup/backup.env
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_KEEP_DAYS=7

dc() { docker compose --project-directory "$DEPLOY" -f "$DEPLOY/docker-compose.yml" "$@"; }
say() { printf '%s backup: %s\n' "$(date -Is)" "$*"; }
die() { say "FAILED: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root"
[[ -s "$BACKUP_ENV" ]] || die "$BACKUP_ENV missing: Vault sealed or vault-agent unhealthy"
mkdir -p "$BACKUPS/postgres" "$BACKUPS/vault"
chmod 0700 "$BACKUPS"

# ---- database ---------------------------------------------------------------
say "dumping postgres"
DUMP="$BACKUPS/postgres/routeplanner-$STAMP.dump"
dc exec -T postgres pg_dump -U postgres -Fc --no-owner --no-acl routeplanner > "$DUMP"
[[ -s "$DUMP" ]] || die "empty dump"
say "dump $(du -h "$DUMP" | cut -f1)"

# ---- vault ------------------------------------------------------------------
say "snapshotting vault raft"
dc --profile ops run --rm vault-snapshot >/dev/null || die "vault snapshot failed"

# ---- restic -----------------------------------------------------------------
# Credentials are exported into this process only.
set -a
# shellcheck disable=SC1090
. "$BACKUP_ENV"
set +a

say "restic backup"
restic backup --quiet --tag routeplanner --tag "$STAMP" \
  "$BACKUPS/postgres" \
  "$BACKUPS/vault" \
  "$DATA/garage/meta/snapshots" \
  "$DATA/garage/data" \
  /srv/routeplanner/secrets \
  --exclude "$BACKUPS/drill" \
  || die "restic backup failed"

say "restic forget/prune"
restic forget --quiet --tag routeplanner \
  --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune \
  || die "restic forget failed"

# A cheap integrity check of a random subset every run; the full check is in
# the monthly restore drill.
restic check --quiet --read-data-subset=5% || die "restic check failed"

# ---- local retention --------------------------------------------------------
find "$BACKUPS/postgres" -name '*.dump' -mtime +"$LOCAL_KEEP_DAYS" -delete
find "$BACKUPS/vault" -name '*.snap' -mtime +"$LOCAL_KEEP_DAYS" -delete

# Tell Uptime Kuma the job ran (push monitor, docs section 13). Empty = not set up yet.
if [[ -n "${KUMA_PUSH_URL:-}" ]]; then
  curl -fsS -m 10 "$KUMA_PUSH_URL?status=up&msg=ok" >/dev/null || say "kuma push failed (non-fatal)"
fi

say "done"
