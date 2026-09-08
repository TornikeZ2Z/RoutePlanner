# Hosting Route Planner on premise

**Audience:** the Claude Code session doing the work on the new server, and the
human operator (Tornike) sitting next to it. Written 2026-09-09 against commit
`31ac1b1` and the files under `deploy/`.

This is a runbook, not an essay. Every step has a command, the result to
expect, and what to do if it does not appear. Steps marked **HUMAN** are done
by the operator in their own terminal, because they involve a value Claude
must never see (unseal keys, a password, a tunnel login) or a change Claude
must never make on its own judgement (DNS, disks, shutting the old host down).

`HANDOVER.md` still holds the parts that do not change with the hosting
platform: what the system is (§1), what does not move (§7), the things that
bite (§8), the invariants the database enforces (§9), the manual verification
checklist (§11) and the open items (§12). Read those first. This document
replaces its §4–§6 and §10.

---

## 0. The shape of it

| | Decision | Why |
|---|---|---|
| OS | Ubuntu 22.04 LTS | The operator's choice. Standard support ends **April 2027**; everything here is identical on 24.04, so plan that move. |
| Runtime | Docker Compose, one host, one app container | Reproducible, rollback is a tag. One instance because rate limits live in process memory (`src/lib/security.ts`). |
| Ingress | Cloudflare Tunnel | Zero inbound ports. Keeps the WAF, `cf-connecting-ip`, and Cloudflare Access for staff MFA at the edge (the app has none). |
| Secrets | HashiCorp Vault 2.1, self-hosted, Raft storage | Audit trail, rotation, at-rest encryption, and the values stay out of Claude's transcript. OpenBao is a drop-in if licensing ever matters. |
| Database | PostgreSQL 18.6 | Replaces Neon. Extensions `pgcrypto`, `btree_gist`. |
| Object storage | Garage 2.4 (S3-compatible) | Replaces R2. MinIO's community edition was archived in April 2026. Path-style S3, which `src/lib/storage/index.ts` already does when `S3_ENDPOINT` is set. |
| Backups | restic to Cloudflare R2 | Encrypted client-side, off-site, versioned. Nightly + monthly restore drill. |
| Monitoring | Uptime Kuma on the host + one external check | Kuma sees inside the stack; the external check sees the host die. |

**How secrets flow.** Vault holds them. One `vault-agent` container authenticates
with an AppRole (its `secret_id` is a root-owned file on the host) and renders
each consumer's secrets into a tmpfs directory under `/run/routeplanner/secrets/`
that only that consumer mounts. The app's entrypoint sources its file into the
process environment and `exec`s the server. Nothing has a secret in its image,
its compose definition, or `docker inspect`. After a reboot `/run` is empty and
Vault is sealed; the operator unseals, the agent re-renders, everything
self-heals. Section 14 has that procedure.

**What Vault does and does not protect against.** It gives you: an audit log of
every read, one place to rotate, encryption at rest, separation between "Claude
can run commands on this box" and "Claude has seen the SMTP password". It does
not protect against a root compromise of the host: root can read the AppRole
files and the rendered tmpfs. That is the honest threat model of a single
on-premise machine, and it is why the host itself is hardened (section 3), why
the data disk is encrypted, and why backups are encrypted with a key that is
not on the box.

**The one operational tax.** Vault seals on every restart of its container and
on every host reboot. Until a human enters three of the five unseal keys,
nothing that needs a secret can start. The tunnel and SSH do **not** need Vault
(their credentials live on disk on purpose), so the operator can always get in.
If unattended reboots ever matter more than zero cloud dependency, section 14.6
describes auto-unseal with Google Cloud KMS; it is a config change, not a
redesign.

---

## 1. Rules for the Claude Code session

Copy `deploy/claude/settings.json` to `.claude/settings.local.json` in the
server's checkout before starting. It denies the commands below at the harness
level. The rules still need stating, because a deny list is a net, not a fence.

1. **Never print a secret value.** Not with `cat`, `less`, `head`, `docker
   inspect`, `docker compose config`, `env`, `printenv`, `vault kv get`, `vault
   token lookup`, `journalctl` on a container that logs its environment, or a
   script that echoes one. When you need to know a secret *exists*, use
   `deploy/scripts/vault-keys.sh <path>` (names and lengths only), or `stat` and
   `wc -c` on a rendered file. When you need to know it *works*, start the
   consumer and watch its health.
2. **Never type a secret value.** Generated secrets are made by
   `deploy/scripts/vault-seed.sh`, which pipes `openssl rand` straight into
   Vault. Third-party secrets (SMTP app password, smsoffice key, R2 token,
   restic password) are entered by the human with `vault kv patch … KEY=-`,
   reading from their terminal. If the human pastes a secret into the chat,
   say so, do not use it, and ask them to rotate it.
3. **Unseal keys and the root token are not yours.** `vault operator init`,
   `unseal`, `rekey`, `generate-root` are HUMAN commands. You may run `vault
   status` to see whether it is sealed.
4. **Stop and ask before:** any DNS change; anything in the Cloudflare
   dashboard; `cryptsetup`, `mkfs`, `fdisk`; anything under
   `/srv/routeplanner/data`; `restic forget`/`prune` outside `backup.sh`;
   turning Render or Neon off; `git push`; a reboot.
5. **Verify deploys by fingerprint, not by 200.** `/api/health` reports
   `build`; it must equal the commit you deployed. `deploy.sh` checks this and
   rolls back on mismatch. Do not bypass it.
6. **Work from the checkout, run from root.** The repo is owned by `ops`; the
   scripts in `deploy/scripts/` need root (`sudo`). Root has
   `safe.directory` set for the repo (section 4).
7. **Log what you did** in the conversation as you go: the command, the
   observed result, the next step. The human is reading it.

---

## 2. What the human must have ready

Do these before the session starts. Nothing in section 3 onward can begin
without the first three.

