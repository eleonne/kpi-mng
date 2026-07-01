#!/usr/bin/env bash
#
# Installs the KPI Dashboard as a systemd service on Debian 13, serving
# directly on port 80 (no reverse proxy, no TLS — see docs/deployment.md
# instead if you want HTTPS via Caddy; that's a separate, alternative setup,
# not meant to be combined with this script).
#
# Run as root, from anywhere, pointed at your checkout:
#   sudo bash deploy/install.sh
#
# Safe to re-run (e.g. after `git pull`) to rebuild and redeploy an update —
# it does not delete data, and re-creates the systemd unit + restarts it.
#
# Override the port: PORT=8080 sudo bash deploy/install.sh
set -euo pipefail

SERVICE_NAME="kpi-dashboard"
SERVICE_USER="kpiapp"
PORT="${PORT:-80}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root: sudo bash deploy/install.sh" >&2
  exit 1
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

echo "==> Creating service user '$SERVICE_USER' (if needed)"
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Setting ownership of $PROJECT_ROOT to $SERVICE_USER"
chown -R "$SERVICE_USER":"$SERVICE_USER" "$PROJECT_ROOT"

run_as_service_user() {
  runuser -u "$SERVICE_USER" -- bash -c "cd '$PROJECT_ROOT' && $*"
}

echo "==> Configuring environment"
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  run_as_service_user "cp .env.default .env"
  echo "Created .env from .env.default — edit $PROJECT_ROOT/.env if you need a non-default DATABASE_URL."
fi

echo "==> Installing dependencies (npm ci)"
run_as_service_user "npm ci"

echo "==> Applying database migrations"
run_as_service_user "npm run db:migrate:deploy"
echo "Note: this does not seed data. Optional: copy prisma/.seed.ts.default to"
echo "prisma/seed.ts (customize it first) and run 'npm run db:seed' yourself."

echo "==> Building the app"
run_as_service_user "npm run build"

echo "==> Writing systemd unit (port $PORT, running as $SERVICE_USER via CAP_NET_BIND_SERVICE)"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=KPI Dashboard
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${PROJECT_ROOT}/node_modules/.bin/next start -p ${PORT}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
# Lets a non-root process bind port 80/443 without running the whole
# service as root.
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
echo "Serving on port $PORT. Logs: journalctl -u $SERVICE_NAME -f"
echo
echo "Reminder: there is no authentication on /api/kpis or /api/mcp (see"
echo "docs/api.md and docs/mcp.md) — this is now reachable on port $PORT from"
echo "anywhere that can route to this machine. Put it behind a firewall/VPN"
echo "or add auth before treating this as truly public."
