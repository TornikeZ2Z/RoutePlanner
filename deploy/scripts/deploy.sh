#!/usr/bin/env bash
# Build, migrate, smoke-test and roll out one git ref. Run as root on the host.
#
#   deploy/scripts/deploy.sh main
#   deploy/scripts/deploy.sh v2026.09.12
#   deploy/scripts/deploy.sh 31ac1b1
#
# Order, and why:
#   1. tools image      no database needed; cheap
#   2. migrate          BEFORE the new server exists, same as Render did. The
#                       runner build prerenders pages from the database, so
#                       the schema must already be current.
#   3. runner image     needs --network=host (Postgres on 127.0.0.1:5432) and
#                       the build secret vault-agent rendered
#   4. smoke test       the new image must start and answer /api/health in a
#                       throwaway container before it touches production
#   5. roll out         swap the app container; verify the served build id
#                       equals the commit; otherwise roll back automatically
#
# Consequence of (2): every migration must be backward-compatible with the
# app version currently running, because a failure after it leaves the old
# code on the new schema. Additive changes only; drop columns in a later
# release. See docs/ON-PREM-HOSTING.md section 13.
set -euo pipefail

REPO=/srv/routeplanner/repo
DEPLOY="$REPO/deploy"
BUILD_ENV=/run/routeplanner/secrets/build/build.env
REF="${1:?usage: deploy.sh <git-ref>}"
KEEP_IMAGES=3

dc() { docker compose --project-directory "$DEPLOY" -f "$DEPLOY/docker-compose.yml" "$@"; }
say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nDEPLOY FAILED: %s\n' "$*" >&2; exit 1; }

# ---- preflight --------------------------------------------------------------
[[ $EUID -eq 0 ]] || die "run as root (secrets and docker socket)"
[[ -s "$BUILD_ENV" ]] || die "$BUILD_ENV is missing: is Vault unsealed and vault-agent healthy?"
dc ps --status running --services | grep -qx postgres || die "postgres is not running"
command -v git >/dev/null || die "git is not installed"

cd "$REPO"
say "fetching $REF"
git fetch --tags --prune origin
# A branch name means the remote's branch, not a stale local one.
if git rev-parse --verify -q "origin/$REF" >/dev/null; then TARGET="origin/$REF"; else TARGET="$REF"; fi
git -c advice.detachedHead=false checkout --detach "$TARGET"
git submodule update --init --recursive 2>/dev/null || true
SHA="$(git rev-parse HEAD)"
SHORT="${SHA:0:7}"
say "deploying $SHORT ($(git log -1 --format='%s' HEAD))"

# The lock file check needs git history, so it runs in a full node image
# rather than the slim one used for the build.
say "checking the lock file installs on Linux"
# safe.directory: the checkout is owned by ops, the container runs as root.
docker run --rm -v "$REPO:/app:ro" -w /app \
  -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/app \
  node:22-bookworm node scripts/check-lockfile.mjs \
  || die "lock file check failed (see scripts/check-lockfile.mjs)"

# ---- 1. tools image ---------------------------------------------------------
say "building tools image"
docker build --target tools -t "routeplanner/tools:$SHORT" "$REPO"

# ---- 2. migrate -------------------------------------------------------------
say "running migrations"
BUILD_COMMIT="$SHORT" dc --profile ops run --rm tools || die "migration failed; nothing was rolled out"

# ---- 3. runner image --------------------------------------------------------
say "building runner image (prerender reads the database over 127.0.0.1)"
DOCKER_BUILDKIT=1 docker build \
  --target runner \
  --network=host \
  --secret "id=build_env,src=$BUILD_ENV" \
  --build-arg "BUILD_COMMIT=$SHA" \
  -t "routeplanner/app:$SHORT" \
  "$REPO"

# ---- 4. smoke test ----------------------------------------------------------
say "smoke-testing the new image"
docker run --rm \
  --network routeplanner_backend \
  --group-add 1200 \
  --security-opt no-new-privileges:true --cap-drop ALL --read-only \
  --tmpfs /tmp --tmpfs /app/.next/cache \
  -v /run/routeplanner/secrets/app:/secrets/app:ro \
  --env-file "$DEPLOY/env/app.public.env" \
  -e "BUILD_COMMIT=$SHA" \
  "routeplanner/app:$SHORT" node smoke.mjs \
  || die "the new image does not start or does not answer /api/health"

# ---- 5. roll out ------------------------------------------------------------
say "rolling out"
PREVIOUS="$(grep -s '^BUILD_COMMIT=' "$DEPLOY/.env" | cut -d= -f2 || true)"
[[ -n "$PREVIOUS" ]] && cp "$DEPLOY/.env" "$DEPLOY/.env.previous"
printf 'BUILD_COMMIT=%s\n' "$SHORT" > "$DEPLOY/.env"
dc up -d --no-deps app

served=""
for _ in $(seq 1 30); do
  sleep 2
  served="$(dc exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>console.log(j.build)).catch(()=>{})" 2>/dev/null | tr -d '\r' || true)"
  [[ "$served" == "$SHORT" ]] && break
done

if [[ "$served" != "$SHORT" ]]; then
  echo "served build is '${served:-none}', expected $SHORT" >&2
  if [[ -n "$PREVIOUS" ]]; then
    say "rolling back to $PREVIOUS"
    cp "$DEPLOY/.env.previous" "$DEPLOY/.env"
    dc up -d --no-deps app
  fi
  die "rollout verification failed"
fi

say "live: routeplanner.ge is serving $SHORT"

# ---- housekeeping -----------------------------------------------------------
# Keep the last few app/tools images for rollback, drop the rest.
for repo in routeplanner/app routeplanner/tools; do
  docker images "$repo" --format '{{.Tag}} {{.CreatedAt}}' \
    | sort -k2 -r | awk 'NR>'"$KEEP_IMAGES"' {print $1}' \
    | xargs -r -I{} docker rmi "$repo:{}" >/dev/null 2>&1 || true
done
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
