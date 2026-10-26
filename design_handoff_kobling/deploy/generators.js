export const RAW = 'https://raw.githubusercontent.com/SebastianKristo/latex-editor/main/deploy';
export const IMAGE = 'ghcr.io/sebastiankristo/kobling-server:latest';
export const CRON = { hourly: '0 * * * *', daily: '0 3 * * *', weekly: '0 3 * * 1' };
export const DEFAULTS = {
  duck: { on: false, domain: '', token: '', interval: 5, ipv6: false, tls: false },
  smb: { on: false, host: '', share: 'backup', path: 'kobling', user: '', pass: '', domain: 'WORKGROUP', ver: '3.0', schedule: 'daily', keep: 14, incl: { docs: true, figs: true, hist: true, users: true } },
  smtp: { provider: 'proton', host: 'smtp.protonmail.ch', port: '587', sec: 'starttls', user: '', pass: '', from: '', notify: true },
  deploy: { target: 'proxmox', ctid: '120', hostname: 'kobling', cores: '2', ram: '2048', disk: '8', storage: 'local-lvm', bridge: 'vmbr0', ip: 'dhcp', gw: '', port: '8080', appdata: '/mnt/user/appdata/kobling', datadir: './data' }
};
const dq = v => String(v).replace(/(["\\$`])/g, '\\$1');
const sq = v => /^[A-Za-z0-9_./:,@=-]*$/.test(String(v)) ? String(v) : "'" + String(v).replace(/'/g, "'\\''") + "'";
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function publicUrl(c) {
  const d = c.duck, p = c.deploy;
  if (d.on && d.domain) return d.tls ? 'https://' + d.domain + '.duckdns.org' : 'http://' + d.domain + '.duckdns.org:' + p.port;
  return '';
}
export function envVars(c) {
  const d = c.duck, b = c.smb, p = c.deploy, m = c.smtp || DEFAULTS.smtp;
  return [
    ['KOBLING_PORT', p.port], ['KOBLING_PUBLIC_URL', publicUrl(c)],
    ['DUCKDNS_ENABLED', d.on], ['DUCKDNS_SUBDOMAIN', d.domain], ['DUCKDNS_TOKEN', d.token], ['DUCKDNS_INTERVAL_MIN', d.interval], ['DUCKDNS_IPV6', d.ipv6], ['TLS_LETSENCRYPT', d.tls],
    ['BACKUP_ENABLED', b.on], ['BACKUP_SMB_HOST', b.host], ['BACKUP_SMB_SHARE', b.share], ['BACKUP_SMB_PATH', b.path], ['BACKUP_SMB_USER', b.user], ['BACKUP_SMB_PASS', b.pass], ['BACKUP_SMB_DOMAIN', b.domain], ['BACKUP_SMB_VERSION', b.ver],
    ['BACKUP_CRON', CRON[b.schedule]], ['BACKUP_KEEP', b.keep], ['BACKUP_INCLUDE', Object.keys(b.incl).filter(k => b.incl[k]).join(',')],
    ['SMTP_HOST', m.host], ['SMTP_PORT', m.port], ['SMTP_SECURITY', m.sec], ['SMTP_USER', m.user], ['SMTP_PASS', m.pass], ['SMTP_FROM', m.from], ['NOTIFY_COMMENTS', m.notify]
  ].map(([k, v]) => [k, String(v)]);
}
export function envFile(c) {
  return ['# Kobling server – miljøvariabler', '# Generert av Kobling › Innstillinger', ...envVars(c).map(([k, v]) => k + '=' + v)].join('\n');
}
export function composeYml(c) {
  const p = c.deploy;
  return ['# Kobling server – start med: docker compose up -d', 'services:', '  kobling:', '    image: ' + IMAGE, '    container_name: kobling', '    restart: unless-stopped', '    ports:', '      - "' + p.port + ':8080"', ...(c.duck.tls ? ['      - "443:8443"'] : []), '    env_file: .env', '    volumes:', '      - ' + p.datadir + ':/data'].join('\n');
}
function pveVars(c) {
  const p = c.deploy;
  return [['CTID', p.ctid], ['CT_HOSTNAME', p.hostname], ['CORES', p.cores], ['RAM', p.ram], ['DISK', p.disk], ['STORAGE', p.storage], ['TEMPLATE_STORAGE', 'local'], ['BRIDGE', p.bridge], ['IP', p.ip], ['GATEWAY', p.gw], ['IMAGE', IMAGE],
    ...envVars(c).filter(([k]) => k !== 'KOBLING_PUBLIC_URL')].map(([k, v]) => [k, String(v)]);
}
export function pveScript(c) {
  const names = envVars(c).map(([k]) => k);
  return [
    '#!/usr/bin/env bash',
    '# Kobling server – installasjon på Proxmox VE 8',
    '# Oppretter en Debian 12-LXC, installerer Docker og starter Kobling.',
    '# Kjør i Shell på Proxmox-noden:  bash install.sh',
    '# Verdiene under kan overstyres med miljøvariabler, f.eks.  CTID=130 bash install.sh',
    'set -euo pipefail', '',
    ...pveVars(c).map(([k, v]) => k + '="${' + k + ':-' + dq(v) + '}"'),
    'KOBLING_PUBLIC_URL="${KOBLING_PUBLIC_URL:-}"', '',
    'step() { printf "\\n\\033[1m› %s\\033[0m\\n" "$1"; }',
    'fail() { printf "\\033[31mFeil: %s\\033[0m\\n" "$1" >&2; exit 1; }', '',
    'command -v pct >/dev/null 2>&1 || fail "kjør skriptet i Shell på en Proxmox-node."',
    'pct status "$CTID" >/dev/null 2>&1 && fail "CT $CTID finnes allerede. Velg en annen CTID."',
    'if [ "$IP" != "dhcp" ] && [ -z "$GATEWAY" ]; then fail "sett GATEWAY når du bruker statisk IP."; fi', '',
    'if [ -z "$KOBLING_PUBLIC_URL" ]; then',
    '  if [ "$DUCKDNS_ENABLED" = "true" ] && [ -n "$DUCKDNS_SUBDOMAIN" ]; then',
    '    if [ "$TLS_LETSENCRYPT" = "true" ]; then KOBLING_PUBLIC_URL="https://$DUCKDNS_SUBDOMAIN.duckdns.org"',
    '    else KOBLING_PUBLIC_URL="http://$DUCKDNS_SUBDOMAIN.duckdns.org:$KOBLING_PORT"; fi',
    '  fi',
    'fi', '',
    'step "Henter Debian 12-mal"',
    'pveam update >/dev/null',
    'TEMPLATE="$(pveam available --section system | awk \'/debian-12-standard/ {print $2}\' | sort -V | tail -n1)"',
    '[ -n "$TEMPLATE" ] || fail "fant ingen Debian 12-mal."',
    'pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE" || pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"', '',
    'NET="name=eth0,bridge=$BRIDGE,ip=$IP"',
    '[ "$IP" != "dhcp" ] && NET="$NET,gw=$GATEWAY"', '',
    'step "Oppretter CT $CTID ($CT_HOSTNAME)"',
    'pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \\',
    '  --hostname "$CT_HOSTNAME" --cores "$CORES" --memory "$RAM" --swap 512 \\',
    '  --rootfs "$STORAGE:$DISK" --net0 "$NET" \\',
    '  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1',
    'pct start "$CTID"',
    'for _ in $(seq 1 30); do pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break; sleep 2; done', '',
    'step "Installerer Docker"',
    'pct exec "$CTID" -- bash -c "apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null && curl -fsSL https://get.docker.com | sh >/dev/null"', '',
    'step "Skriver konfigurasjon"',
    'TMP="$(mktemp -d)"',
    'cat > "$TMP/.env" <<EOF',
    ...names.map(k => k + '=$' + k),
    'EOF',
    'cat > "$TMP/docker-compose.yml" <<EOF',
    'services:', '  kobling:', '    image: $IMAGE', '    container_name: kobling', '    restart: unless-stopped', '    ports:', '      - "$KOBLING_PORT:8080"',
    '$( [ "$TLS_LETSENCRYPT" = "true" ] && echo \'      - "443:8443"\' )',
    '    env_file: .env', '    volumes:', '      - /opt/kobling/data:/data',
    'EOF',
    'pct exec "$CTID" -- mkdir -p /opt/kobling/data',
    'pct push "$CTID" "$TMP/.env" /opt/kobling/.env --perms 600',
    'pct push "$CTID" "$TMP/docker-compose.yml" /opt/kobling/docker-compose.yml',
    'rm -rf "$TMP"', '',
    'step "Starter Kobling"',
    'pct exec "$CTID" -- bash -c "cd /opt/kobling && docker compose pull -q && docker compose up -d"',
    'ADDR="$(pct exec "$CTID" -- hostname -I | awk \'{print $1}\')"',
    'printf "\\n\\033[32m✓ Kobling kjører på http://%s:%s\\033[0m\\n" "$ADDR" "$KOBLING_PORT"',
    '[ -n "$KOBLING_PUBLIC_URL" ] && echo "  Offentlig adresse: $KOBLING_PUBLIC_URL (krever portvideresending i ruteren)"',
    'exit 0'
  ].join('\n');
}
export function pveOneLiner(c) {
  const def = new Map(pveVars(DEFAULTS));
  const env = pveVars(c).filter(([k, v]) => v !== '' && def.get(k) !== v);
  return [...env.map(([k, v]) => k + '=' + sq(v)), 'bash -c "$(curl -fsSL ' + RAW + '/proxmox/install.sh)"'].join(' ');
}
export function unraidXml(c) {
  const p = c.deploy, ev = Object.fromEntries(envVars(c));
  const cfg = (name, target, val, desc, o = {}) => '  <Config Name="' + xml(name) + '" Target="' + xml(target) + '" Default="' + xml(o.def ?? val) + '" Mode="' + (o.mode || '') + '" Description="' + xml(desc) + '" Type="' + (o.type || 'Variable') + '" Display="' + (o.display || 'always') + '" Required="' + (o.req ? 'true' : 'false') + '" Mask="' + (o.mask ? 'true' : 'false') + '">' + xml(val) + '</Config>';
  return [
    '<?xml version="1.0"?>', '<Container version="2">', '  <Name>kobling-server</Name>', '  <Repository>' + IMAGE + '</Repository>',
    '  <Registry>https://github.com/SebastianKristo/latex-editor/pkgs/container/kobling-server</Registry>', '  <Network>bridge</Network>', '  <MyIP/>', '  <Shell>sh</Shell>', '  <Privileged>false</Privileged>',
    '  <Support>https://github.com/SebastianKristo/latex-editor/issues</Support>', '  <Project>https://github.com/SebastianKristo/latex-editor</Project>',
    '  <Overview>Kobling: LaTeX-editor for elektrorapporter med kretsskjema-editor, sanntidssamarbeid, DuckDNS og backup til SMB-share.</Overview>',
    '  <Category>Productivity: Tools:</Category>', '  <WebUI>http://[IP]:[PORT:8080]/</WebUI>', '  <Icon>' + RAW + '/unraid/icon.png</Icon>', '  <ExtraParams/>', '  <PostArgs/>',
    cfg('Web-port', '8080', p.port, 'Port for nettleser og Mac-app', { type: 'Port', mode: 'tcp', def: '8080', req: 1 }),
    cfg('HTTPS-port', '8443', '443', 'Brukes når Let’s Encrypt er på', { type: 'Port', mode: 'tcp', display: 'advanced' }),
    cfg('Appdata', '/data', p.appdata, 'Dokumenter, figurer, database og lokale backuper', { type: 'Path', mode: 'rw', def: '/mnt/user/appdata/kobling', req: 1 }),
    cfg('Offentlig adresse', 'KOBLING_PUBLIC_URL', ev.KOBLING_PUBLIC_URL, 'Adressen brukerne kobler til', { def: '' }),
    cfg('DuckDNS aktiv', 'DUCKDNS_ENABLED', ev.DUCKDNS_ENABLED, 'true eller false', { def: 'false' }),
    cfg('DuckDNS subdomene', 'DUCKDNS_SUBDOMAIN', ev.DUCKDNS_SUBDOMAIN, 'Uten .duckdns.org', { def: '' }),
    cfg('DuckDNS token', 'DUCKDNS_TOKEN', ev.DUCKDNS_TOKEN, 'Fra duckdns.org', { def: '', mask: 1 }),
    cfg('DuckDNS intervall (min)', 'DUCKDNS_INTERVAL_MIN', ev.DUCKDNS_INTERVAL_MIN, 'Hvor ofte IP-adressen oppdateres', { def: '5', display: 'advanced' }),
    cfg('DuckDNS IPv6', 'DUCKDNS_IPV6', ev.DUCKDNS_IPV6, 'Oppdater også AAAA-post', { def: 'false', display: 'advanced' }),
    cfg('Let’s Encrypt', 'TLS_LETSENCRYPT', ev.TLS_LETSENCRYPT, 'Sertifikat via DuckDNS DNS-01', { def: 'false' }),
    cfg('Backup aktiv', 'BACKUP_ENABLED', ev.BACKUP_ENABLED, 'true eller false', { def: 'false' }),
    cfg('SMB-server', 'BACKUP_SMB_HOST', ev.BACKUP_SMB_HOST, 'Vertsnavn eller IP, f.eks. 192.168.1.10', { def: '' }),
    cfg('SMB-share', 'BACKUP_SMB_SHARE', ev.BACKUP_SMB_SHARE, 'Navnet på sharen', { def: 'backup' }),
    cfg('Mappe i share', 'BACKUP_SMB_PATH', ev.BACKUP_SMB_PATH, 'Undermappe for Kobling', { def: 'kobling' }),
    cfg('SMB-bruker', 'BACKUP_SMB_USER', ev.BACKUP_SMB_USER, 'Bruker med skrivetilgang', { def: '' }),
    cfg('SMB-passord', 'BACKUP_SMB_PASS', ev.BACKUP_SMB_PASS, 'Passord for SMB-brukeren', { def: '', mask: 1 }),
    cfg('SMB-domene', 'BACKUP_SMB_DOMAIN', ev.BACKUP_SMB_DOMAIN, 'Domene eller arbeidsgruppe', { def: 'WORKGROUP', display: 'advanced' }),
    cfg('SMB-versjon', 'BACKUP_SMB_VERSION', ev.BACKUP_SMB_VERSION, '2.1, 3.0 eller 3.1.1', { def: '3.0', display: 'advanced' }),
    cfg('Backup-tidsplan (cron)', 'BACKUP_CRON', ev.BACKUP_CRON, 'Standard: hver natt kl. 03:00', { def: '0 3 * * *' }),
    cfg('Antall backuper', 'BACKUP_KEEP', ev.BACKUP_KEEP, 'Eldre backuper slettes', { def: '14' }),
    cfg('Innhold', 'BACKUP_INCLUDE', ev.BACKUP_INCLUDE, 'docs,figs,hist,users', { def: 'docs,figs,hist,users', display: 'advanced' }),
    cfg('SMTP-server', 'SMTP_HOST', ev.SMTP_HOST, 'Proton Mail: smtp.protonmail.ch (port 587, STARTTLS, bruker = adressen, passord = SMTP-token)', { def: 'smtp.protonmail.ch' }),
    cfg('SMTP-port', 'SMTP_PORT', ev.SMTP_PORT, '587 (STARTTLS) eller 465 (SSL)', { def: '587' }),
    cfg('SMTP-sikkerhet', 'SMTP_SECURITY', ev.SMTP_SECURITY, 'starttls, ssl eller none', { def: 'starttls', display: 'advanced' }),
    cfg('SMTP-bruker', 'SMTP_USER', ev.SMTP_USER, 'Brukernavn hos e-postleverandøren', { def: '' }),
    cfg('SMTP-passord', 'SMTP_PASS', ev.SMTP_PASS, 'App-passord anbefales', { def: '', mask: 1 }),
    cfg('Avsender', 'SMTP_FROM', ev.SMTP_FROM, 'F.eks. Kobling <kobling@mitt-navn.duckdns.org>', { def: '' }),
    cfg('Varsle om kommentarer', 'NOTIFY_COMMENTS', ev.NOTIFY_COMMENTS, 'Send e-post ved nye kommentarer', { def: 'true', display: 'advanced' }),
    '</Container>'
  ].join('\n');
}
