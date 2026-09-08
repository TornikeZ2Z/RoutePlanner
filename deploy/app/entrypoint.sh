#!/bin/sh
# Load the secrets Vault Agent rendered, then hand over to the real command.
#
# The file is a tmpfs mount owned by the agent's group; the container user is
# a member of that group and nothing else. Values are exported into this
# process only. They never appear in `docker inspect`, compose config, or the
# image. If the file is missing the container exits non-zero instead of
# starting with half a configuration, which is the failure mode config.ts is
# designed to make loud.
set -eu
SECRETS_FILE="${SECRETS_FILE:-/secrets/app/app.env}"
if [ ! -s "$SECRETS_FILE" ]; then
  echo "entrypoint: $SECRETS_FILE is missing or empty. Is vault-agent healthy?" >&2
  exit 78  # EX_CONFIG
fi
set -a
. "$SECRETS_FILE"
set +a
exec "$@"
