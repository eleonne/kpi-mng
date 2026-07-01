#!/usr/bin/env bash
#
# Installs the KPI Dashboard as a systemd service on Debian 13, serving
# directly on port 80 (no reverse proxy, no TLS — see docs/deployment.md
# instead if you want HTTPS via Caddy; that's a separate, alternative setup,
# not meant to be combined with this script).
#
# Runs the service as whichever user invokes this script (via sudo), not a
# dedicated service account — simpler, and avoids the cross-user command
# execution that a dedicated-user setup would otherwise need.
#
# Run with sudo, as your normal user, from your checkout:
#   sudo bash deploy/install.sh
#
# Safe to re-run (e.g. after `git pull`) to rebuild and redeploy an update —
# it does not delete data, and re-creates the systemd unit + restarts it.
#
# Override the port: PORT=8080 sudo bash deploy/install.sh
set -euo pipefail

SERVICE_NAME="kpi-dashboard"
PORT="${PORT:-80}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The user who ran `sudo` — i.e. "you", not root. Falls back to whoami if run
# as root directly (not via sudo), in which case the service ends up running
# as root — fine if that's really what you want, but you'll get a warning.
RUN_AS_USER="${SUDO_USER:-$(whoami)}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root: sudo bash deploy/install.sh" >&2
  exit 1
fi

if [ "$RUN_AS_USER" = "root" ]; then
  echo "Warning: no SUDO_USER found, so the service will run as root." >&2
  echo "Prefer running this via 'sudo' as a normal user instead of logged in as root directly." >&2
fi

if [ ! -f "$PROJECT_ROOT/package.json" ] || ! grep -q '"name": "kpi-mng"' "$PROJECT_ROOT/package.json"; then
  echo "Couldn't find the kpi-mng project relative to this script — expected it at $PROJECT_ROOT." >&2
  exit 1
fi

if [ -f /etc/debian_version ]; then
  echo "Debian $(cat /etc/debian_version) detected."
else
  echo "Warning: this doesn't look like Debian — continuing anyway, but this script was written for Debian 13." >&2
fi

echo "==> Installing prerequisites (curl, build tools for native modules)"
apt-get update -qq
apt-get install -y -qq curl ca-certificates build-essential python3

echo "==> Ensuring Node.js 20+ is installed"
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "$NODE_MAJOR" -ge 20 ]; then
    NEED_NODE=0
    echo "Node.js $(node -v) already installed, skipping."
  fi
fi
if [ "$NEED_NODE" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

# Everything below runs as root (we're already root, so no user-switching —
# that's the whole simplification). Ownership is handed to $RUN_AS_USER once,
# at the end, right before the service (which runs as that user) starts.
cd "$PROJECT_ROOT"

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Configuring environment"
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  cp .env.default .env
  echo "Created .env from .env.default — edit $PROJECT_ROOT/.env if you need a non-default DATABASE_URL."
fi

echo "==> Applying database migrations"
npm run db:migrate:deploy
echo "Note: this does not seed data. Optional: copy prisma/.seed.ts.default to"
echo "prisma/seed.ts (customize it first) and run 'npm run db:seed' yourself."

echo "==> Building the app"
npm run build

echo "==> Setting ownership of $PROJECT_ROOT to $RUN_AS_USER"
chown -R "$RUN_AS_USER":"$RUN_AS_USER" "$PROJECT_ROOT"

echo "==> Writing systemd unit (port $PORT, running as $RUN_AS_USER via CAP_NET_BIND_SERVICE)"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=KPI Dashboard
After=network.target

[Service]
Type=simple
User=${RUN_AS_USER}
Group=${RUN_AS_USER}
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${PROJECT_ROOT}/node_modules/.bin/next start -p ${PORT}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
# Lets a non-root process bind port 80/443 without running the whole
# service as root. Harmless (and unnecessary, but not wrong) if RUN_AS_USER
# turned out to be root.
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "==> ufw is active — allowing port $PORT"
  ufw allow "${PORT}/tcp"
fi

echo
echo "==> Done. Checking status:"
systemctl status "$SERVICE_NAME" --no-pager || true
echo
echo "Serving on port $PORT as user '$RUN_AS_USER'. Logs: journalctl -u $SERVICE_NAME -f"
echo
echo "Reminder: there is no authentication on /api/kpis or /api/mcp (see"
echo "docs/api.md and docs/mcp.md) — this is now reachable on port $PORT from"
echo "anywhere that can route to this machine. Put it behind a firewall/VPN"
echo "or add auth before treating this as truly public."
