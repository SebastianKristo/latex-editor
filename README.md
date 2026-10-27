# Kobling

LaTeX-editor for tekniske rapporter i elektrofag (ELI1300-malen): visuell blokkeditor med ekte PDF ved siden av, kretsskjema-editor som skriver CircuiTikZ, enhetsvelger for `\qty{}{}`, sanntidssamarbeid, kommentarer, versjonshistorikk, deling på e-post og en selvhostet server med DuckDNS, HTTPS og backup til SMB.

Designgrunnlaget ligger i `design_handoff_kobling/`. Fasiten er `prototype/Kobling App v2.dc.html` (design 1a), og der ligger også malen og deploy-filene.

## Struktur

| Mappe | Innhold |
|---|---|
| `packages/core` | Ren logikk: LaTeX-generering (`docCode`, `preamble`), CircuiTikZ (`circLines`, `parseCircuit`, `autoLayout`), LaTeX→blokk (`parseBlock`, `parseInline`), nummerering, paginering, og dokumentmodellen i Yjs (`ydoc.js`). |
| `packages/ui` | Kretssymboler som SVG (`symEls`, `drawCircuit`). |
| `apps/web` | Klienten (React 18 + Vite). UI-et kjøres fra v2-prototypens mal (`src/template.html`) via `src/dc-runtime.tsx`, så utseende og tekster er de samme som i prototypen. Tema for lys og mørk modus ligger i `src/theme.css`. `src/server-mode.js` kobler appen til serveren, `src/ysocket.ts` er Yjs-tilkoblingen, `src/PdfView.tsx` viser PDF med pdf.js, og `src/Login.tsx` er innlogging og førstegangsoppsett. |
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
- **v2-funksjoner:**
  - Redigerbar kode med syntaksfarger, «Synkronisert»-status og feilstripe.
  - LaTeX-blokker med forhåndsvisning.
  - Feilsjekk mens du skriver (`lintTex`) og Logg-fanen med hurtigrettinger.
  - Bilder i fillisten.
  - Profilmeny og mørk modus («Som systemet» som standard).
  - Admin-bryter for versjonshistorikk.
- **Kompileringsloggen** samler feilsjekken i klienten og den ekte `latexmk`-loggen fra serveren (feil og advarsler med linjenummer og norsk forklaring). Feil fra feilsjekken stopper kompileringen, som i prototypen.
- **Versjonshistorikken** ligger i et eget Yjs-rom per dokument. Når admin slår av «Vis versjonshistorikk», nekter serveren vanlige brukere tilgang til rommet og kobler fra dem som er inne.
- **LaTeX-koden kan redigeres direkte** i «Kode» og «Delt». Endringer leses tilbake til blokker, og egne `\usepackage`-linjer tas vare på. LaTeX som ikke passer en kjent blokktype (for eksempel `align` eller egne makroer), blir en «LaTeX»-blokk som skrives ut uendret. Innlimt LaTeX i den visuelle editoren blir også til blokker, og «{ } LaTeX» setter inn en tom LaTeX-blokk.
- **TikZ- og CircuiTikZ-figurer i forhåndsvisningen** (README i handoff, §9):
  - Ved hver kompilering trekker serveren ut hvert `tikzpicture`/`circuitikz`-miljø, inkludert `\resizebox`/`\scalebox` rundt, og kompilerer det for seg med `standalone` og samme preamble. `dvisvgm` gjør resultatet om til SVG.
  - Nøkkelen er SHA-256 av preamble + figurkode (`packages/core/src/figures.js`). Klienten regner ut den samme nøkkelen, og uendrede figurer kompileres aldri på nytt.
  - Bildene hentes fra `/api/docs/:id/fig/<hash>.svg`, med samme tilgang som dokumentet.
  - Mens kompileringen pågår, pulserer plassholderen. Feil i en figur vises i Logg-fanen med linjenummer i `main.tex`, og plassholderen blir rød.
- **Gjenoppretting** (Innstillinger › Backup til SMB):
  - Kilde: «Hent fra sharen» eller «Gjenopprett fra fil …». Filen kan være `.tar.zst` eller `.json`, og prototypens format virker også.
  - Velg «Slå sammen» eller «Erstatt alt», og hvilke dokumenter som skal tas med.
  - «Ta backup av nåværende tilstand først» lager `…_for-gjenoppretting.tar.zst`. Den lagres på sharen, eller i `$KOBLING_DATA/backups` uten SMB.
