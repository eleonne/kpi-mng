#!/usr/bin/env bash
#
# Removes the systemd service installed by deploy/install.sh.
#
# Run as root:
#   sudo bash deploy/uninstall.sh
#
# Deliberately does NOT delete the project directory, node_modules, .next
# build output, .env, or the SQLite database — those are your checkout and
# your data, not something this script created, so removing them isn't
# something an uninstaller should do. Delete them yourself if you want to.
#
# (install.sh runs the service as whichever user invoked it via sudo, not a
# dedicated service account — so there's no service-specific user to clean
# up here either.)
set -euo pipefail

SERVICE_NAME="kpi-dashboard"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root: sudo bash deploy/uninstall.sh" >&2
  exit 1
fi

echo "==> Stopping and disabling $SERVICE_NAME (harmless if it wasn't running)"
systemctl stop "$SERVICE_NAME" 2>/dev/null || true
systemctl disable "$SERVICE_NAME" 2>/dev/null || true

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
if [ -f "$UNIT_FILE" ]; then
  # Recover the port this instance was using, to revert the matching ufw rule.
  PORT="$(grep -oP '(?<=-p )\d+' "$UNIT_FILE" || true)"
  echo "==> Removing $UNIT_FILE"
  rm -f "$UNIT_FILE"
  systemctl daemon-reload

  if [ -n "${PORT:-}" ] && command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    echo "==> Reverting ufw rule for port $PORT"
    ufw delete allow "${PORT}/tcp" 2>/dev/null || true
  fi
fi

echo
echo "==> Done. Left untouched (delete manually if you want to):"
echo "  - the project directory and its .env / dev database"
echo "  - node_modules and the .next build output"
