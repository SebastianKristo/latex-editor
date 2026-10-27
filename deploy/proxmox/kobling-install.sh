#!/usr/bin/env bash
# Kobling – installasjon og oppdatering inne i en Debian/Ubuntu-container (kjøres som root).
# Brukes av kobling.sh på Proxmox-verten, og installeres som «kobling-update» i containeren.
#
# Valgfrie miljøvariabler:
#   KOBLING_BRANCH   git-gren (standard main)
#   KOBLING_REPO     git-repo (standard GitHub-repoet)
#   KOBLING_SRC      lokal kildemappe i stedet for git (for test eller uten nett til GitHub)
#   KOBLING_PORT     port for nettleser og app (standard 8080, bare ved første installasjon)
#   KOBLING_ADMIN_EMAIL / KOBLING_ADMIN_PASSWORD   oppretter administratoren (ellers i nettleseren)
#
# «kobling-update --request» kjøres av systemd (kobling-update.path) når administratoren trykker
# «Oppdater nå» i appen: taggen leses fra $DATA/update/request.json, og resultatet skrives til status.json.
set -euo pipefail

REPO="${KOBLING_REPO:-https://github.com/SebastianKristo/latex-editor.git}"
BRANCH="${KOBLING_BRANCH:-main}"
PORT="${KOBLING_PORT:-8080}"
APP=/opt/kobling
DATA=/var/lib/kobling
ETC=/etc/kobling
ENVF="$ETC/kobling.env"