- **SMB-mappevelger:** «Koble til server» lister sharer med `smbclient -L`. Deretter blar man i mapper, kan lage nye med «Ny mappe» og velger «Bruk denne mappen». Feil som NT_STATUS_LOGON_FAILURE og manglende svar på port 445 vises på norsk.
- **Delingslenker via DuckDNS:** når DuckDNS og «Bruk DuckDNS-adressen i delingslenker og invitasjoner» er på, bygger serveren alle lenker og invitasjoner fra `https://<navn>.duckdns.org`, eller `http://<navn>.duckdns.org:<port>` uten HTTPS.
- **Oppdatering av serveren** (Innstillinger › Oppdatering):
  - «Se etter oppdateringer» leser GitHub Releases. Stabil-kanalen bruker bare vanlige releaser, Beta tar også med forhåndsversjoner.
  - På Proxmox legger «Oppdater nå» en forespørsel i `$KOBLING_DATA/update/`. Systemd-enheten `kobling-update.path` kjører da `kobling-update` som root for taggen.
  - Stegene vises i appen: varsle brukere, backup, laste ned, bygge, starte og helsesjekk. «Gå tilbake til …» installerer forrige versjon igjen.
  - Automatisk oppdatering kjører kl. 02, 04 eller 06, og brukerne varsles 5 minutter før.
  - Etter en oppdatering laster åpne apper seg på nytt.
  - I Docker kan ikke containeren bytte sitt eget image. Der viser fanen `update.sh` for verten.
- **Ellers fra prototypen:**
  - Enter i et avsnitt gir linjeskift (`\\`).
  - Sidepanelet kan skjules med ⌘\.
  - Blokker kan dras fra ⋮⋮.
  - Angre og gjør om (⌘Z/⇧⌘Z) synkroniseres som vanlige endringer.
  - Prosjektkortene viser en miniside.
  - Filer kan få nytt navn, og `\includegraphics` oppdateres.
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
- `KOBLING_INSTALL` – `proxmox` (settes av installasjonen) eller `docker` (satt i imaget). Den avgjør hvordan «Oppdater nå» virker.
- `KOBLING_UPDATE_REPO` (standard `SebastianKristo/latex-editor`) – repoet nye versjoner hentes fra.

**Ny versjon:** bump `version` i `apps/server/package.json` (og desktop-appen), merge til `main`, og push taggen `vX.Y.Z`. Taggen lager en GitHub Release med desktop-appene, og serverne ser den under «Se etter oppdateringer».

```sh
docker build -t ghcr.io/sebastiankristo/kobling-server .
```

Imaget bygger på Debian 13 (trixie, TeX Live 2024). Grunnimaget kan overstyres med `--build-arg RUNTIME=ubuntu:24.04`. Bak en proxy som inspiserer TLS kan rot-sertifikatet gis med `--secret id=ca,src=<ca.pem>`. CI bygger og publiserer imaget fra `main`. Desktop-appene bygges av `.github/workflows/desktop.yml` på macOS og Windows og legges i en GitHub Release når en `v*`-tagg pushes.

## Verifisert

- **v2 i nettleseren mot ekte server:**
  - Feil i koden stopper kompileringen, og hurtigrettingen «Legg til }» kompilerer på nytt.
  - `latexmk`-feil («Undefined control sequence») vises med norsk forklaring.
  - Et bilde lastet opp i fillisten kan brukes med `\includegraphics{bilder/…}` og kompilerer.
  - Mørk modus beholder hvite PDF-sider.
  - Vanlige brukere mister Historikk når admin slår den av, både i appen og i API-et.
- **Handoff §9 og §10 i nettleseren mot ekte server, `latexmk`, `dvisvgm` og Samba:**
  - En CircuiTikZ-figur i `\resizebox` vises som SVG i editoren og i forhåndsvisningen etter kompilering.
  - En figur med feil blir rød, og feilen står i Logg-fanen med riktig linje.
  - Mørk modus inverterer figuren i editoren, men ikke på papiret.
  - SMB-mappevelgeren: feil passord gir NT_STATUS_LOGON_FAILURE. Den lagrede mappen åpnes, og man kan bla, lage mappe og velge den.
  - Backup fungerer, «Hent fra sharen» finner den, og ett slettet dokument gjenopprettes med sikkerhetskopi først.
  - Gjenoppretting fra en `.json`-fil i prototypens format virker.
  - Delingslenken bruker DuckDNS-adressen.
  - Oppdateringsfanen sjekker ekte GitHub Releases og viser `update.sh`.
  - Enter gir `\\`, angre og gjør om synkroniseres, nytt filnavn oppdaterer `\includegraphics`, og et skjult sidepanel huskes.