| # | Item | Where it goes |
|---|---|---|
| 1 | The server: Ubuntu 22.04 minimal, ≥ 4 vCPU, ≥ 8 GB RAM (the image build needs ~3 GB free), ≥ 100 GB disk, ideally a **second disk or partition for data** (LUKS goes on it). Static LAN address. | — |
| 2 | An SSH key pair for the operator; the public key on the server for user `ops`. Password login will be disabled. | `~ops/.ssh/authorized_keys` |
| 3 | Cloudflare: the `routeplanner.ge` and `routegeorgia.ge` zones (already there), a **Zero Trust** organisation on the free plan, and Google Workspace added as an identity provider (Zero Trust → Settings → Authentication → Google Workspace; needs a GCP OAuth client). One-time PIN as the fallback IdP. | Cloudflare dashboard |
| 4 | **Cloudflare R2**: a bucket `routeplanner-backups` and an API token scoped to that bucket, read/write. | Vault, `kv/routeplanner/prod/backup` |
| 5 | The current **Neon `DATABASE_URL`** (from Render's dashboard) for the one-time dump. | A file `/root/neon.env` on the server, 0600, deleted after section 8 |
| 6 | The Google Workspace **app password** for `info@routeplanner.ge` (already provisioned, works from any host). | Vault, `kv/routeplanner/prod/app` |
| 7 | The **smsoffice.ge API key**. | Vault, `kv/routeplanner/prod/app` |
| 8 | A **restic repository password**, generated in a password manager, ≥ 32 characters. This one is stored in Vault **and** offline: without it the backups are noise. | Vault + password manager |
| 9 | **Five custodians (or five places) for the Vault unseal keys**, threshold three. Password manager entries, a printed copy in a safe, a second person. Never on the server, never in the chat. | Offline |
| 10 | A **LUKS keyfile** decision: keyfile on the root filesystem (unattended boot, protects against disk theft only) or passphrase at boot (protects the host at rest, needs a human at every boot). Since Vault already needs a human after a reboot, passphrase-at-boot costs little extra. This document uses the keyfile; swap `crypttab` if you prefer. | — |
| 11 | A **notification channel** for Uptime Kuma (Telegram bot, or the Google SMTP above). | Kuma settings |
| 12 | Decide **22.04 or 24.04** now. This document is written for 22.04 as asked. | — |

---

## 3. Host preparation

All as root (`sudo -i` for the human; Claude uses `sudo <command>`).

### 3.1 Users and groups

```bash
apt update && apt full-upgrade -y
apt install -y unattended-upgrades ufw fail2ban restic git jq openssl cryptsetup curl ca-certificates gnupg lsb-release

# The operator. Key-only, sudo.
adduser --disabled-password --gecos "" ops
usermod -aG sudo ops
install -d -m 0700 -o ops -g ops /home/ops/.ssh
# HUMAN: put the public key in /home/ops/.ssh/authorized_keys, chmod 0600, chown ops:ops

# Numeric ids the containers run as. Named so `ls -l` is readable; no login.
groupadd -g 1100 vault      && useradd -u 1100 -g 1100 -M -s /usr/sbin/nologin vault
groupadd -g 1200 vault-agent && useradd -u 1200 -g 1200 -M -s /usr/sbin/nologin vault-agent
groupadd -g 1300 garage     && useradd -u 1300 -g 1300 -M -s /usr/sbin/nologin garage
```

Expect: `id vault-agent` → `uid=1200(vault-agent) gid=1200(vault-agent)`.

### 3.2 SSH

```bash
cat > /etc/ssh/sshd_config.d/10-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
X11Forwarding no
AllowTcpForwarding yes
AllowUsers ops
MaxAuthTries 3
LoginGraceTime 20
EOF
sshd -t && systemctl reload ssh
```

**HUMAN:** open a second SSH session as `ops` and confirm it works *before*
closing the first one. `AllowTcpForwarding yes` is needed for the port-forwards
to the Vault UI and Kuma.

### 3.3 Firewall, fail2ban, updates, time, swap

```bash
# Inbound: nothing except SSH. The tunnel is outbound. 172.16/12 is the
# docker networks, for the SSH-over-Access ingress (section 9).
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow from 172.16.0.0/12 to any port 22 proto tcp
ufw --force enable
ufw status verbose

cp /srv/routeplanner/repo/deploy/host/jail.local /etc/fail2ban/jail.local   # after section 4; or paste it now
systemctl enable --now fail2ban

# Security updates on their own, but NEVER an automatic reboot: that seals Vault.
dpkg-reconfigure -f noninteractive unattended-upgrades
grep -q 'Automatic-Reboot "true"' /etc/apt/apt.conf.d/50unattended-upgrades && echo "FIX THIS: set Automatic-Reboot false"

timedatectl                 # expect: System clock synchronized: yes
                            # (TOTP and Cloudflare Access JWTs need correct time)

# Vault runs with mlock disabled, so its memory must never page to disk.
swapoff -a
sed -i.bak '/\sswap\s/ s/^/#/' /etc/fstab
rm -f /swap.img
free -h                     # expect: Swap 0B
```

Docker publishes ports by writing iptables rules *ahead* of ufw; a published
port would bypass this firewall. That is why `deploy/docker-compose.yml`
publishes nothing except to `127.0.0.1`, and why `daemon.json` pins the
default publish address to `127.0.0.1` as well.

### 3.4 Encrypted data disk

Everything persistent (database, object storage, Vault, backups staging) lives
under `/srv/routeplanner`. If the server has a second disk, encrypt it and mount
it there. If it has one disk, either the OS was installed with full-disk
encryption or you accept unencrypted data at rest; **write down which**.

**HUMAN** (destroys the disk; check the device name twice):

```bash
lsblk                                            # identify the data disk, e.g. /dev/sdb
DISK=/dev/sdb
install -d -m 0700 /etc/luks-keys
dd if=/dev/urandom of=/etc/luks-keys/data.key bs=64 count=1 && chmod 0400 /etc/luks-keys/data.key
cryptsetup luksFormat --type luks2 "$DISK" /etc/luks-keys/data.key
cryptsetup open "$DISK" data --key-file /etc/luks-keys/data.key
mkfs.ext4 -L routeplanner /dev/mapper/data
echo "data UUID=$(blkid -s UUID -o value "$DISK") /etc/luks-keys/data.key luks,nofail" >> /etc/crypttab
mkdir -p /srv/routeplanner
echo "/dev/mapper/data /srv/routeplanner ext4 defaults,nofail,noatime 0 2" >> /etc/fstab
mount -a && df -h /srv/routeplanner
```

Back the header up somewhere that is not this disk:
`cryptsetup luksHeaderBackup "$DISK" --header-backup-file /root/luks-header.img`
and move that file off the machine. Without the header, the disk is unreadable
even with the key.

### 3.5 Directory layout

```bash
install -d -m 0755 /srv/routeplanner
install -d -m 0755 -o ops  -g ops  /srv/routeplanner/repo
install -d -m 0700 -o 999  -g 999  /srv/routeplanner/data/postgres
install -d -m 0700 -o 1300 -g 1300 /srv/routeplanner/data/garage/meta /srv/routeplanner/data/garage/data
install -d -m 0700 -o 1100 -g 1100 /srv/routeplanner/data/vault /srv/routeplanner/data/vault-audit
install -d -m 0700                 /srv/routeplanner/data/kuma
install -d -m 0755                 /srv/routeplanner/secrets
install -d -m 0755                 /srv/routeplanner/secrets/tls
install -d -m 0750 -o 65532 -g 65532 /srv/routeplanner/secrets/cloudflared
install -d -m 0700                 /srv/routeplanner/secrets/cloudflared-account
install -d -m 0700                 /srv/routeplanner/backups /srv/routeplanner/backups/postgres
install -d -m 0700 -o 1100 -g 1100 /srv/routeplanner/backups/vault      # written by the vault-snapshot container
```

| Path | Owner | Mode | Holds |
|---|---|---|---|
| `repo/` | ops | 0755 | git checkout; root runs the scripts in it |
| `data/postgres` | 999 | 0700 | the cluster (`/var/lib/postgresql` in the container) |
| `data/garage/{meta,data}` | 1300 | 0700 | object storage |
| `data/vault` | 1100 | 0700 | Raft storage, encrypted by Vault |
| `data/vault-audit` | 1100 | 0700 | audit log, values HMAC'd |
| `data/kuma` | root | 0700 | Uptime Kuma's SQLite |
| `secrets/tls` | root | 0755 | CA and Vault server cert; `vault.key` is 0440 root:1100 |
| `secrets/approle` | 1200 | 0750 | `role_id`, `secret_id` (0400). Written by `bootstrap.sh`. |
| `secrets/cloudflared` | 65532 | 0750 | the tunnel's `<uuid>.json` (0400). Outside Vault on purpose. |
| `secrets/cloudflared-account` | root | 0700 | `cert.pem` from `tunnel login`; only needed to create tunnels and DNS routes |
| `backups/` | root | 0700 | dumps staged for restic; local copies kept 7 days. `backups/vault` is 1100:1100 (the snapshot job writes it) |
| `/run/routeplanner/secrets/*` | 1200 | 0750 | tmpfs, rendered by the agent, gone at reboot |

### 3.6 Docker

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

install -m 0644 /srv/routeplanner/repo/deploy/host/daemon.json /etc/docker/daemon.json   # after section 4
systemctl enable --now docker
systemctl restart docker
docker info --format '{{.LoggingDriver}} {{.LiveRestoreEnabled}}'     # expect: json-file true
docker compose version                                                # expect: v2.x
```

Do **not** add `ops` to the `docker` group: that is root by another name. The
scripts run under `sudo`.

`daemon.json` sets: log rotation (10 MB × 3 per container), `live-restore`
(a dockerd restart does not kill containers), `"ip": "127.0.0.1"` (any port
that does get published binds to loopback), `no-new-privileges` by default,
and `icc: false` (containers on the default bridge cannot talk to each other;
the compose networks are unaffected).

### 3.7 tmpfs for rendered secrets, and the HashiCorp CLI

```bash
install -m 0644 /srv/routeplanner/repo/deploy/host/routeplanner-tmpfiles.conf /etc/tmpfiles.d/routeplanner.conf
systemd-tmpfiles --create /etc/tmpfiles.d/routeplanner.conf
ls -la /run/routeplanner/secrets/          # expect five dirs, 0750, owner 1200

# vault CLI on the host: the operator logs in here, the scripts use that login.
curl -fsSL https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /etc/apt/keyrings/hashicorp.gpg
echo "deb [signed-by=/etc/apt/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" > /etc/apt/sources.list.d/hashicorp.list
apt update && apt install -y vault
cat > /etc/profile.d/vault.sh <<'EOF'
export VAULT_ADDR=https://127.0.0.1:8200
export VAULT_CACERT=/srv/routeplanner/secrets/tls/ca.crt
EOF
vault version                              # expect 2.1.x, matching the image tag in compose
```

### 3.8 Outbound reachability

The app and the stack need these. Test each from the host; a timeout is the
symptom of a blocked port and looks exactly like a credentials problem.

| Destination | Port | Used by |
|---|---|---|
| `region1.v2.argotunnel.com`, `region2.v2.argotunnel.com` | 7844 TCP **and UDP** | cloudflared (QUIC, falls back to HTTP/2 on TCP 7844, not 443) |
| `smtp.gmail.com` | 465 TCP | transactional mail |
| `api.resend.com`, `smsoffice.ge`, `router.project-osrm.org`, `api.open-meteo.com`, `api.mymemory.translated.net` | 443 | mail fallback, SMS, routing, weather, translation |
| `*.r2.cloudflarestorage.com` | 443 | restic backups |
| `registry-1.docker.io`, `ghcr.io`, `registry.npmjs.org`, `apt.releases.hashicorp.com`, `download.docker.com` | 443 | images, packages |
| `github.com` | 22 or 443 | `git fetch` |

```bash
nc -vz -w 5 smtp.gmail.com 465            # HANDOVER §8: the one that was blocked on Render
nc -vz -w 5 region1.v2.argotunnel.com 7844
nc -vzu -w 5 region1.v2.argotunnel.com 7844
curl -sS -o /dev/null -w '%{http_code}\n' https://router.project-osrm.org/route/v1/driving/44.8,41.7;41.6,41.6
```

If 465 hangs, mail will use Resend: set `RESEND_API_KEY` in Vault (section 6)
and leave the SMTP variables alone; `getTransport()` prefers SMTP only when
host, user and password are all present.

---

## 4. Repository and image

### 4.1 Clone

As `ops`, with a **read-only deploy key** on the GitHub repository (Settings →
Deploy keys; do not use a personal key):

```bash
sudo -u ops ssh-keygen -t ed25519 -N "" -C "routeplanner-onprem-deploy" -f /home/ops/.ssh/deploy_ed25519
cat /home/ops/.ssh/deploy_ed25519.pub        # HUMAN adds this to GitHub as a read-only deploy key
sudo -u ops tee /home/ops/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/deploy_ed25519
  IdentitiesOnly yes
EOF
sudo -u ops git clone git@github.com:TornikeZ2Z/RoutePlanner.git /srv/routeplanner/repo
git config --global --add safe.directory /srv/routeplanner/repo    # as root: the scripts run as root in ops's checkout
```

Now the files referenced in section 3 exist; go back and install `jail.local`,
`daemon.json` and the tmpfiles config if you skipped them.

```bash
cd /srv/routeplanner/repo
chmod 0755 deploy/scripts/*.sh deploy/vault/*.sh deploy/app/entrypoint.sh deploy/postgres/init/01-roles.sh
cp deploy/claude/settings.json .claude/settings.local.json
sudo install -m 0755 deploy/host/dc /usr/local/bin/dc      # `dc` = docker compose for this stack, from anywhere
dc version                                                  # expect: Docker Compose version v2.x
```

`dc` is used throughout the rest of this document. It is a two-line wrapper
that passes the project directory and compose file (`deploy/host/dc`), so it
works from any directory and from Claude's non-interactive shells.

### 4.2 What changed in the code for this

Two small changes, already in the repository, both no-ops for Render:

- `next.config.ts` sets `output: "standalone"` **only** when `NEXT_OUTPUT=standalone`,
  which only the Dockerfile sets. `next start` on Render is untouched.
- `src/app/api/health/route.ts` reports `BUILD_COMMIT` (set by `deploy.sh`)
  and falls back to `RENDER_GIT_COMMIT`.

The `Dockerfile` has two targets. `tools` is the full dependency tree plus
`db/` and `src/` for migrations and the outbox drainer. `runner` is the
standalone server on `node:22-slim` as user `node`. Read the header comment:
the build must use `next build --webpack` because Turbopack currently drops
`postgres` and `bcryptjs` from the standalone trace (vercel/next.js#87737,
#91654), and it must run with `--network=host` because prerendering reads the
database. `deploy/scripts/deploy.sh` is the only supported way to build.

Nothing here is built yet: the runner build needs Postgres and the rendered
secrets. Section 9 does the first build.

---

## 5. Vault

### 5.1 TLS and first start

```bash
cd /srv/routeplanner/repo
sudo deploy/vault/make-ca.sh /srv/routeplanner/secrets/tls
# expect: "created CA", "server certificate", SAN line with DNS:vault, IP:127.0.0.1, IP:172.28.0.10
ls -la /srv/routeplanner/secrets/tls          # vault.key 0440 root:vault(1100), ca.crt 0444

dc pull vault
dc up -d vault
dc logs vault | tail -20                      # expect: "security barrier not initialized"
vault status                                  # expect: Initialized false, Sealed true
```

### 5.2 Initialise and unseal (HUMAN)

In the operator's own terminal. The output contains five unseal keys and the
root token. It is displayed once. The human copies it into the password
manager entries agreed in section 2, then clears the terminal.

```bash
 vault operator init -key-shares=5 -key-threshold=3     # leading space: keeps it out of bash history
 vault operator unseal      # paste key 1
 vault operator unseal      # key 2
 vault operator unseal      # key 3
vault status                # expect: Sealed false
 vault login                # paste the root token; it is stored in /root/.vault-token (0600)
clear
```

Claude confirms with `vault status` only.

### 5.3 Configure

```bash
sudo OPERATOR=ops deploy/vault/bootstrap.sh
```

This enables the file audit device, mounts `kv/` (KV v2), writes the two
policies from `deploy/vault/policies/`, creates the AppRole
`routeplanner-agent` bound to `172.28.0.0/24`, writes its `role_id` and
`secret_id` to `/srv/routeplanner/secrets/approle/` (0400, uid 1200), enables
`userpass`, and asks the **human** to type the operator's password (not
echoed, read from stdin, not argv). It ends by printing the TOTP method id and
entity id and the one command the human runs next.

**HUMAN:** run the printed `admin-generate` command, scan the QR in an
authenticator app, then:

```bash
sudo deploy/vault/bootstrap-finish.sh <method-id>
```

It turns MFA enforcement on, asks the human to prove `vault login
-method=userpass username=ops` works (password, then TOTP code), and only then
revokes the root token. From here on the operator logs in with userpass+TOTP
and gets an 8-hour token; the scripts use whatever login `root` currently has
in `/root/.vault-token`.

Expect afterwards:

```bash
vault auth list                    # approle/, userpass/, token/
vault policy list                  # default, operator, routeplanner-agent, root
vault audit list                   # file/
ls -la /srv/routeplanner/secrets/approle   # role_id, secret_id: 0400 vault-agent
```

### 5.4 The UI

`https://127.0.0.1:8200` on the server. From the operator's laptop:
`ssh -L 8200:127.0.0.1:8200 ops@<server>` then open `https://127.0.0.1:8200`.
The browser will warn about the private CA; import
`/srv/routeplanner/secrets/tls/ca.crt` into the laptop's trust store or click
through. Sign in: method Username, then the TOTP prompt.

---

## 6. Populate the secrets

Every secret the stack uses, where it lives, who supplies it, who reads it:

| KV path | Key | Supplied by | Rendered to | Consumer |
|---|---|---|---|---|
| `kv/routeplanner/prod/postgres` | `SUPERUSER_PASSWORD` | generated | `postgres/superuser_password` | postgres (initdb only) |
| | `APP_PASSWORD` | generated | `postgres/app_password`, inside `DATABASE_URL` in `app/app.env` and `build/build.env` | postgres init, app, tools, build |
| | `BACKUP_PASSWORD` | generated | `postgres/backup_password` | postgres init (role `backup`) |
| `kv/routeplanner/prod/garage` | `RPC_SECRET`, `ADMIN_TOKEN` | generated | `garage/rpc_secret`, `garage/admin_token` | garage |
| | `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` | generated; human imports into Garage (§7.3) | `S3_*` in `app/app.env` | app |
| `kv/routeplanner/prod/app` | `SESSION_SECRET` | generated | `app/app.env` | app; also signs the sandbox payment webhook and impersonation cookies |
| | `CHANGE_REQUEST_TOKEN` | generated | `app/app.env` | app; the only auth on the `/r/<token>` form |
| | `SMTP_PASSWORD` | **human** (Google app password) | `app/app.env` | app |
| | `SMSOFFICE_API_KEY` | **human** | `app/app.env` | app |
| | `RESEND_API_KEY` | human, only if SMTP is blocked | `app/app.env` | app |
| | `ROUTING_API_KEY` | empty (OSRM needs none) | `app/app.env` | app |
| `kv/routeplanner/prod/backup` | `RESTIC_REPOSITORY` | **human** (R2 endpoint + bucket) | `backup/backup.env` | backup.sh, restore-drill.sh |
| | `RESTIC_PASSWORD` | **human**, also stored offline | `backup/backup.env` | same |
| | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | **human** | `backup/backup.env` | same |
| | `KUMA_PUSH_URL` | human, after §13 | `backup/backup.env` | backup.sh |
| (agent token sink) | — | Vault | `backup/vault-token` | vault-snapshot |

Everything **not** in that table is public configuration and lives in
`deploy/env/app.public.env`, committed to git.

```bash
sudo deploy/scripts/vault-seed.sh
```

Creates the four paths with every generated value in place and every
human-supplied value empty. It refuses to touch a path that already exists.
Then the **HUMAN** fills in the empties it lists (each reads from the terminal;
type the value, Enter, Ctrl-D):

```bash
 vault kv patch kv/routeplanner/prod/app    SMTP_PASSWORD=-
 vault kv patch kv/routeplanner/prod/app    SMSOFFICE_API_KEY=-
 vault kv patch kv/routeplanner/prod/backup RESTIC_REPOSITORY=-       # s3:https://<account-id>.r2.cloudflarestorage.com/routeplanner-backups
 vault kv patch kv/routeplanner/prod/backup RESTIC_PASSWORD=-
 vault kv patch kv/routeplanner/prod/backup R2_ACCESS_KEY_ID=-
 vault kv patch kv/routeplanner/prod/backup R2_SECRET_ACCESS_KEY=-
```

Claude checks, without seeing values:

```bash
sudo deploy/scripts/vault-keys.sh kv/routeplanner/prod/app
# SESSION_SECRET      set (64 chars)
# CHANGE_REQUEST_TOKEN set (40 chars)
# SMTP_PASSWORD       set (16 chars)      <- must not say EMPTY
# ...
```

### 6.1 Start the agent

```bash
dc up -d vault-agent
dc logs vault-agent | tail                    # expect: "authentication successful", "rendered" × 10
dc ps vault-agent                             # expect: healthy
sudo ls -la /run/routeplanner/secrets/app /run/routeplanner/secrets/postgres
# app.env 0440 vault-agent:vault-agent, non-zero size. Do not cat it.
sudo wc -c /run/routeplanner/secrets/app/app.env
```

If the agent logs `permission denied` on a template, the policy or the path is
wrong; if it logs `no data for key`, a secret is missing from Vault. It exits
on repeated failure (`exit_on_retry_failure = true`) rather than rendering
half a file.

---

## 7. Bring up the data services

### 7.1 Postgres

```bash
dc up -d postgres
dc logs postgres | grep -E 'database system is ready|01-roles|ERROR'
# expect once: "01-roles: routeplanner (owner) and backup (read-only) created"
dc ps postgres                                # healthy
dc exec -T postgres psql -U postgres -d routeplanner -Atc "select rolname from pg_roles where rolname in ('routeplanner','backup')"
```

The init script runs only on an empty data directory. If it did not run
(no `01-roles` line) the directory was not empty: stop, `ls
/srv/routeplanner/data/postgres`, and ask before deleting anything.

### 7.2 Garage

```bash
dc up -d garage
dc logs garage | tail -20
# expect a node id and, with --single-node, a layout applied automatically.
```

If the log says the flag is unknown, edit `deploy/docker-compose.yml` to drop
`--single-node`, restart, and do the layout by hand:

```bash
dc exec garage /garage status                         # note the node id
dc exec garage /garage layout assign -z dc1 -c 200G <node-id>
dc exec garage /garage layout apply --version 1
```

### 7.3 The application's S3 key and bucket (HUMAN for the key)

The key pair was generated into Vault by `vault-seed.sh`. Garage has to be told
about it, and that command takes the secret on its command line, so the human
runs it (from the Vault UI, `kv/routeplanner/prod/garage`, copy
`ACCESS_KEY_ID` and `SECRET_ACCESS_KEY`):

```bash
 dc exec garage /garage key import --yes -n routeplanner-app <ACCESS_KEY_ID> <SECRET_ACCESS_KEY>
```

Then Claude:

```bash
dc exec garage /garage bucket create routeplanner-files
dc exec garage /garage bucket allow --read --write --owner routeplanner-files --key routeplanner-app
dc exec garage /garage bucket info routeplanner-files    # expect the key listed with RW+owner
dc exec garage /garage key info routeplanner-app         # expect the bucket listed; NO --show-secret
```

The bucket has no website access and no public read; the app streams every
object through its own routes (`/api/media/...` for public media, the audited
`/api/admin/documents/[id]` for KYC), so nothing in Garage is ever reachable
from outside.

---

## 8. Move the data from Neon

Nothing else runs yet, so this is a plain dump and restore. HANDOVER §3 sized
it at 12 MB; check the counts, do not assume them.

**HUMAN:** put the Neon connection string in a file, not a command line:

```bash
umask 077
cat > /root/neon.env <<'EOF'
NEON_URL=postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
EOF
```

Claude:

```bash
# Dump with a PG18 client (the postgres:18.6 image), so the server version does not refuse.
sudo docker run --rm --env-file /root/neon.env postgres:18.6 \
  sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-acl' > /srv/routeplanner/backups/neon-$(date +%F).dump
ls -la /srv/routeplanner/backups/neon-*.dump           # expect a few MB, not 0

# Restore AS the app role, so every table is owned by routeplanner (it owns the
# database and pgcrypto/btree_gist are trusted extensions, so CREATE EXTENSION works).
dc exec -T postgres pg_restore -U routeplanner -d routeplanner --no-owner --no-privileges --exit-on-error \
  < /srv/routeplanner/backups/neon-$(date +%F).dump

# Verify. Migrations count must equal the files in db/migrations.
ls /srv/routeplanner/repo/db/migrations/*.sql | wc -l
dc exec -T postgres psql -U routeplanner -d routeplanner -Atc "
  select 'migrations', count(*) from schema_migrations union all
  select 'users', count(*) from users union all
  select 'contract_versions', count(*) from contract_versions union all
  select 'driver_profiles', count(*) from driver_profiles union all
  select 'driver_documents', count(*) from driver_documents union all
  select 'bookings', count(*) from bookings union all
  select 'notifications_pending', count(*) from notifications where state in ('QUEUED','FAILED');"
dc exec -T postgres psql -U routeplanner -d routeplanner -Atc "select extname from pg_extension order by 1"
# expect btree_gist, pgcrypto, plpgsql
dc exec -T postgres psql -U routeplanner -d routeplanner -Atc "select tableowner, count(*) from pg_tables where schemaname='public' group by 1"
# expect a single owner: routeplanner

sudo rm -f /root/neon.env
```

**Georgian text:** verify through the application (section 10), not through a
terminal. HANDOVER §8.

**Object storage.** `driver_documents` was 0 on 2026-08-29. If it is still 0
*and* the human confirms the R2 bucket is empty in the Cloudflare dashboard,
there is nothing to move. Otherwise, with `rclone` (human supplies both sets of
credentials in `~/.config/rclone/rclone.conf`, 0600):

```bash
rclone sync r2:routeplanner-files garage:routeplanner-files --checksum --progress
rclone check r2:routeplanner-files garage:routeplanner-files --one-way
```

Neon stays untouched. It is the rollback until section 11 is complete.

---

## 9. First deploy, tunnel, staging

### 9.1 Build and run the app

```bash
cd /srv/routeplanner/repo
sudo deploy/scripts/deploy.sh main
```

Watch it: lock-file check → tools image → migrations (`Database is up to
date.` since the dump is current) → runner image (this is the slow step,
several minutes, ~3 GB RAM) → `smoke: /api/health 200 build=<sha> status=ok`
→ `rolling out` → `live: routeplanner.ge is serving <sha>`. "Live" here means
the container; nothing routes to it yet.

```bash
dc ps                                          # app: healthy
dc exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))"
# {"status":"ok","build":"<sha7>","databaseMs":N}
dc logs app | tail -20                         # no "[storage] STORAGE_DRIVER=local" error, no config error
```

If the smoke test fails with `Cannot find module 'postgres…'`, the webpack
workaround has regressed; read the Dockerfile header and vercel/next.js#87737.

### 9.2 Create the tunnel

cloudflared runs only as a container; use it for the one-time commands too.
`tunnel login` prints a URL the **human** opens in a browser; it writes
`cert.pem` (an account credential) into the mounted directory.

```bash
cf() { sudo docker run --rm -i -v /srv/routeplanner/secrets/cloudflared:/home/nonroot/.cloudflared cloudflare/cloudflared:latest "$@"; }
cf tunnel login                                            # HUMAN runs this one (needs a browser): opens the URL, picks the routeplanner.ge zone
cf tunnel create routeplanner                              # prints the UUID; writes <uuid>.json
cf tunnel list
```

Move the account credential out of the directory the running tunnel mounts,
put the UUID in the config, and route the two hostnames that exist before
cutover:

```bash
sudo mv /srv/routeplanner/secrets/cloudflared/cert.pem /srv/routeplanner/secrets/cloudflared-account/
sudo chmod 0400 /srv/routeplanner/secrets/cloudflared/*.json
UUID=$(sudo ls /srv/routeplanner/secrets/cloudflared/ | sed -n 's/\.json$//p')
sudo sed -i "s/TUNNEL_UUID/$UUID/g" deploy/cloudflared/config.yml
grep -n "$UUID" deploy/cloudflared/config.yml            # tunnel: and credentials-file: lines

cfa() { sudo docker run --rm -i -v /srv/routeplanner/secrets/cloudflared-account:/home/nonroot/.cloudflared cloudflare/cloudflared:latest "$@"; }
cfa tunnel route dns routeplanner staging.routeplanner.ge
cfa tunnel route dns routeplanner ssh.routeplanner.ge
```

Pin the image now that it has been pulled, so a `latest` change cannot surprise
a restart:

```bash
sudo docker image inspect cloudflare/cloudflared:latest --format '{{index .RepoDigests 0}}'
# put that cloudflare/cloudflared@sha256:... into deploy/docker-compose.yml as the image
dc up -d cloudflared
dc logs cloudflared | tail                                 # expect "Registered tunnel connection" × 4
```

### 9.3 Cloudflare Access (HUMAN, dashboard)

Zero Trust → Access → Applications → Add → Self-hosted. Three applications now,
two more at cutover:

| Application | Domain / path | Policy | Notes |
|---|---|---|---|
| Staging | `staging.routeplanner.ge` (all paths) | Allow: emails ending `@routeplanner.ge` (Google Workspace) | Keeps staging private and un-indexed |
| SSH | `ssh.routeplanner.ge` | same | Settings → enable **browser rendering: SSH**. This is the reboot-recovery path. |
| Admin | `routeplanner.ge/admin*` | same | Server actions post to the page URL, so this covers them |
| Admin API | `routeplanner.ge/api/admin*` | same | KYC document and request-image routes |
| (optional) Kuma | not exposed; SSH port-forward instead | — | |

Session duration 8 h to match the app's staff sessions. Cloudflare's free tier
allows 50 seats; the team is 4 accounts.

### 9.4 Confirm staging

```bash
curl -sS https://staging.routeplanner.ge/api/health          # from anywhere: an Access login page (HTML), not JSON: correct
```

Then the **human**, signed in through Access, in a browser:

- `https://staging.routeplanner.ge/` → the site, Georgian text intact.
- `/api/health` → `{"status":"ok","build":"<sha7>",...}` — the same sha
  `deploy.sh` printed.
- `/ka`, `/en`, `/ru`, `/ka/schools`, a search that returns priced offers
  (OSRM egress), `/login` with the admin account, `/admin/pricing` showing
  15.00 %, `/driver/contract` with **no `{{PLACEHOLDER}}` and no blanks**
  (HANDOVER §11).
- Upload a vehicle photo or document in a driver account and read it back
  (Garage round-trip). Check `dc exec garage /garage bucket info
  routeplanner-files` shows objects.
- Trigger a mail: the FAILED test message HANDOVER §8 left in the outbox
  delivers itself the first time the drainer runs (section 12.2), or use
  `/admin` → notifications console. Check the inbox.

From the server, prove the headers the app depends on arrive:

```bash
dc logs app --since 5m | grep -i 'x-forwarded\|cf-connecting' || true
# Better: in the browser, open /api/health while the operator's IP is known, then
dc exec -T postgres psql -U routeplanner -d routeplanner -Atc "select ip, created_at from sessions order by created_at desc limit 3"
# expect the operator's public IP, not 172.x: cf-connecting-ip is being honoured.
```

If staging fails anything here, fix it here. Nothing customer-facing has
changed yet.

---

## 10. Cutover

Preconditions: section 9.4 passed; a fresh restic backup has run at least once
(section 12) so the rollback story is not "Neon". Choose a quiet hour.

### 10.1 Freeze and final sync

1. **HUMAN:** in Render, turn off auto-deploy (Settings → Auto-Deploy: No).
   Announce a 15-minute maintenance window if anyone is using the admin.
2. Take a final Neon dump and diff row counts against on-prem. If a booking,
   inquiry, or driver application landed on Neon since section 8, re-run the
   restore of just those rows; with the volumes HANDOVER describes, a second
   full restore into a truncated database is simplest:

```bash
# only if Neon changed since section 8
sudo docker run --rm --env-file /root/neon.env postgres:18.6 sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-acl' > /srv/routeplanner/backups/neon-final.dump
dc stop app
dc exec -T postgres psql -U postgres -d postgres -c "drop database routeplanner" -c "create database routeplanner owner routeplanner"
dc exec -T postgres pg_restore -U routeplanner -d routeplanner --no-owner --no-privileges --exit-on-error < /srv/routeplanner/backups/neon-final.dump
dc start app
```

### 10.2 DNS (HUMAN)

The production records currently point at Render. They become CNAMEs to the
tunnel, proxied, so the switch is immediate and reversible:

```bash
cfa tunnel route dns --overwrite-dns routeplanner routeplanner.ge
cfa tunnel route dns --overwrite-dns routeplanner www.routeplanner.ge
cfa tunnel route dns --overwrite-dns routeplanner routegeorgia.ge
cfa tunnel route dns --overwrite-dns routeplanner www.routegeorgia.ge
```

Then add the two production Access applications from the table in 9.3.

### 10.3 Verify from outside

```bash
curl -sS https://routeplanner.ge/api/health                       # JSON, build = the deployed sha
curl -sSI https://www.routeplanner.ge/ | grep -i '^location'       # 301 to https://routeplanner.ge/
curl -sSI https://routegeorgia.ge/ka | grep -i '^location'         # 301 to https://routeplanner.ge/ka
curl -sSI https://routeplanner.ge/admin | grep -i '^location'      # 302 to the Access login
curl -sSI https://routeplanner.ge/ | grep -iE 'strict-transport|content-security|x-frame'
```

Then the HANDOVER §11 checklist once more, on the real domain.

### 10.4 Decommission (after 24 hours of clean traffic)

**HUMAN**, in this order:

1. Render: suspend the `traveller` service. Keep it a week, then delete.
2. Neon: take one last dump to the laptop, then delete the project.
3. R2 `routeplanner-files`: confirm empty or migrated, delete the bucket
   (keep `routeplanner-backups`).
4. In the repository: delete `render.yaml`, `vercel.json`, `deploy.bat`;
   change the tail of `scripts/ship.mjs` to say the deploy is
   `deploy/scripts/deploy.sh` on the server, not Render; commit.
5. Disable the staging Access application's Google policy if staging is no
   longer wanted, or keep it for the next deploy's smoke.

---

## 11. Deploying after cutover

```bash
cd /srv/routeplanner/repo
sudo deploy/scripts/deploy.sh main            # or a tag, or a sha
```

What it guarantees: the lock file installs on Linux; migrations ran before the
new server was built; the new image started and answered `/api/health` in a
throwaway container; the served build id equals the commit; otherwise the
previous image is put back and the script exits non-zero.

What it requires of you: **migrations must be backward-compatible with the
running version**, because they run first. Add columns, do not rename or drop
in the same release as the code that stops using them. HANDOVER §8 already
forbids editing an applied migration.

Rollback by hand, if ever needed:

```bash
cat deploy/.env.previous                      # BUILD_COMMIT=<sha7>
sudo cp deploy/.env.previous deploy/.env
dc up -d --no-deps app
```

Images for the last three deploys are kept; `docker images routeplanner/app`.

---

## 12. Backups

### 12.1 What, where, how often

| What | How | Where | When |
|---|---|---|---|
| Database | `pg_dump -Fc` inside the postgres container | `/srv/routeplanner/backups/postgres` (7 days) → restic | nightly 03:30 |
| Vault | `vault operator raft snapshot save` via the `vault-snapshot` service and the agent's token | `/srv/routeplanner/backups/vault` (7 days) → restic | nightly |
| Garage | latest metadata snapshot (Garage writes one every 6 h) + the immutable data blobs | restic, straight from `data/garage` | nightly |
| Host secrets | `/srv/routeplanner/secrets` (tunnel, AppRole, TLS) | restic | nightly |
| restic retention | `--keep-daily 14 --keep-weekly 8 --keep-monthly 12`, then prune, then a 5 % read check | R2 `routeplanner-backups` | nightly |
| Restore drill | newest dump from **restic**, into a throwaway PG18 on no network, row counts checked | — | monthly, 1st, 05:00 |

Restic encrypts before upload; R2 holds ciphertext. The restic password is in
Vault **and** in the operator's password manager. The Vault snapshot is
useless without three unseal keys. The LUKS header backup is on the laptop.
Those three offline items are the whole disaster-recovery story; the checklist
is in section 15.

### 12.2 Install the timers

```bash
cd /srv/routeplanner/repo/deploy/host
sudo install -m 0644 routeplanner-backup.service routeplanner-backup.timer \
                     routeplanner-dispatch.service routeplanner-dispatch.timer \
                     routeplanner-restore-drill.service routeplanner-restore-drill.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now routeplanner-backup.timer routeplanner-dispatch.timer routeplanner-restore-drill.timer
systemctl list-timers 'routeplanner-*'
```

The dispatch timer is new behaviour: `src/lib/notifications.ts` has always
assumed a scheduled worker drains the outbox, and none existed. Every five
minutes it sends up to 50 queued or failed messages; a message that fails five
times stays FAILED for the admin console to see.

### 12.3 First run, by hand

```bash
sudo sh -c 'set -a; . /run/routeplanner/secrets/backup/backup.env; set +a; restic init'    # once
sudo systemctl start routeplanner-backup.service && sudo journalctl -u routeplanner-backup -n 30
sudo sh -c 'set -a; . /run/routeplanner/secrets/backup/backup.env; set +a; restic snapshots'
sudo systemctl start routeplanner-restore-drill.service && sudo journalctl -u routeplanner-restore-drill -n 30
# expect: "restore drill passed"
```

That `sh -c` form is the sanctioned way to run restic by hand: the credentials
are exported into that one shell and nothing is printed.

---

## 13. Monitoring and alerting

Uptime Kuma runs on the host; reach it with `ssh -L 3001:127.0.0.1:3001
ops@<server>` → `http://127.0.0.1:3001`. **HUMAN** creates the admin account on
first visit and the notification channel from section 2, then these monitors:

| Monitor | Type | Target | Alert when |
|---|---|---|---|
| App (inside) | HTTP(s) – JSON query | `http://app:3000/api/health`, `$.status == ok` | 503 or `degraded` |
| App (public) | HTTP(s) – keyword | `https://routeplanner.ge/api/health`, keyword `"status":"ok"` | anything else |
| Vault | HTTP(s) | `https://vault:8200/v1/sys/health`, ignore TLS or upload `ca.crt` | 503 = **sealed** (reboot happened), 501 = uninitialised |
| Garage | HTTP(s) | `http://garage:3903/health` | non-200 |
| cloudflared | HTTP(s) | `http://cloudflared:2000/ready` | non-200 |
| Postgres | TCP | `postgres:5432` | closed |
| Backup ran | Push | (Kuma gives a URL) | no push in 26 h |
| Disk | — | not in Kuma; see below | |

Put the push URL into Vault so `backup.sh` reports success:

```bash
 vault kv patch kv/routeplanner/prod/backup KUMA_PUSH_URL=-       # HUMAN
```

**External check.** Kuma on the same host cannot see the host go down. Add one
free external monitor (UptimeRobot, Better Stack, or Cloudflare's own health
check if the plan allows) on `https://routeplanner.ge/api/health`, keyword
`"status":"ok"`, notifying the same channel.

**Disk and updates.** A weekly line in the operator's calendar:
`df -h /srv/routeplanner /`, `docker system df`, `apt list --upgradable`,
`vault version` vs the latest 2.x, `dc pull --dry-run`. Section 14 has the
upgrade steps.

---

## 14. Operations runbook

### 14.1 After a reboot

Everything restarts on its own except what needs Vault. Expected state two
minutes after boot: `vault` running but **sealed** (Kuma alerts), `vault-agent`
unhealthy, `garage` and `app` restarting (no secrets file), `postgres` healthy
(it only needs the password at initdb), `cloudflared` connected, `uptime-kuma`
up. The operator gets in through `ssh.routeplanner.ge` (Access) or the LAN.

```bash
vault status                 # Sealed true
 vault operator unseal       # HUMAN, three times
dc ps                        # within ~90 s: vault healthy, agent healthy, garage up, app healthy
```

If `app` stays unhealthy: `dc logs app | tail`. If the secrets directory is
empty: `ls -la /run/routeplanner/secrets/` should show the five dirs from
tmpfiles; if not, `systemd-tmpfiles --create` then `dc restart vault-agent`.

### 14.2 Rotating secrets

| Secret | How | Effect |
|---|---|---|
| Anything in `kv/…/app` | `vault kv patch … KEY=-` (human) or a new generated value; the agent re-renders within 5 min; `dc restart app` | `SESSION_SECRET` rotation invalidates impersonation cookies and sandbox webhook signatures, **not** user sessions (those are DB rows) |
| `APP_PASSWORD` (Postgres) | patch Vault, then `dc exec -T postgres psql -U postgres -c "alter role routeplanner password '<new>'"` run **by the human** (value on the command line), then `dc restart app` | brief downtime |
| Garage app key | new pair in Vault, human `garage key import` the new one, `bucket allow` it, `dc restart app`, then `garage key delete` the old | none if done in that order |
| AppRole `secret_id` | `vault write -f -field=secret_id auth/approle/role/routeplanner-agent/secret-id > /srv/routeplanner/secrets/approle/secret_id` (root, then chown 1200, chmod 0400), `dc restart vault-agent` | none; the old secret_id keeps working until you also `vault write auth/approle/role/routeplanner-agent/secret-id-accessor/destroy` it |
| Tunnel credentials | `cfa tunnel create routeplanner-2`, route the DNS names to it, swap the json and UUID in config, `dc up -d cloudflared`, `cfa tunnel delete routeplanner` | seconds |
| Vault TLS cert (2 years) | `sudo deploy/vault/make-ca.sh /srv/routeplanner/secrets/tls` (reuses the CA), `dc restart vault vault-agent`, unseal | sealed until unsealed |
| Unseal keys | `vault operator rekey` (human, needs 3 keys and, in 2.x, a valid token) | none |
| Operator password | `vault write auth/userpass/users/ops password=-` (human) | none |

### 14.3 Upgrading

- **Vault** has no LTS in the community edition; each minor is supported until
  the next. Read the "important changes" page, bump the tag in
  `docker-compose.yml`, take a Raft snapshot, `dc up -d vault`, unseal, then
  `dc up -d vault-agent`. Keep the host `vault` CLI on the same minor.
- **Postgres** minor (18.x): bump the tag, `dc up -d postgres`. Major: dump,
  new empty data directory, restore, as in section 8.
- **Garage**: read the release notes for migration steps, bump the tag,
  `dc up -d garage`.
- **cloudflared**: repin the digest monthly.
- **Node / Next**: that is a normal code change; `deploy.sh` rebuilds.
- **Ubuntu 22.04 → 24.04** before April 2027: `do-release-upgrade` with the
  stack stopped and a backup taken; every file here is distribution-agnostic.

### 14.4 Restoring from backup

On the same host: `sudo deploy/scripts/restore-drill.sh` proves the dump is
good; then `dc stop app`, drop and recreate the database as in 10.1, restore
the chosen dump, `dc start app`.

On a new host: sections 3–5 (Vault: `operator init` a fresh cluster, or
`vault operator raft snapshot restore` the last snapshot and unseal with the
**old** keys), then `restic restore latest --target /` for `/srv/routeplanner/secrets`,
sections 6.1–7.2 (Garage will find its data), section 8 with the restic dump
instead of Neon, section 9.

### 14.5 When something is wrong

| Symptom | Look at | Likely |
|---|---|---|
| Site down, Kuma "Vault 503" | `vault status` | rebooted; unseal (14.1) |
| Site down, tunnel "Registered" fine, app unhealthy | `dc logs app` | secrets file missing, or DB unreachable |
| `/api/health` degraded | `dc logs postgres`, `df -h` | Postgres down or disk full |
| Emails not sending | admin notifications console, `dc logs tools` via `journalctl -u routeplanner-dispatch` | 465 blocked (test with `nc`), bad app password |
| Uploads fail | `dc logs garage`, `garage bucket info` | key not imported, bucket perms |
| Deploy fails at "smoke" | the smoke output | externals regression (Dockerfile header) or a config error |
| Deploy fails at "migrations" | the migration output | nothing was rolled out; fix and rerun |
| Rate limits not working / everyone limited | sessions table `ip` column | `cf-connecting-ip` missing: traffic is not coming through Cloudflare |
| Disk full | `docker system df`, `/srv/routeplanner/backups`, Docker logs | `docker builder prune`, old images, journald |

### 14.6 Optional: auto-unseal with Google Cloud KMS

If reboots must be unattended: create a KMS key ring and key in GCP, a service
account with `cloudkms.cryptoKeyEncrypterDecrypter` on that key only, and a
JSON key for it stored at `/srv/routeplanner/secrets/gcpkms.json` (root:1100,
0440). Add to `vault.hcl`:

```hcl
seal "gcpckms" {
  credentials = "/vault/tls/gcpkms.json"
  project     = "<project>"
  region      = "global"
  key_ring    = "routeplanner-vault"
  crypto_key  = "unseal"
}
```

Then `vault operator unseal -migrate` three times with the existing keys, once.
From then on Vault unseals itself at start; the five keys become recovery keys.
Cost is cents per month. Trade-off: unsealing now depends on reaching Google.

---

## 15. Appendix

### 15.1 Every variable in `src/lib/config.ts`, and where it comes from

| Variable | Source | Value / note |
|---|---|---|
| `DATABASE_URL` | agent → `app.env` (and `build.env` on loopback) | built from `APP_PASSWORD` |
| `SESSION_SECRET` | agent → `app.env` | generated, 64 hex |
| `APP_URL` | `app.public.env` | `https://routeplanner.ge`; also drives the CSP `upgrade-insecure-requests` |
| `ENFORCE_CANONICAL_HOST` | `app.public.env` | `false` (the onrender rule is dead) |
| `REDIRECT_FORMER_DOMAIN` | `app.public.env` | `true` |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` | `app.public.env` | `s3`, `routeplanner-files`, `http://garage:3900`, `garage` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | agent → `app.env` | Garage key `routeplanner-app` |
| `COMPANY_LEGAL_NAME`, `COMPANY_ID_NUMBER`, `COMPANY_ADDRESS` | `app.public.env` | as registered; address still generic (HANDOVER §12) |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE` | `app.public.env` | phone empty until the SIM exists |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `MAIL_FROM` | `app.public.env` | Google Workspace |
| `SMTP_PASSWORD` | agent → `app.env` | human |
| `RESEND_API_KEY` | agent → `app.env` | empty unless 465 is blocked |
| `SMSOFFICE_SENDER` | `app.public.env` | `Route Plan`, with the space (HANDOVER §8: the stripped form is refused with error 150) |
| `SMSOFFICE_API_KEY` | agent → `app.env` | human |
| `ROUTING_PROVIDER`, `ROUTING_API_KEY` | public / agent | `osrm`, empty |
| `COMMISSION_RATE_BPS` … `CHILD_SEAT_FEE_MINOR` | `app.public.env` | fallbacks; live values in `platform_settings` |
| `CHANGE_REQUEST_TOKEN` | agent → `app.env` | generated; rotate to revoke every `/r/<token>` link |
| `NODE_ENV`, `HOSTNAME`, `PORT` | Dockerfile | `production`, `0.0.0.0`, `3000` |
| `BUILD_COMMIT` | Dockerfile ARG from `deploy.sh` | reported by `/api/health` |
| `TEST_DATABASE_URL`, `SEED_*`, `ADMIN_EMAIL`, `FORCE_RESET`, `LOCKFILE_REFERENCE` | never set in production | dev/seed tooling only |

### 15.2 Offline custody checklist

Kept by the operator, not on the server, not in Vault, not in this repository:

- [ ] Five Vault unseal keys, threshold three, in at least two separate places
- [ ] The restic repository password
- [ ] The LUKS header backup and the knowledge of where the keyfile is
- [ ] The Cloudflare account with 2FA, and the R2 API token's location
- [ ] The Google Workspace admin account
- [ ] The GitHub deploy key's *private* half is on the server only; the account that can add deploy keys is the operator's
- [ ] `cert.pem` in `/srv/routeplanner/secrets/cloudflared-account` is in the restic backup; the Cloudflare login can always mint a new one

### 15.3 Follow-ups noticed while writing this, not blockers

- Three different rules decide the `Secure` cookie flag (`config.isProduction`,
  `appUrl.startsWith("https")`, `NODE_ENV`), and `gt_cookie_notice` /
  `gt_currency` never get it. Harmless behind Cloudflare, worth unifying.
- `src/lib/security.ts` hard-codes `routeplanner.ge` in the same-origin
  allow-list alongside the forwarded host. Fine now; remove if the domain ever
  changes.
- `src/app/[locale]/contact/page.tsx` hard-codes `support@routeplanner.ge`
  instead of reading `SUPPORT_EMAIL`.
- `puppeteer-core` and `@sparticuz/chromium` are unused devDependencies;
  dropping them shrinks the tools image.
- The `restricted-kyc` prefix relies on the app for access control; Garage has
  no per-prefix policy. Same posture as R2 had, documented so nobody assumes
  otherwise.

### 15.4 Files in `deploy/`

| Path | Purpose |
|---|---|
| `docker-compose.yml` | the stack |
| `env/app.public.env` | non-secret app configuration |
| `app/entrypoint.sh`, `app/smoke.mjs` | container entry; pre-rollout smoke test |
| `vault/vault.hcl`, `vault/agent.hcl` | server and agent configuration |
| `vault/policies/*.hcl` | `routeplanner-agent` (read prod secrets, snapshot), `operator` (human admin) |
| `vault/make-ca.sh`, `vault/bootstrap.sh`, `vault/bootstrap-finish.sh` | TLS; one-time configuration in two halves |
| `garage/garage.toml` | single-node object store |
| `cloudflared/config.yml` | tunnel ingress; `httpHostHeader` on every rule |
| `postgres/init/01-roles.sh` | first-init roles |
| `scripts/deploy.sh` | build → migrate → smoke → roll out → verify |
| `scripts/backup.sh`, `scripts/restore-drill.sh` | nightly backup; monthly proof |
| `scripts/dispatch-notifications.ts` | outbox drainer (runs in the tools image) |
| `scripts/vault-seed.sh`, `scripts/vault-keys.sh` | generate secrets without showing them; list key names |
| `host/*` | `daemon.json`, `jail.local`, tmpfiles, systemd units |
| `claude/settings.json` | permissions for a Claude Code session on the host |

---

*If this document and the server disagree, the server is right and this
document has a defect. Fix the document.*
