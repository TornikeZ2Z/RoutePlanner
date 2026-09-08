#!/bin/sh
# Runs ONCE, when the data directory is first initialised. Creates the two
# roles the stack uses besides the superuser:
#
#   routeplanner  owns the database. Runs migrations and serves the app. Not a
#                 superuser; pgcrypto and btree_gist are trusted extensions, so
#                 ownership of the database is enough to CREATE EXTENSION.
#   backup        read-only (pg_read_all_data). Reserved for an off-host
#                 replica or dump client; the nightly dump itself runs inside
#                 this container as postgres over the unix socket.
#
# Passwords are read from the files vault-agent rendered. They are hex from
# `openssl rand`, so they need no URL-encoding in DATABASE_URL.
set -eu

APP_PW="$(cat /secrets/postgres/app_password)"
BACKUP_PW="$(cat /secrets/postgres/backup_password)"

psql -v ON_ERROR_STOP=1 -v app_pw="$APP_PW" -v backup_pw="$BACKUP_PW" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE routeplanner LOGIN PASSWORD :'app_pw';
CREATE ROLE backup LOGIN PASSWORD :'backup_pw';
GRANT pg_read_all_data TO backup;

ALTER DATABASE routeplanner OWNER TO routeplanner;
REVOKE ALL ON DATABASE routeplanner FROM PUBLIC;
GRANT CONNECT ON DATABASE routeplanner TO backup;
SQL

echo "01-roles: routeplanner (owner) and backup (read-only) created"