- **Kjernen:** 111 tester (blant annet at klient og server får samme figurnøkkel). Rundtur visuell → LaTeX → visuell for alle blokker i eksemplene. Diodekretsen fra `main.tex` importeres og eksporteres uten tap. Yjs-modellen fletter samtidige endringer.
- **Serveren:** 25 tester, blant annet figurer med ekte `latex` + `dvisvgm` (mellomlager, tilgang, linjenummer ved feil), lenker via DuckDNS, og oppdatering (kanaler, bestilling til `kobling-update`, status etter omstart, Docker). Ikke-admin får 403 på alle admin-API-er. Invitasjoner og roller fungerer. Lesere og kommentatorer begrenses i Yjs. Varsel om nye kommentarer går på e-post. Utlogging, HTTPS-servering og DuckDNS-TXT er dekket.
- **LaTeX:** alle 5 eksempeldokumentene kompilerer med `latexmk` uten feil, med én og med to spalter (lokalt med TeX Live 2023, og i Docker-imaget).
- **I nettleseren (Playwright mot ekte server):**
  - Førstegangsoppsett og innlogging.
  - Ekte PDF som oppdateres ved endringer.
  - SMTP-test og invitasjon på e-post med fungerende lenke, sendt med STARTTLS og innlogging til en lokal SMTP-server.
  - Lenken åpner dokumentet uten konto.
  - En endring hos den ene vises hos den andre etter om lag 115 ms, inkludert skriving.
  - Live-markør, kommentar med e-postvarsel, og PDF-klikk som hopper til riktig blokk og markerer den.
- **Backup:** backup gjennom UI-et til en ekte Samba-share, endring av dokumentet og «Gjenopprett» gir tilbake det gamle innholdet. `tools/smb-backup-test.mjs` (kjøres også i CI) dekker backup, lesing fra sharen, sikkerhetskopi, «Slå sammen» og «Erstatt alt».
- **Docker:** imaget bygger og starter, kompilerer alle eksemplene og tar backup til SMB fra containeren.
  - Compose-filen fra `generators.js` virker med egen port (9090).
  - Oppsettet i Unraid-malen (bridge, portmapping, appdata, variabler) starter containeren.
- **Desktop:** Tauri-appen bygger på Linux (.deb). I et ekte vindu er det testet å koble til serveren, logge inn og redigere med PDF og sanntid.

## Ikke verifisert

- **Proton Mail:** ikke testet mot ekte Proton SMTP, fordi det krever konto og token. Samme kode er testet mot en lokal SMTP-server med STARTTLS og innlogging.
- **Let's Encrypt:** utvekslingen er ikke kjørt mot Let's Encrypt, fordi det krever et ekte DuckDNS-domene. Servering med sertifikat og fornyelseslogikken er testet.
- **Desktop-installere:** macOS (.dmg) og Windows (.msi) bygges bare i CI på egne runnere og er ikke kjørt her. Appene er ikke signert.
- **Proxmox:** ikke kjørt på en ekte Proxmox-node. Helper-skriptet `kobling.sh` er testet med simulerte Proxmox-kommandoer, og installasjonsdelen (`kobling-install.sh`, inkludert `kobling-update`) er kjørt i en ren Ubuntu 24.04-container. «Oppdater nå» er kjørt uten systemd. Brukeren `kobling` la forespørselen, og `kobling-update --request` hentet taggen fra et git-repo, bygde og skrev versjonen og `status.json`. En tagg som ikke finnes ga `ok:false` uten å røre installasjonen. At `kobling-update.path` faktisk starter jobben, er ikke testet, fordi systemd ikke kjører her. Det Docker-baserte `install.sh` er bare syntakssjekket.
- **Debian trixie-imaget:** Docker-imaget er testet med Ubuntu 24.04 som grunnimage, fordi Debian-speilene ikke var tilgjengelige her. Standardimaget (Debian trixie) bygges i CI.
