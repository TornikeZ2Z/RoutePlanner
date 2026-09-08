#!/usr/bin/env bash
# Prove the backups restore. Run monthly by routeplanner-restore-drill.timer,
# or by hand after any change to backup.sh.
#
# Pulls the newest database dump OUT OF THE RESTIC REPOSITORY (not the local
# copy: the point is to test what R2 holds), restores it into a throwaway
# postgres:18.6 container on no network, and checks row counts. Exits
# non-zero on any mismatch so the timer's failure shows in Uptime Kuma.
set -euo pipefail

BACKUP_ENV=/run/routeplanner/secrets/backup/backup.env
DRILL=/srv/routeplanner/backups/drill
NAME=routeplanner-restore-drill

say() { printf '%s drill: %s\n' "$(date -Is)" "$*"; }
die() { say "FAILED: $*" >&2; cleanup; exit 1; }
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$DRILL"; }
trap cleanup EXIT

[[ $EUID -eq 0 ]] || die "run as root"
[[ -s "$BACKUP_ENV" ]] || die "$BACKUP_ENV missing"

set -a
# shellcheck disable=SC1090
. "$BACKUP_ENV"
set +a

say "restoring newest dump from restic"
rm -rf "$DRILL"; mkdir -p "$DRILL"; chmod 0700 "$DRILL"
restic restore latest --quiet --target "$DRILL" --include '/srv/routeplanner/backups/postgres/*.dump' \
  || die "restic restore failed"
DUMP="$(find "$DRILL" -name '*.dump' -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)"
[[ -n "$DUMP" ]] || die "no dump found in the restic snapshot"
say "using $(basename "$DUMP")"

say "starting throwaway postgres"
docker run -d --rm --name "$NAME" --network none \
  -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=routeplanner \
  -v "$DUMP:/dump:ro" \
  postgres:18.6 >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres -d routeplanner >/dev/null 2>&1 && break
  sleep 2
done

say "pg_restore"
docker exec "$NAME" pg_restore -U postgres -d routeplanner --no-owner --no-privileges --exit-on-error /dump \
  || die "pg_restore failed"

say "checking"
q() { docker exec "$NAME" psql -U postgres -d routeplanner -At -c "$1"; }
MIGRATIONS="$(q 'SELECT count(*) FROM schema_migrations')"
USERS="$(q 'SELECT count(*) FROM users')"
CONTRACTS="$(q 'SELECT count(*) FROM contract_versions')"
EXTS="$(q "SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension WHERE extname IN ('pgcrypto','btree_gist')")"

printf '  schema_migrations  %s\n  users              %s\n  contract_versions  %s\n  extensions         %s\n' \
  "$MIGRATIONS" "$USERS" "$CONTRACTS" "$EXTS"

[[ "$MIGRATIONS" -ge 25 ]] || die "expected at least 25 migrations, got $MIGRATIONS"
[[ "$USERS" -ge 1 ]] || die "no users restored"
[[ "$EXTS" == "btree_gist,pgcrypto" ]] || die "extensions missing: $EXTS"

say "restore drill passed"
