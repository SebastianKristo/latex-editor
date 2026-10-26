# Kobling

LaTeX-editor for tekniske rapporter i elektrofag (ELI1300-malen): visuell blokkeditor med PDF-forhåndsvisning, kretsskjema-editor som skriver CircuiTikZ, enhetsvelger for `\qty{}{}`, deling, kommentarer og en selvhostet server.

Designgrunnlaget ligger i `design_handoff_kobling/` (prototype, mal og deploy-filer).

## Struktur

| Mappe | Innhold |
|---|---|
| `packages/core` | Ren logikk: LaTeX-generering (`docCode`, `preamble`), CircuiTikZ (`circLines`, `parseCircuit`, `autoLayout`), LaTeX→blokk (`parseBlock`, `parseInline`), nummerering, paginering. Testet med Vitest. |
| `packages/ui` | Kretssymboler som SVG (`symEls`, `drawCircuit`). |
| `apps/web` | Klienten (React 18 + Vite). UI-et kjøres fra prototypens mal (`src/template.html`) via en liten runtime (`src/dc-runtime.tsx`), så utseende og tekster er identiske med prototypen. |
| `apps/server` | Node 22 + Fastify + SQLite (`node:sqlite`): konto, dokumenter, roller, invitasjoner, kommentarer, versjoner, kompilering med `latexmk`, SMTP, DuckDNS, SMB-backup og sanntidssynk over WebSocket. |
| `apps/desktop` | Tauri 2-skall (macOS .dmg, Windows .msi) rundt `apps/web`. |
| `deploy/` | `generators.js` og ferdige filer for Proxmox, Unraid og Docker Compose. |

## Kom i gang

```sh
pnpm install
pnpm dev            # klient på http://localhost:5173
pnpm dev:server     # server på http://localhost:8080 (KOBLING_DATA=./data)
pnpm test           # core + server
node tools/compile-examples.mjs   # krever TeX Live: alle eksempeldokumenter → latexmk
```

URL-parametre i klienten: `?platform=mac|win|web`, `?view=projects|editor|settings`, `?demo=1` (simulerte medforfattere).

## Server

Konfigureres med miljøvariablene i `deploy/.env.example`, pluss:

- `KOBLING_ADMIN_EMAIL` / `KOBLING_ADMIN_PASSWORD` – oppretter administratoren ved første start.
- `KOBLING_DATA` (standard `/data`), `KOBLING_WEB_DIR` (bygget klient som skal serveres).

Admin-API-ene (`/api/admin/*`) gir 403 for vanlige brukere. Hemmeligheter maskeres i svar. Invitasjoner gir lenken `https://<server>/i/<kode>`, gyldig i 7 dager uten konto.

Bygg imaget med `docker build -t ghcr.io/sebastiankristo/kobling-server .` (CI bygger og publiserer fra `main`).

## Status

Ferdig:

- Alle skjermer fra prototypen (editor, krets, velger, deling, prosjekter, innstillinger).
- Kjernelogikk som pakke, med tester for rundtur visuell → LaTeX → visuell og import/eksport av diodekretsen fra `main.tex`.
- Server med konto, roller, invitasjoner (SMTP/Proton), kompilering, DuckDNS, SMB-backup/gjenoppretting og admin-tilgangskontroll.
- Sanntidssynk mellom klienter via serveren (hele arbeidsområdet, siste skriving vinner).
- Tauri-oppsett og Docker-image.

Gjenstår:

- Innloggingsskjerm i klienten. Prototypen har ingen, så i dag logger man inn via invitasjonslenke eller `POST /api/login`.
- Klienten bruker fortsatt lokal lagring (localStorage) for dokumenter og admin-innstillinger. Den er ennå ikke koblet til REST-API-ene for dokumenter, deling og admin.
- Yjs/CRDT i stedet for synk av hele tilstanden, og live-markører via awareness.
- Ekte PDF via pdf.js med SyncTeX. Forhåndsvisningen er fortsatt HTML-etterligningen fra prototypen, selv om `/api/compile` allerede lager ekte PDF.
- TLS med Let's Encrypt (DNS-01 via DuckDNS).
- Ikoner og signering for desktop-appene.
