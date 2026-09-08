# syntax=docker/dockerfile:1.7
#
# Route Planner container image. Two usable targets:
#
#   tools   - full dependency tree + db/ + src/. Runs migrations and the
#             notification drainer. No Next build, so it is cheap and does not
#             need a database to build.
#   runner  - the production web server: Next.js standalone output on
#             node:22-slim, non-root, nothing else.
#
# Build ONLY through deploy/scripts/deploy.sh. The runner build prerenders
# tour, transfer and legal pages from the database, so it needs
#   --network=host                  (Postgres is published on 127.0.0.1:5432)
#   --secret id=build_env,src=...   (DATABASE_URL and friends, never baked in)
# and the script supplies both. A bare `docker build .` fails on purpose:
# config.ts refuses to load without SESSION_SECRET and DATABASE_URL.
#
# Turbopack (Next 16's default) currently drops serverExternalPackages
# (postgres, bcryptjs) from the standalone trace: vercel/next.js#87737 and
# #91654, fix unmerged as of 2026-09. `--webpack` is the verified workaround;
# the app has no custom webpack config so it is a drop-in. Re-check the issues
# before removing the flag.

# ---------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# --include=optional is load-bearing: every native binary (lightningcss,
# esbuild, swc) is an optional dependency and is skipped without it.
RUN npm ci --include=optional

# ---------------------------------------------------------------------------
FROM deps AS tools
COPY tsconfig.json ./
COPY db ./db
COPY src ./src
COPY deploy/scripts/dispatch-notifications.ts ./deploy/scripts/dispatch-notifications.ts
COPY deploy/app/entrypoint.sh /app/entrypoint.sh
RUN chmod 0555 /app/entrypoint.sh && chown -R node:node /app
USER node
# server-only's default export throws outside a React server bundle; the
# react-server condition resolves it to the empty module instead.
ENV NODE_OPTIONS=--conditions=react-server
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npx", "tsx", "db/migrate.ts"]

# ---------------------------------------------------------------------------
FROM deps AS builder
COPY . .
ENV NODE_ENV=production NEXT_OUTPUT=standalone
# Public config from git, secrets from the BuildKit secret; both are needed
# because legal pages and canonical URLs are prerendered here.
RUN --mount=type=secret,id=build_env,required=true \
    sh -c 'set -a; . ./deploy/env/app.public.env; . /run/secrets/build_env; set +a; npx next build --webpack'

# ---------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node deploy/app/entrypoint.sh deploy/app/smoke.mjs ./
RUN chmod 0555 /app/entrypoint.sh && mkdir -p /app/.next/cache && chown node:node /app/.next/cache
# Declared late so changing the commit never invalidates the build cache.
ARG BUILD_COMMIT=local
ENV BUILD_COMMIT=$BUILD_COMMIT
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]
