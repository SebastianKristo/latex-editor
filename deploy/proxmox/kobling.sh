#!/usr/bin/env bash
# Kobling – Proxmox VE helper-skript
# Oppretter en Debian 13-LXC og installerer Kobling direkte (uten Docker): TeX Live, Node.js 22 og systemd-tjeneste.
#
# Kjør i Shell på Proxmox-noden:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/SebastianKristo/latex-editor/main/deploy/proxmox/kobling.sh)"
#
# Uten spørsmål (standardverdier, kan overstyres):  KOBLING_DEFAULTS=1 CTID=130 RAM=4096 bash kobling.sh
# Oppdatering senere:  pct exec <CTID> -- kobling-update
set -euo pipefail

RAW="${KOBLING_RAW:-https://raw.githubusercontent.com/SebastianKristo/latex-editor/${KOBLING_BRANCH:-main}/deploy/proxmox}"
APP="Kobling"

B="\033[1m" G="\033[32m" R="\033[31m" Y="\033[33m" D="\033[2m" N="\033[0m"
header() {
  clear 2>/dev/null || true
  printf "${B}"
  cat <<'EOF'
    __ __      __    ___
   / //_/___  / /_  / (_)___  ____ _
  / ,< / __ \/ __ \/ / / __ \/ __ `/
 / /| / /_/ / /_/ / / / / / / /_/ /
/_/ |_\____/_.___/_/_/_/ /_/\__, /
                           /____/
EOF
  printf "${N}${D}  LaTeX-editor for elektrorapporter · Proxmox VE helper${N}\n\n"
}
step() { printf "${B}› %s${N}\n" "$1"; }
ok()   { printf "  ${G}✓${N} %s\n" "$1"; }
warn() { printf "  ${Y}!${N} %s\n" "$1"; }
fail() { printf "${R}Feil: %s${N}\n" "$1" >&2; exit 1; }

# ---------- sjekker ----------
header
[ "$(id -u)" -eq 0 ] || fail "kjør som root i Shell på Proxmox-noden."
command -v pct >/dev/null 2>&1 || fail "fant ikke pct. Skriptet må kjøres på en Proxmox VE-node."
PVE="$(pveversion 2>/dev/null | grep -oE 'pve-manager/[0-9]+' | cut -d/ -f2 || true)"
[[ "$PVE" =~ ^(8|9)$ ]] || fail "krever Proxmox VE 8 eller 9 (fant ${PVE:-ukjent})."
[ "$(dpkg --print-architecture)" = "amd64" ] || fail "bare amd64 støttes."

# ---------- standardverdier ----------
first_storage() { pvesm status -content "$1" 2>/dev/null | awk 'NR>1 && $3=="active" && !f {print $1; f=1}' || true; }
CTID="${CTID:-$(pvesh get /cluster/nextid 2>/dev/null || echo 120)}"
CT_HOSTNAME="${CT_HOSTNAME:-kobling}"
CORES="${CORES:-2}"
RAM="${RAM:-2048}"
DISK="${DISK:-12}"
STORAGE="${STORAGE:-$(first_storage rootdir)}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-$(first_storage vztmpl)}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
GATEWAY="${GATEWAY:-}"
VLAN="${VLAN:-}"
KOBLING_PORT="${KOBLING_PORT:-8080}"
KOBLING_ADMIN_EMAIL="${KOBLING_ADMIN_EMAIL:-}"
KOBLING_ADMIN_PASSWORD="${KOBLING_ADMIN_PASSWORD:-}"
[ -n "$STORAGE" ] || fail "fant ingen lagring for containere (rootdir)."
[ -n "$TEMPLATE_STORAGE" ] || fail "fant ingen lagring for maler (vztmpl)."

# ---------- spørsmål ----------
ask() { whiptail --backtitle "Kobling · Proxmox VE helper" --title "$1" --inputbox "$2" 10 64 "$3" 3>&1 1>&2 2>&3; }
pick_storage() {
  local content="$1" cur="$2" items=()
  while read -r name type _ _ _ avail _; do items+=("$name" "$type, $((avail / 1024 / 1024)) GB ledig"); done < <(pvesm status -content "$content" 2>/dev/null | awk 'NR>1 && $3=="active"')
  [ "${#items[@]}" -gt 2 ] || { echo "$cur"; return; }
  whiptail --backtitle "Kobling · Proxmox VE helper" --title "Lagring" --default-item "$cur" --menu "Velg lagring for ${3}:" 16 64 6 "${items[@]}" 3>&1 1>&2 2>&3
}

if [ -z "${KOBLING_DEFAULTS:-}" ] && [ -t 0 ] && command -v whiptail >/dev/null; then
  MODE=$(whiptail --backtitle "Kobling · Proxmox VE helper" --title "$APP" --menu \
    "Oppretter en Debian 13-container med Kobling, TeX Live og Node.js.\n\nStandard: CT $CTID, $CORES kjerner, $RAM MB RAM, $DISK GB disk, DHCP på $BRIDGE." 16 70 3 \
    standard "Standardinnstillinger" avansert "Velg selv" avbryt "Avbryt" 3>&1 1>&2 2>&3) || exit 0
  [ "$MODE" = "avbryt" ] && exit 0
  if [ "$MODE" = "avansert" ]; then
    CTID=$(ask "CT-ID" "ID for containeren" "$CTID") || exit 0
    CT_HOSTNAME=$(ask "Vertsnavn" "Vertsnavn for containeren" "$CT_HOSTNAME") || exit 0
    CORES=$(ask "CPU" "Antall CPU-kjerner" "$CORES") || exit 0
    RAM=$(ask "Minne" "RAM i MB (2048 holder, 4096 gir raskere bygg)" "$RAM") || exit 0
    DISK=$(ask "Disk" "Diskstørrelse i GB (TeX Live trenger ~3 GB)" "$DISK") || exit 0
    STORAGE=$(pick_storage rootdir "$STORAGE" "containerdisken") || exit 0
    TEMPLATE_STORAGE=$(pick_storage vztmpl "$TEMPLATE_STORAGE" "Debian-malen") || exit 0
    BRIDGE=$(ask "Nettverk" "Bro" "$BRIDGE") || exit 0
    VLAN=$(ask "VLAN" "VLAN-tag (tom for ingen)" "$VLAN") || exit 0
    IP=$(ask "IP-adresse" "dhcp, eller statisk med maske, f.eks. 192.168.1.50/24" "$IP") || exit 0
    [ "$IP" != "dhcp" ] && { GATEWAY=$(ask "Gateway" "Gateway for statisk IP" "$GATEWAY") || exit 0; }
    KOBLING_PORT=$(ask "Port" "Port for nettleser og app" "$KOBLING_PORT") || exit 0
    KOBLING_ADMIN_EMAIL=$(ask "Administrator" "E-post for administratoren (tom: opprett i nettleseren)" "$KOBLING_ADMIN_EMAIL") || exit 0
    if [ -n "$KOBLING_ADMIN_EMAIL" ]; then
      KOBLING_ADMIN_PASSWORD=$(whiptail --title "Administrator" --passwordbox "Passord (minst 8 tegn)" 10 64 3>&1 1>&2 2>&3) || exit 0
    fi
  fi
fi

# ---------- validering ----------
[[ "$CTID" =~ ^[0-9]+$ ]] && [ "$CTID" -ge 100 ] || fail "CT-ID må være et tall fra 100."
pct status "$CTID" >/dev/null 2>&1 && fail "CT $CTID finnes allerede. Velg en annen CT-ID."
[[ "$CT_HOSTNAME" =~ ^[a-zA-Z0-9-]+$ ]] || fail "vertsnavn kan bare ha bokstaver, tall og bindestrek."
for v in CORES RAM DISK KOBLING_PORT; do [[ "${!v}" =~ ^[0-9]+$ ]] || fail "$v må være et heltall."; done
[ "$KOBLING_PORT" -ge 1 ] && [ "$KOBLING_PORT" -le 65535 ] || fail "porten må være mellom 1 og 65535."
[ "$IP" = "dhcp" ] || [[ "$IP" =~ ^[0-9.]+/[0-9]+$ ]] || fail "IP må være dhcp eller på formen 192.168.1.50/24."
[ -z "$VLAN" ] || [[ "$VLAN" =~ ^[0-9]+$ ]] || fail "VLAN må være et tall."
[ -z "$KOBLING_ADMIN_EMAIL" ] || [ "${#KOBLING_ADMIN_PASSWORD}" -ge 8 ] || fail "administratorpassordet må ha minst 8 tegn."

printf "  CT %s · %s · %s kjerner · %s MB · %s GB på %s · %s%s · port %s\n\n" \
  "$CTID" "$CT_HOSTNAME" "$CORES" "$RAM" "$DISK" "$STORAGE" "$IP" "${VLAN:+ (VLAN $VLAN)}" "$KOBLING_PORT"

# ---------- mal ----------
step "Henter Debian-mal"
pveam update >/dev/null 2>&1 || warn "kunne ikke oppdatere mal-listen; bruker den som finnes"
TEMPLATE="$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-13-standard_.*_amd64\.tar\.(zst|gz|xz)$' | sort -V | tail -1 || true)"
if [ -z "$TEMPLATE" ]; then
  TEMPLATE="$(pveam available --section system 2>/dev/null | awk '{print $2}' | grep -E '^debian-12-standard_.*_amd64\.tar\.(zst|gz|xz)$' | sort -V | tail -1 || true)"
  warn "Debian 13 er ikke tilgjengelig; bruker Debian 12 (TeX Live 2022)"
fi
[ -n "$TEMPLATE" ] || fail "fant ingen Debian-mal i pveam."
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" >/dev/null || fail "kunne ikke laste ned $TEMPLATE."
fi
ok "$TEMPLATE"

# ---------- container ----------
step "Oppretter CT $CTID"
NET="name=eth0,bridge=$BRIDGE,ip=$IP${GATEWAY:+,gw=$GATEWAY}${VLAN:+,tag=$VLAN}"
[ "$IP" = "dhcp" ] && NET="$NET,ip6=auto"
pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" --cores "$CORES" --memory "$RAM" --swap 512 \
  --rootfs "$STORAGE:$DISK" --net0 "$NET" \
  --unprivileged 1 --features nesting=1 --onboot 1 --ostype debian \
  --tags kobling --description "Kobling – LaTeX-editor. Oppdater: kobling-update" >/dev/null
pct start "$CTID"
for _ in $(seq 1 60); do pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break; sleep 2; done
pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 || fail "containeren fikk ikke nett. Sjekk bro, IP og gateway."
ok "kjører"

# ---------- installasjon ----------
step "Installerer Kobling i containeren (5–10 minutter)"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
HERE="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$HERE" ] && [ -f "$HERE/kobling-install.sh" ]; then cp "$HERE/kobling-install.sh" "$TMP"
else curl -fsSL "$RAW/kobling-install.sh" -o "$TMP" || fail "kunne ikke laste ned kobling-install.sh."; fi
pct push "$CTID" "$TMP" /root/kobling-install.sh --perms 755
pct exec "$CTID" -- env KOBLING_BRANCH="${KOBLING_BRANCH:-main}" KOBLING_PORT="$KOBLING_PORT" \
  KOBLING_ADMIN_EMAIL="$KOBLING_ADMIN_EMAIL" KOBLING_ADMIN_PASSWORD="$KOBLING_ADMIN_PASSWORD" \
  bash /root/kobling-install.sh
pct exec "$CTID" -- rm -f /root/kobling-install.sh

ADDR="$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')"
printf "\n${G}${B}✓ Kobling kjører på http://%s:%s${N}\n" "${ADDR:-<ip>}" "$KOBLING_PORT"
[ -z "$KOBLING_ADMIN_EMAIL" ] && echo "  Åpne adressen og opprett administratoren."
echo "  Innstillinger:  pct exec $CTID -- nano /etc/kobling/kobling.env  (deretter: systemctl restart kobling)"
echo "  Oppdatering:    pct exec $CTID -- kobling-update"
echo "  Logg:           pct exec $CTID -- journalctl -u kobling -f"
