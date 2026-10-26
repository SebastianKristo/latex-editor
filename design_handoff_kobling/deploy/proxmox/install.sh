#!/usr/bin/env bash
# Kobling server – installasjon på Proxmox VE 8
# Oppretter en Debian 12-LXC, installerer Docker og starter Kobling.
# Kjør i Shell på Proxmox-noden:  bash install.sh
# Verdiene under kan overstyres med miljøvariabler, f.eks.  CTID=130 bash install.sh
set -euo pipefail

CTID="${CTID:-120}"
CT_HOSTNAME="${CT_HOSTNAME:-kobling}"
CORES="${CORES:-2}"
RAM="${RAM:-2048}"
DISK="${DISK:-8}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
GATEWAY="${GATEWAY:-}"
IMAGE="${IMAGE:-ghcr.io/sebastiankristo/kobling-server:latest}"
KOBLING_PORT="${KOBLING_PORT:-8080}"
DUCKDNS_ENABLED="${DUCKDNS_ENABLED:-false}"
DUCKDNS_SUBDOMAIN="${DUCKDNS_SUBDOMAIN:-}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
DUCKDNS_INTERVAL_MIN="${DUCKDNS_INTERVAL_MIN:-5}"
DUCKDNS_IPV6="${DUCKDNS_IPV6:-false}"
TLS_LETSENCRYPT="${TLS_LETSENCRYPT:-false}"
BACKUP_ENABLED="${BACKUP_ENABLED:-false}"
BACKUP_SMB_HOST="${BACKUP_SMB_HOST:-}"
BACKUP_SMB_SHARE="${BACKUP_SMB_SHARE:-backup}"
BACKUP_SMB_PATH="${BACKUP_SMB_PATH:-kobling}"
BACKUP_SMB_USER="${BACKUP_SMB_USER:-}"
BACKUP_SMB_PASS="${BACKUP_SMB_PASS:-}"
BACKUP_SMB_DOMAIN="${BACKUP_SMB_DOMAIN:-WORKGROUP}"
BACKUP_SMB_VERSION="${BACKUP_SMB_VERSION:-3.0}"
BACKUP_CRON="${BACKUP_CRON:-0 3 * * *}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_INCLUDE="${BACKUP_INCLUDE:-docs,figs,hist,users}"
SMTP_HOST="${SMTP_HOST:-smtp.protonmail.ch}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURITY="${SMTP_SECURITY:-starttls}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-}"
NOTIFY_COMMENTS="${NOTIFY_COMMENTS:-true}"
KOBLING_PUBLIC_URL="${KOBLING_PUBLIC_URL:-}"

step() { printf "\n\033[1m› %s\033[0m\n" "$1"; }
fail() { printf "\033[31mFeil: %s\033[0m\n" "$1" >&2; exit 1; }

command -v pct >/dev/null 2>&1 || fail "kjør skriptet i Shell på en Proxmox-node."
pct status "$CTID" >/dev/null 2>&1 && fail "CT $CTID finnes allerede. Velg en annen CTID."
if [ "$IP" != "dhcp" ] && [ -z "$GATEWAY" ]; then fail "sett GATEWAY når du bruker statisk IP."; fi

if [ -z "$KOBLING_PUBLIC_URL" ]; then
  if [ "$DUCKDNS_ENABLED" = "true" ] && [ -n "$DUCKDNS_SUBDOMAIN" ]; then
    if [ "$TLS_LETSENCRYPT" = "true" ]; then KOBLING_PUBLIC_URL="https://$DUCKDNS_SUBDOMAIN.duckdns.org"
    else KOBLING_PUBLIC_URL="http://$DUCKDNS_SUBDOMAIN.duckdns.org:$KOBLING_PORT"; fi
  fi
fi

step "Henter Debian 12-mal"
pveam update >/dev/null
TEMPLATE="$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -n1)"
[ -n "$TEMPLATE" ] || fail "fant ingen Debian 12-mal."
pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE" || pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"

NET="name=eth0,bridge=$BRIDGE,ip=$IP"
[ "$IP" != "dhcp" ] && NET="$NET,gw=$GATEWAY"

step "Oppretter CT $CTID ($CT_HOSTNAME)"
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" --cores "$CORES" --memory "$RAM" --swap 512 \
  --rootfs "$STORAGE:$DISK" --net0 "$NET" \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1
pct start "$CTID"
for _ in $(seq 1 30); do pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break; sleep 2; done

step "Installerer Docker"
pct exec "$CTID" -- bash -c "apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null && curl -fsSL https://get.docker.com | sh >/dev/null"

step "Skriver konfigurasjon"
TMP="$(mktemp -d)"
cat > "$TMP/.env" <<EOF
KOBLING_PORT=$KOBLING_PORT
KOBLING_PUBLIC_URL=$KOBLING_PUBLIC_URL
DUCKDNS_ENABLED=$DUCKDNS_ENABLED
DUCKDNS_SUBDOMAIN=$DUCKDNS_SUBDOMAIN
DUCKDNS_TOKEN=$DUCKDNS_TOKEN
DUCKDNS_INTERVAL_MIN=$DUCKDNS_INTERVAL_MIN
DUCKDNS_IPV6=$DUCKDNS_IPV6
TLS_LETSENCRYPT=$TLS_LETSENCRYPT
BACKUP_ENABLED=$BACKUP_ENABLED
BACKUP_SMB_HOST=$BACKUP_SMB_HOST
BACKUP_SMB_SHARE=$BACKUP_SMB_SHARE
BACKUP_SMB_PATH=$BACKUP_SMB_PATH
BACKUP_SMB_USER=$BACKUP_SMB_USER
BACKUP_SMB_PASS=$BACKUP_SMB_PASS
BACKUP_SMB_DOMAIN=$BACKUP_SMB_DOMAIN
BACKUP_SMB_VERSION=$BACKUP_SMB_VERSION
BACKUP_CRON=$BACKUP_CRON
BACKUP_KEEP=$BACKUP_KEEP
BACKUP_INCLUDE=$BACKUP_INCLUDE
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_SECURITY=$SMTP_SECURITY
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
NOTIFY_COMMENTS=$NOTIFY_COMMENTS
EOF
cat > "$TMP/docker-compose.yml" <<EOF
services:
  kobling:
    image: $IMAGE
    container_name: kobling
    restart: unless-stopped
    ports:
      - "$KOBLING_PORT:8080"
$( [ "$TLS_LETSENCRYPT" = "true" ] && echo '      - "443:8443"' )
    env_file: .env
    volumes:
      - /opt/kobling/data:/data
EOF
pct exec "$CTID" -- mkdir -p /opt/kobling/data
pct push "$CTID" "$TMP/.env" /opt/kobling/.env --perms 600
pct push "$CTID" "$TMP/docker-compose.yml" /opt/kobling/docker-compose.yml
rm -rf "$TMP"

step "Starter Kobling"
pct exec "$CTID" -- bash -c "cd /opt/kobling && docker compose pull -q && docker compose up -d"
ADDR="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
printf "\n\033[32m✓ Kobling kjører på http://%s:%s\033[0m\n" "$ADDR" "$KOBLING_PORT"
[ -n "$KOBLING_PUBLIC_URL" ] && echo "  Offentlig adresse: $KOBLING_PUBLIC_URL (krever portvideresending i ruteren)"
exit 0
