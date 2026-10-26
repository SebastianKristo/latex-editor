# Kobling

LaTeX-editor for tekniske rapporter i elektrofag (ELI1300-malen): visuell blokkeditor med ekte PDF ved siden av, kretsskjema-editor som skriver CircuiTikZ, enhetsvelger for `\qty{}{}`, sanntidssamarbeid, kommentarer, versjonshistorikk, deling på e-post og en selvhostet server med DuckDNS, HTTPS og backup til SMB.

Designgrunnlaget ligger i `design_handoff_kobling/` (prototype, mal og deploy-filer).

## Struktur

| Mappe | Innhold |
|---|---|
| `packages/core` | Ren logikk: LaTeX-generering (`docCode`, `preamble`), CircuiTikZ (`circLines`, `parseCircuit`, `autoLayout`), LaTeX→blokk (`parseBlock`, `parseInline`), nummerering, paginering, og dokumentmodellen i Yjs (`ydoc.js`). |
| `packages/ui` | Kretssymboler som SVG (`symEls`, `drawCircuit`). |
| `apps/web` | Klienten (React 18 + Vite). UI-et kjøres fra prototypens mal (`src/template.html`) via `src/dc-runtime.tsx`, så utseende og tekster er de samme som i prototypen. `src/server-mode.js` kobler appen til serveren, `src/ysocket.ts` er Yjs-tilkoblingen, `src/PdfView.tsx` viser PDF med pdf.js, og `src/Login.tsx` er innlogging og førstegangsoppsett. |
| `apps/server` | Node 22 + Fastify + SQLite (`node:sqlite`): kontoer, roller, invitasjoner, Yjs-synk, kompilering med `latexmk` og SyncTeX, SMTP, DuckDNS, Let's Encrypt og SMB-backup. |
| `apps/desktop` | Tauri 2-skall (macOS .dmg, Windows .msi, Linux .deb) rundt `apps/web`. |
| `deploy/` | `generators.js` og ferdige filer for Proxmox, Unraid og Docker Compose, pluss Proxmox-helper-skriptet `proxmox/kobling.sh` (se `deploy/README.md`). |

## Kom i gang

```sh
pnpm install
pnpm dev:server     # server på http://localhost:8080 (sett KOBLING_DATA=./data)
pnpm dev            # klient på http://localhost:5173, snakker med serveren via proxy
pnpm test           # core + server
node tools/compile-examples.mjs   # alle eksempeldokumentene → latexmk (krever TeX Live)
SMB_USER=… SMB_PASS=… node tools/smb-backup-test.mjs   # backup og gjenoppretting mot en ekte SMB-share
```

Første gang serveren startes uten brukere viser klienten «Opprett administrator». Den første kontoen blir administrator. Uten server kjører klienten bare i demo-modus (`pnpm dev` uten server, eller `?demo=1`), slik prototypen gjorde.

## Hvordan det henger sammen

- **Dokumenter** er Yjs-dokumenter (ett per rapport). Blokker, metadata, kommentarer og historikk ligger i dokumentet. Samtidige endringer i ulike blokker flettes; i samme blokk vinner siste endring. Serveren lagrer tilstanden i SQLite og håndhever roller: lesere får ikke gjennom endringer, og kommentatorer kan bare endre kommentarer.
- **LaTeX-koden kan redigeres direkte** i «Kode» og «Delt». Endringer leses tilbake til blokker, og egne `\usepackage`-linjer tas vare på. LaTeX som ikke passer en kjent blokktype (for eksempel `align` eller egne makroer), blir en «LaTeX»-blokk som skrives ut uendret. Innlimt LaTeX i den visuelle editoren blir også til blokker, og «{ } LaTeX» setter inn en tom LaTeX-blokk.
- **Live-markører** går via Yjs awareness: hvem som står i hvilken blokk.
- **PDF**: klienten sender generert LaTeX til `/api/compile`, og serveren kjører `latexmk` og svarer med PDF. Klikk i PDF-en slår opp linjen med SyncTeX og hopper til blokken. Aktiv blokk markeres i PDF-en.
- **Deling**: invitasjoner gir lenken `https://<server>/i/<kode>`, gyldig i 7 dager og uten konto. E-post sendes med SMTP (Proton Mail som standard). Uten SMTP havner e-posten i utboksen og lenken virker likevel.
- **Admin** (`/api/admin/*`) gir 403 for vanlige brukere. Innstillinger for DuckDNS, backup og SMTP lagres på serveren.
- **HTTPS**: med `TLS_LETSENCRYPT=true` hentes sertifikat fra Let's Encrypt via DNS-01, der TXT-posten settes med DuckDNS-API-et. Serveren fornyer når det er under 30 dager igjen.
  - HTTPS slås av og på straks innstillingen endres. Status og eventuelle feil vises i DuckDNS-loggen under Innstillinger.
  - Videresend TCP 443 i ruteren til serveren. Docker mapper 443 til 8443 i containeren, og Proxmox-installasjonen lytter direkte på 443.
  - Virker ikke adressen hjemmefra, prøv fra mobilnett. Mange rutere sender ikke trafikk til egen offentlig IP tilbake inn (NAT-loopback).

