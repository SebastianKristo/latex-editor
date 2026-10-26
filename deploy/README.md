# Kobling server – distribusjon

Filene her er generert fra `generators.js` med standardverdier. Appen (Innstillinger › Installer server) lager tilpassede versjoner med dine DuckDNS- og SMB-innstillinger.

## Proxmox VE 8/9 – helper-skript (anbefalt)
Oppretter en Debian 13-LXC og installerer Kobling direkte (TeX Live, Node.js 22, systemd-tjeneste), uten Docker. Kjør i Shell på Proxmox-noden:

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/SebastianKristo/latex-editor/main/deploy/proxmox/kobling.sh)"

Velg *Standard* eller *Avansert* (CT-ID, ressurser, lagring, bro/VLAN, statisk IP, port og administrator). Uten spørsmål: `KOBLING_DEFAULTS=1 CTID=130 RAM=4096 bash -c "…"`.

- Innstillinger: `/etc/kobling/kobling.env` i containeren (samme variabler som under), deretter `systemctl restart kobling`.
- Oppdatering: `pct exec <CTID> -- kobling-update` (henter siste versjon, bygger og starter på nytt; innstillinger og data beholdes).
- Data: `/var/lib/kobling`. Logg: `journalctl -u kobling -f`.

## Proxmox VE 8 (LXC med Docker)
Kjør i Shell på Proxmox-noden:

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/SebastianKristo/latex-editor/main/deploy/proxmox/install.sh)"

Overstyr verdier med miljøvariabler, f.eks. `CTID=130 RAM=4096 DUCKDNS_SUBDOMAIN=mitt-navn DUCKDNS_TOKEN=… bash -c "…"`.

## Unraid
Kopier `unraid/my-kobling-server.xml` til `/boot/config/plugins/dockerMan/templates-user/`, og velg *kobling-server* under Docker › Add Container.

## Docker Compose
Kopier `docker-compose.yml` og `.env.example` (som `.env`) til samme mappe og kjør `docker compose up -d`.

## DuckDNS
Serveren kaller `https://www.duckdns.org/update?domains=<subdomene>&token=<token>&ip=` hvert `DUCKDNS_INTERVAL_MIN` minutt. Med `TLS_LETSENCRYPT=true` hentes sertifikat via DNS-01 mot DuckDNS.

## E-post (SMTP)
Invitasjoner, varsler om kommentarer og «Send PDF på e-post» går via `SMTP_HOST`. Uten SMTP legges e-poster i utboksen, og delingslenker virker fortsatt.

### Proton Mail
SMTP-token krever betalt abonnement og en adresse på eget domene (ikke @proton.me).
1. proton.me › Innstillinger › Alle innstillinger › IMAP/SMTP › SMTP-tokens › Generer token.
2. Velg avsenderadressen, kopier brukernavn og token (vises bare én gang).
3. `SMTP_HOST=smtp.protonmail.ch`, `SMTP_PORT=587`, `SMTP_SECURITY=starttls`, `SMTP_USER=<adressen>`, `SMTP_PASS=<token>`, `SMTP_FROM=Navn <adressen>`.
4. Sjekk SPF, DKIM og DMARC under Domenenavn i Proton.

## Backup til SMB
Serveren pakker `/data` (dokumenter, figurer, historikk, brukere) som `.tar.zst` etter `BACKUP_CRON` og laster opp med smbclient til `//BACKUP_SMB_HOST/BACKUP_SMB_SHARE/BACKUP_SMB_PATH`. De `BACKUP_KEEP` nyeste beholdes. Ingen mount trengs, så det fungerer også i uprivilegerte LXC-er.

> Container-imaget `ghcr.io/sebastiankristo/kobling-server` bygges og publiseres av CI fra `main` (se `Dockerfile` i roten). Uten `KOBLING_ADMIN_EMAIL` oppretter du administratoren i nettleseren første gang.
