# KPI Dashboard — Deploying to a self-managed VPS

A runbook for running this app on a VPS you control (DigitalOcean, Linode,
Hetzner, a bare-metal box, etc.) — from a fresh server to a working,
HTTPS-served production instance. Written for Ubuntu/Debian; adjust package
manager commands if you're on something else.

This is the manual, HTTPS-via-Caddy path. If you want something faster and
don't need TLS termination on this box (e.g. it's Debian 13 and TLS is
handled elsewhere, or you're fine serving plain HTTP), `deploy/install.sh`
automates steps 3–7 below into one script that runs the app directly on
port 80 instead — see [../deploy/install.sh](../deploy/install.sh) and its
companion `deploy/uninstall.sh`. The two approaches aren't meant to be
combined on the same machine; pick one.

**Why a VPS and not a serverless platform (Vercel, Netlify, ...):** this app
uses a local SQLite file (`prisma/dev.db` locally; see below for prod). That
needs a persistent filesystem — serverless platforms give you an ephemeral
one, so the database would silently reset or fail between invocations. A VPS
(or any host with a persistent volume) is the right fit as-is.

**Before you go further: there is no authentication** on `/api/kpis/**` or
`/api/mcp` (a deliberate, documented gap — see [api.md](api.md) and
[mcp.md](mcp.md)). Once this is running on a real, internet-reachable
domain instead of `localhost`, that's a materially bigger exposure than
local testing. Step 8 below adds HTTP basic auth in about three lines if you
want it — cheap enough that it's worth doing even as a stopgap.

## 1. Provision the server

Any provider, Ubuntu 22.04/24.04 LTS. This app is light — 1 vCPU / 1–2 GB RAM
is plenty for a small team's internal tool. Note the server's public IP and
point a DNS `A` record at it for the domain you'll serve this from (needed
for step 8's automatic HTTPS).

## 2. Basic server setup

SSH in as root once, then:

```bash
# Create a non-root user to run everything as
adduser kpiapp
usermod -aG sudo kpiapp

# Firewall: SSH + web only
apt update && apt install -y ufw
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable

# Switch to the new user for everything from here on
su - kpiapp
```

(If you haven't already, disable SSH password auth in favor of keys —
`/etc/ssh/sshd_config`, `PasswordAuthentication no`, then
`systemctl restart sshd`. Standard VPS hardening, not specific to this app.)

## 3. Install Node.js 20+ and build tools

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
node --version   # confirm v20+
```

`build-essential`/`python3` are for `better-sqlite3`'s native module — most
platforms get a prebuilt binary and never need them, but they're a cheap
safety net if this server's exact Node/OS/arch combo doesn't have one
published.

## 4. Get the code and install dependencies

```bash
git clone <your-repo-url> /home/kpiapp/kpi-mng
cd /home/kpiapp/kpi-mng
npm ci   # installs deps + runs `prisma generate` via postinstall
```

`npm ci` (not `npm install`) uses `package-lock.json` exactly as committed —
what you tested locally is what runs here.

## 5. Configure environment

```bash
cp .env.default .env
```

Edit `.env` and set a production-specific database path (keeps it distinct
from anything named `dev.db` in your head, though the app doesn't care what
it's called):

```
DATABASE_URL="file:./prod.db"
```

Nothing else needs configuring — there's no auth secret, no external
service credentials; the only required env var is `DATABASE_URL`.

## 6. Set up the database

```bash
npm run db:migrate:deploy   # `prisma migrate deploy` — applies existing
                             # migrations non-interactively. Not `db:migrate`
                             # (`migrate dev`), which is for local development
                             # and can prompt / create new migrations.
```

Optional — seed example data, or your own (copy
`prisma/.seed.ts.default` to `prisma/seed.ts` and edit it first if you want
real KPIs instead of the example ones):

```bash
npm run db:seed
```

## 7. Build and run as a service

```bash
npm run build
```

Running `next start` directly in your SSH session would die the moment you
disconnect — use systemd so it survives reboots and restarts on crash. Copy
the template from this repo and adjust the paths/user if you didn't use
`kpiapp` / `/home/kpiapp/kpi-mng`:

```bash
sudo cp deploy/kpi-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kpi-dashboard
sudo systemctl status kpi-dashboard   # should show "active (running)"
```

The app is now listening on `127.0.0.1:3000` — not yet reachable from the
internet, which is intentional; that's what the reverse proxy in the next
step is for.

## 8. Reverse proxy + HTTPS

[Caddy](https://caddyserver.com) gets you automatic, auto-renewing HTTPS
with a 3-line config — much less to maintain than nginx + certbot for a
single small app.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Copy the template Caddyfile, then edit it to put in your actual domain:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile   # replace your-domain.example.com
sudo systemctl reload caddy
```

Caddy automatically requests and renews a Let's Encrypt certificate for the
domain on first request — no separate certbot step. Within a minute or two
of reloading, `https://your-domain.example.com` should be live.

**Strongly recommended**: the template Caddyfile includes a commented-out
`basic_auth` block. Given there's no application-level auth (see the warning
at the top of this doc), uncommenting it and setting a username/password is
the cheapest real mitigation available before this is genuinely
internet-facing — three lines, no code changes.

## 9. Verify

```bash
curl https://your-domain.example.com/api/kpis
curl -X POST https://your-domain.example.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_kpis","arguments":{}}}'
```

Both should return real JSON (or a `401` if you enabled basic auth — expected).
Open `https://your-domain.example.com` in a browser to check the dashboard UI.

## 10. Point MCP clients at the production URL

See [mcp.md](mcp.md) and the Claude Code / Claude Desktop configuration
notes there — swap `http://localhost:3000/api/mcp` for
`https://your-domain.example.com/api/mcp`. If you added basic auth in step
8, you'll need to pass credentials through (Claude Code's HTTP transport
supports a `headers` field for this; Claude Desktop's `mcp-remote` bridge
does not cleanly support custom headers, so basic auth via Desktop needs a
different approach — worth revisiting once you know which clients matter).

## 11. Deploying updates

```bash
cd /home/kpiapp/kpi-mng
git pull
npm ci
npm run db:migrate:deploy   # no-op if there are no new migrations
npm run build
sudo systemctl restart kpi-dashboard
```

## 12. Backups

The entire database is one file. Back it up with a daily cron job:

```bash
# crontab -e (as kpiapp)
0 3 * * * sqlite3 /home/kpiapp/kpi-mng/prod.db ".backup '/home/kpiapp/backups/prod-$(date +\%Y\%m\%d).db'"
```

(Create `/home/kpiapp/backups/` first, and prune old backups periodically —
this doesn't do that for you.) Copy backups off the VPS itself periodically
(e.g. `scp` to your own machine, or sync to object storage) — a backup that
only exists on the same disk as the original doesn't protect against disk
failure.