## Server og image

Konfigureres med miljøvariablene i `deploy/.env.example`. I tillegg finnes disse:

- `KOBLING_ADMIN_EMAIL` / `KOBLING_ADMIN_PASSWORD` (valgfritt) – oppretter administratoren ved start. Ellers opprettes administratoren i nettleseren første gang.
- `KOBLING_DATA` (standard `/data`) og `KOBLING_WEB_DIR` (bygget klient).
- `KOBLING_LISTEN_PORT` – porten serveren lytter på. I imaget er den 8080, mens `KOBLING_PORT` fra `.env` er vertsporten som compose mapper til 8080.

```sh
docker build -t ghcr.io/sebastiankristo/kobling-server .
```

Imaget bygger på Debian 13 (trixie, TeX Live 2024). Grunnimaget kan overstyres med `--build-arg RUNTIME=ubuntu:24.04`. Bak en proxy som inspiserer TLS kan rot-sertifikatet gis med `--secret id=ca,src=<ca.pem>`. CI bygger og publiserer imaget fra `main`. Desktop-appene bygges av `.github/workflows/desktop.yml` på macOS og Windows og legges i en GitHub Release når en `v*`-tagg pushes.

## Verifisert

- **Kjernen:** 89 tester. Rundtur visuell → LaTeX → visuell for alle blokker i eksemplene. Diodekretsen fra `main.tex` importeres og eksporteres uten tap. Yjs-modellen fletter samtidige endringer.
- **Serveren:** 12 tester. Ikke-admin får 403 på alle admin-API-er. Invitasjoner og roller fungerer. Lesere og kommentatorer begrenses i Yjs. Varsel om nye kommentarer går på e-post. Utlogging, HTTPS-servering og DuckDNS-TXT er dekket.
- **LaTeX:** alle 5 eksempeldokumentene kompilerer med `latexmk` uten feil, med én og med to spalter (lokalt med TeX Live 2023, og i Docker-imaget).
- **I nettleseren (Playwright mot ekte server):**
  - Førstegangsoppsett og innlogging.
  - Ekte PDF som oppdateres ved endringer.
  - SMTP-test og invitasjon på e-post med fungerende lenke, sendt med STARTTLS og innlogging til en lokal SMTP-server.
  - Lenken åpner dokumentet uten konto.
  - En endring hos den ene vises hos den andre etter om lag 115 ms, inkludert skriving.
  - Live-markør, kommentar med e-postvarsel, og PDF-klikk som hopper til riktig blokk og markerer den.
- **Backup:** backup gjennom UI-et til en ekte Samba-share, endring av dokumentet og «Gjenopprett» gir tilbake det gamle innholdet. Det samme kjøres i CI med `tools/smb-backup-test.mjs`.
- **Docker:** imaget bygger og starter, kompilerer alle eksemplene og tar backup til SMB fra containeren.
  - Compose-filen fra `generators.js` virker med egen port (9090).
  - Oppsettet i Unraid-malen (bridge, portmapping, appdata, variabler) starter containeren.
- **Desktop:** Tauri-appen bygger på Linux (.deb). I et ekte vindu er det testet å koble til serveren, logge inn og redigere med PDF og sanntid.

## Ikke verifisert

- **Proton Mail:** ikke testet mot ekte Proton SMTP, fordi det krever konto og token. Samme kode er testet mot en lokal SMTP-server med STARTTLS og innlogging.
- **Let's Encrypt:** utvekslingen er ikke kjørt mot Let's Encrypt, fordi det krever et ekte DuckDNS-domene. Servering med sertifikat og fornyelseslogikken er testet.
- **Desktop-installere:** macOS (.dmg) og Windows (.msi) bygges bare i CI på egne runnere og er ikke kjørt her. Appene er ikke signert.
- **Proxmox:** ikke kjørt på en ekte Proxmox-node. Helper-skriptet `kobling.sh` er testet med simulerte Proxmox-kommandoer, og installasjonsdelen (`kobling-install.sh`, inkludert `kobling-update`) er kjørt i en ren Ubuntu 24.04-container. Det Docker-baserte `install.sh` er bare syntakssjekket.
- **Debian trixie-imaget:** Docker-imaget er testet med Ubuntu 24.04 som grunnimage, fordi Debian-speilene ikke var tilgjengelige her. Standardimaget (Debian trixie) bygges i CI.