B="\033[1m" G="\033[32m" R="\033[31m" Y="\033[33m" N="\033[0m"
step() { printf "${B}› %s${N}\n" "$1"; }
ok()   { printf "  ${G}✓${N} %s\n" "$1"; }
warn() { printf "  ${Y}!${N} %s\n" "$1"; }
fail() { printf "${R}Feil: %s${N}\n" "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "kjør som root."

# ---------- bestilt fra appen ----------
if [ "${1:-}" = "--request" ] && [ -z "${KOBLING_REQ:-}" ]; then
  REQF="$DATA/update/request.json"
  [ -f "$REQF" ] || exit 0
  KOBLING_BRANCH="$(node -e 'process.stdout.write(String(require(process.argv[1]).ref || "main"))' "$REQF")"
  KOBLING_REQ="$(node -e 'process.stdout.write(String(require(process.argv[1]).to || ""))' "$REQF")"
  export KOBLING_BRANCH KOBLING_REQ
  BRANCH="$KOBLING_BRANCH"
  rm -f "$REQF"
  exec >"$DATA/update/log.txt" 2>&1
fi
if [ -n "${KOBLING_REQ:-}" ]; then
  trap 'c=$?; printf "{\"done\":true,\"ok\":%s,\"to\":\"%s\",\"at\":%s000}\n" "$([ $c -eq 0 ] && echo true || echo false)" "$KOBLING_REQ" "$(date +%s)" > "$DATA/update/status.json"' EXIT
fi
command -v apt-get >/dev/null || fail "trenger Debian eller Ubuntu."
export DEBIAN_FRONTEND=noninteractive
UPDATE=0; [ -f "$ENVF" ] && UPDATE=1

# ---------- pakker ----------
step "Installerer systempakker (TeX Live tar noen minutter første gang)"
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  curl ca-certificates git gnupg tar zstd smbclient \
  texlive-latex-extra texlive-pictures texlive-science texlive-lang-european latexmk dvisvgm >/dev/null
ok "$(pdflatex --version | head -1)"

# Node 22.13+ trengs for node:sqlite
node_ok() { command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'; }
if ! node_ok; then
  step "Installerer Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
  node_ok || fail "Node.js 22.13 eller nyere kreves (fant $(node -v 2>/dev/null || echo ingen))."
fi
ok "Node.js $(node -v)"

# ---------- kildekode ----------
step "Henter Kobling"
mkdir -p "$APP"
if [ -n "${KOBLING_SRC:-}" ]; then
  rm -rf "$APP/src"; mkdir -p "$APP/src"
  tar -C "$KOBLING_SRC" --exclude=node_modules --exclude=dist --exclude=target --exclude=.git -cf - . | tar -C "$APP/src" -xf -
  ok "fra $KOBLING_SRC"
elif [ -d "$APP/src/.git" ]; then
  git -C "$APP/src" fetch -q --depth 1 origin "$BRANCH"
  git -C "$APP/src" reset -q --hard FETCH_HEAD
  ok "$BRANCH @ $(git -C "$APP/src" rev-parse --short HEAD)"
else
  rm -rf "$APP/src"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$APP/src"
  ok "$BRANCH @ $(git -C "$APP/src" rev-parse --short HEAD)"
fi
# En eldre kobling-update fortsetter med den nye versjonen av seg selv, så rettinger i skriptet tas med med en gang.
NEW="$APP/src/deploy/proxmox/kobling-install.sh"
if [ -z "${KOBLING_REEXEC:-}" ] && [ -f "$NEW" ] && [ -f "${BASH_SOURCE[0]:-}" ] && ! cmp -s "$NEW" "${BASH_SOURCE[0]}"; then
  ok "skriptet er oppdatert, fortsetter med ny versjon"
  KOBLING_REEXEC=1 exec bash "$NEW" "$@"
fi

# ---------- bygg ----------
step "Bygger (pnpm, klient og server)"
cd "$APP/src"
corepack enable >/dev/null 2>&1 || npm install -g -s pnpm@10 >/dev/null
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=1
pnpm install --frozen-lockfile --reporter=silent
pnpm --filter @kobling/web build >/dev/null
rm -rf "$APP/app.new"
pnpm --filter @kobling/server deploy --legacy --prod "$APP/app.new" >/dev/null
cp -r apps/web/dist "$APP/app.new/web"
git rev-parse --short HEAD > "$APP/app.new/BUILD" 2>/dev/null || true
# Oppdatert fra appen til en release: versjonen er taggen (ellers versjonen i package.json)
case "$BRANCH" in v[0-9]*) echo "${BRANCH#v}" > "$APP/app.new/VERSION" ;; esac
cp deploy/proxmox/kobling-install.sh /usr/local/sbin/kobling-update
chmod 755 /usr/local/sbin/kobling-update
# pct exec har ikke /usr/local/sbin i PATH; /usr/bin finnes alltid.
ln -sf /usr/local/sbin/kobling-update /usr/bin/kobling-update
ok "bygget"

# ---------- bruker, data og innstillinger ----------
id kobling >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin kobling
mkdir -p "$DATA/update" "$ETC"
chown kobling:kobling "$DATA" "$DATA/update"; chmod 750 "$DATA"
if [ "$UPDATE" -eq 0 ]; then
  step "Skriver $ENVF"
  {
    echo "# Kobling – miljøvariabler (se deploy/.env.example). Endre og kjør: systemctl restart kobling"
    # Verdier med mellomrom (f.eks. BACKUP_CRON) siteres, så filen virker både for systemd og shell.
    grep -v '^#' "$APP/src/deploy/.env.example" | sed -E "s/^KOBLING_PORT=.*/KOBLING_PORT=$PORT/; s/^([A-Z_]+)=(.* .*)$/\1=\"\2\"/"
    echo "KOBLING_LISTEN_PORT=$PORT"
    echo "KOBLING_HTTPS_PORT=443"
    echo "KOBLING_DATA=$DATA"
    echo "KOBLING_WEB_DIR=$APP/app/web"
    [ -n "${KOBLING_ADMIN_EMAIL:-}" ] && echo "KOBLING_ADMIN_EMAIL=$KOBLING_ADMIN_EMAIL"
    [ -n "${KOBLING_ADMIN_PASSWORD:-}" ] && echo "KOBLING_ADMIN_PASSWORD=$KOBLING_ADMIN_PASSWORD"
  } > "$ENVF"
  chmod 600 "$ENVF"
  ok "port $PORT"
fi
PORT="$(sed -n 's/^KOBLING_LISTEN_PORT=//p' "$ENVF")"
# Eldre installasjoner lyttet med HTTPS på 8443; ruteren videresender 443, så bruk 443 direkte.
grep -q '^KOBLING_HTTPS_PORT=' "$ENVF" || echo "KOBLING_HTTPS_PORT=443" >> "$ENVF"
# «Oppdater nå» i appen bruker kobling-update.path (under)
grep -q '^KOBLING_INSTALL=' "$ENVF" || echo "KOBLING_INSTALL=proxmox" >> "$ENVF"

# ---------- tjeneste ----------
cat > /etc/systemd/system/kobling.service <<EOF
[Unit]
Description=Kobling – LaTeX-editor for elektrorapporter
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=kobling
Group=kobling
EnvironmentFile=$ENVF
Environment=NODE_ENV=production
Environment=NODE_NO_WARNINGS=1
WorkingDirectory=$APP/app
ExecStart=/usr/bin/env node src/index.js
Restart=on-failure
# HTTPS (Let's Encrypt) lytter på 443 uten å kjøre som root
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA /tmp

[Install]
WantedBy=multi-user.target
EOF

# «Oppdater nå» i appen: tjenesten (bruker kobling) legger en forespørsel, systemd kjører kobling-update som root
cat > /etc/systemd/system/kobling-update.path <<EOF
[Unit]
Description=Kobling – oppdatering bestilt fra appen

[Path]
PathExists=$DATA/update/request.json

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/kobling-update.service <<EOF
[Unit]
Description=Kobling – oppdatering

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/kobling-update --request
EOF

swap_app() { rm -rf "$APP/app.old"; [ -d "$APP/app" ] && mv "$APP/app" "$APP/app.old"; mv "$APP/app.new" "$APP/app"; }

if [ -d /run/systemd/system ]; then
  step "Starter tjenesten"
  systemctl daemon-reload
  systemctl stop kobling 2>/dev/null || true
  swap_app
  systemctl enable -q --now kobling
  systemctl enable -q --now kobling-update.path
  for _ in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
  curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 || { journalctl -u kobling -n 30 --no-pager; fail "tjenesten svarer ikke."; }
  rm -rf "$APP/app.old"
  ok "kobling.service kjører"
else
  swap_app; rm -rf "$APP/app.old"
  warn "systemd kjører ikke her; start som root: set -a; . $ENVF; set +a; cd $APP/app && setpriv --reuid kobling --regid kobling --init-groups node src/index.js"
fi

printf "\n${G}✓ Kobling er %s på http://%s:%s${N}\n" "$([ "$UPDATE" -eq 1 ] && echo oppdatert || echo installert)" "$(hostname -I 2>/dev/null | awk '{print $1}')" "$PORT"
[ "$UPDATE" -eq 0 ] && echo "  Åpne adressen og opprett administratoren. Oppdater senere med: kobling-update"
exit 0
