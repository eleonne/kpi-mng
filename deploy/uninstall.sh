#!/usr/bin/env bash
#
# Removes the systemd service installed by deploy/install.sh.
#
# Run as root:
#   sudo bash deploy/uninstall.sh              # removes the service only
#   sudo bash deploy/uninstall.sh --purge      # also removes the 'kpiapp' system user
#
# Deliberately does NOT delete the project directory, node_modules, .next
# build output, .env, or the SQLite database — those are your checkout and
# your data, not something this script created independently, so removing
# them isn't something an uninstaller should do even under --purge. Delete
# them yourself if you're sure you want to.
set -euo pipefail

SERVICE_NAME="kpi-dashboard"
SERVICE_USER="kpiapp"
PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

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

if [ "$PURGE" -eq 1 ]; then
  if id -u "$SERVICE_USER" >/dev/null 2>&1; then
    echo "==> Removing service user '$SERVICE_USER'"
    userdel "$SERVICE_USER"
    echo "Note: the project directory is still owned by the now-deleted '$SERVICE_USER'"
    echo "UID — it'll show as a numeric owner in 'ls -l' until you chown it to something else."
  fi
else
  echo "Left the '$SERVICE_USER' system user in place — re-run with --purge to remove it too."
fi

echo
echo "==> Done. Left untouched (delete manually if you want to):"
echo "  - the project directory and its .env / dev database"
echo "  - node_modules and the .next build output"
