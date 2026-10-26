# Handoff: Kobling – LaTeX-editor for elektrorapporter

> **Til Claude Code:** Les hele denne fila før du starter. **Fasit for utseende er `prototype/Kobling App v2.dc.html`** (design 1a, se «Visuell versjon 2» nederst). Funksjonene er de samme som i `Kobling App.dc.html`. Åpne v2 i en nettleser og klikk gjennom alt. Prototypen er fasiten for utseende og oppførsel. Bygg det som et ekte produkt (klient + server) som oppfører seg nøyaktig likt.

## Overview
Kobling er en editor for tekniske rapporter i LaTeX for elektrostudenter (ELI1300, NTNU-mal i `reference/main.tex`). Den har:
- Visuell dokumenteditor (blokker) som genererer gyldig LaTeX etter malen, med PDF-forhåndsvisning ved siden av (justerbar fordeling).
- Kretsskjema-editor som skriver CircuiTikZ, med 38 symboler, navngitte inn-/utganger, automatisk ryddig plassering og import av innlimt CircuiTikZ-kode.
- Enhets-/symbolvelger som skriver `\qty{}{}` (siunitx) og sjekker notasjonsregler fra malen.
- Sanntidssamarbeid, kommentarer, versjonshistorikk, deling med tilgangsnivå og invitasjon på e-post (Proton Mail SMTP).
- Selvhostet server med DuckDNS, backup til SMB-share, deploy på Proxmox (LXC-skript) og Unraid (Docker-mal). Admin-innstillinger kun for administrator.
- Klienter: macOS-app, Windows-app og nettleser (samme kodebase).

## About the Design Files
Filene i `prototype/` er **designreferanser laget i HTML**. De er klikkbare prototyper som viser tiltenkt utseende og oppførsel, ikke produksjonskode. Oppgaven er å **gjenskape dem i et ekte miljø**. Det finnes ingen eksisterende kodebase (repo `SebastianKristo/latex-editor` er tomt), så velg stakken under.

Prototypen inneholder mye logikk du kan løfte direkte (som ren TypeScript): LaTeX-generering (`docCode`, `preamble`), CircuiTikZ-generering (`circLines`), CircuiTikZ-parser (`parseCircuit`), auto-layout (`autoLayout`), symboltegning (`symEls`), LaTeX→blokk-parser (`parseBlock`, `parseInline`), pagineringsheuristikk og alle valideringsregex. Søk etter funksjonsnavnene i `<script data-dc-script>`-blokken i `Kobling App.dc.html`.

`deploy/generators.js` er ferdig og skal brukes som den er (genererer `install.sh`, Unraid-XML, `docker-compose.yml`, `.env`).

## Fidelity
**High-fidelity.** Farger, typografi, avstander, tekster (norsk bokmål) og interaksjoner er endelige. Gjenskap pikselnært. All UI-tekst skal være ordrett som i prototypen.

## Anbefalt stakk
- **Monorepo** (pnpm workspaces): `apps/web`, `apps/desktop`, `apps/server`, `packages/core`, `packages/ui`.
- **Klient:** React 18 + TypeScript + Vite. Tilstand: Zustand. Editor-blokker som egen modell (ikke contentEditable-HTML som sannhet); bruk f.eks. ProseMirror/TipTap med custom nodes for `unit`, `sym`, `ref` (inline atoms) og blokknoder `abstract, h1, h2, p, eq, fig, img, table`.
- **Desktop:** Tauri 2 (macOS .dmg + Windows .msi) som pakker `apps/web`. Mac: native trafikklys (titleBarStyle overlay). Windows: egne min/maks/lukk-knapper (46 px brede, lukk hover `#c42b1c`). Hurtigtaster `⌘` på Mac, `Ctrl+` på Windows.
- **Matte:** KaTeX med makroene i `MACROS`.
- **Sanntid:** Yjs (CRDT) over WebSocket (`y-websocket` på serveren), awareness for live-markører.
- **Server:** Node 20 + Fastify + SQLite (better-sqlite3) + Yjs-persistens. Kompilering: TeX Live i containeren (`latexmk -pdf`), resultat streames som PDF. Klienten viser ekte PDF via pdf.js (erstatter HTML-etterligningen), med SyncTeX for klikk-synk PDF↔editor.
- **E-post:** Nodemailer. **SMB:** `smbclient` (samba-client) via child_process, ingen mount. **DuckDNS:** HTTP GET i intervall. **TLS:** Let's Encrypt DNS-01 via DuckDNS (lego eller acme.sh).
- **Image:** `ghcr.io/sebastiankristo/kobling-server:latest` (Debian slim + texlive-latex-extra + texlive-pictures + texlive-science + texlive-lang-european + latexmk + samba-client + zstd). Lytter på 8080 (HTTP) og 8443 (HTTPS når `TLS_LETSENCRYPT=true`). Data i `/data`.

## Screens / Views

Rot: full høyde, `min-width:1180px`, bakgrunn `#fbfaf8`, font Instrument Sans. Plattformbryter nederst midt (kun prototype, fjernes i produkt).

### Tittellinje (52 px, `#f3f1ed`, bunnlinje `1px #e2dfd9`, padding 0 16, gap 14)
Venstre→høyre: trafikklys (Mac) / app-ikon «K» 18 px + «Kobling» (Windows/web) · **«Fil ▼»**-knapp (13/600, kant `#dcd8d1`, radius 6) · brødsmuler (`gruppe / Dokumenttittel / underside`) · midt: modusbryter **Visuell | Kode | Delt** (editor) eller **Velg V | Ledning W** + **Plassering Auto | Manuell** + «Rydd nå» (krets) · høyre: kompileringsstatus (prikk 7 px: ok `#4d8a5a`, kjører `oklch(0.55 0.12 75)`, skitten `#8d8982`), avatarer 26 px (overlapp −6), **Del**-knapp (primær), tannhjul ⚙ · Windows: ─ ☐ ✕.

**Fil-meny** (320 px, radius 10, skygge `0 16px 44px rgba(0,0,0,.16)`): Ny fil … ⌘N · Dupliser dokument · Last ned .tex · Skriv ut / lagre som PDF ⌘P · Last ned bilder (n) · Alle prosjekter · skillelinje · NYLIG ÅPNET (6 siste, tittel + gruppe, «· åpen nå»).

### 1. Editor
Tre kolonner: **sidepanel 236 px** · **editor flex** · **dra-håndtak 7 px** · **høyrepanel (bredde = rightW, 320 … vindu−616, standard 500)**.

Sidepanel (`#f3f1ed`): FILER (`main.tex` aktiv `#e4e0d9`; `figurer/<label>.kob`; `bilder/<fil>`; hover viser forhåndsvisningskort 300 px ved x=244: krets-SVG på prikkrutenett / bilde / miniside med seksjoner + «n sider · n ord · tospalte») · DISPOSISJON (h1 pad 8, h2 pad 24, aktiv hvit + blå 600) · KRAV I MALEN: Tospalte, Sider «n av max», Figurer og tabeller referert, Notasjon (\qty, v). OK `#4d8a5a`, avvik `#b26a1e`, klikk hopper til første avvik.

Innsettingslinje (44 px): etikett **SETT INN** (10.5/700, sporing .08em, `#8d8982`, høyre skillelinje) + knapper (hvit, kant `#e2dfd9`, radius 6, 12.5/500, hover kant `#b8b2a8`): `§ Seksjon` `§ Underseksjon` `¶ Avsnitt` | `Ω Enhet` (aksent: bg `oklch(0.95 0.03 250)`, kant `oklch(0.86 0.06 250)`, tekst `oklch(0.42 0.15 250)`) `α Symbol` `∑ Likning` | `⏚ Krets` `▣ Bilde` `▦ Tabell` | `↗ Referanse ▾` · høyre: **1 spalte | 2 spalter**. Raden skal aldri bryte linje (horisontal scroll).

Dokument (maks 760, padding 40/72/160): tittel 32/600, forfattere 14 `#7a766f`, blokker. Aktiv blokk: hvit bg, kant `oklch(0.86 0.06 250)`, radius 8; venstre i marg: × slett, ⋮⋮ dra, type-kode. Live-markører: farget navnelapp over blokka + 2 px stripe til venstre. Kommentarboble til høyre (`oklch(0.88 0.09 85)`).
- Inline-chips: enhet (blå chip, klikk = rediger i velger), symbol (STIX kursiv 18 px, lys blå bg), referanse (grå chip, rød tekst «??» hvis mangler, klikk = hopp).
- Likning: KaTeX-sentrert, nummer `(n)` til høyre; aktiv viser mono-input med kilde + label.
- Kretsfigur: hvitt kort, «Over begge spalter» (kun ved 2 spalter → `figure*`), «Rediger krets», label-chip; bildetekst «Figur n:» redigerbar.
- Bilde: samme kort; aktiv: Bredde 25/50/75/100 %, Over begge spalter, Bytt bilde. Dra bildefil inn hvor som helst (blå 3 px innsettingslinje), lim inn, eller filvelger. Skaler til maks 1600 px.
- Tabell: stilvelger **Rutenett | Booktabs | Enkel | Punktliste**. Punktliste = `itemize` der hver rad er «antall komponent (merknad)» og tall+enhet i celler auto-konverteres til `\qty`. Punktliste har ikke tabellnummer.
- Bunnskuff: «LaTeX ▸» + kode for aktiv blokk (tokenfarget) · «Rediger LaTeX» åpner textarea; «Bruk endringer» parser tilbake (feilmelding rød). «Vis kode ⌥⌘L».

Høyrepanel faner: **PDF | Kommentarer n | Historikk**. PDF: forhåndsinnstillinger **Smal | Lik | Bred**, zoom % = (bredde−56)/440, `.tex`, `PDF`. A4-sider 440×622 ved 100 %, skygge `0 4px 20px rgba(0,0,0,.12)`, aktiv blokk utheves `oklch(0.93 0.04 250)`, klikk → hopp i editor. Kommentarer: kort med avatar, tekst, sitat (klikk = hopp), Løs/Gjenåpne, ny kommentar på valgt blokk. Historikk: hver endring lagrer snapshot med «Gjenopprett».

### 2. Kretsskjema-editor
Palett 220 px (søk + grupper i 2-kolonne kort med ikon): PASSIVE (Motstand, Variabel motstand, Kondensator, Elektrolytt, Spole, Sikring, Krystall), DIODER (Diode, Zener, Schottky, LED, Fotodiode), KILDER (DC, AC, Strømkilde, Batteri), BRYTERE OG MÅLERE (Bryter, Trykknapp, Lampe, Amperemeter, Voltmeter), TRANSISTORER OG OP-AMP (NPN, PNP, N-/P-MOSFET, Op-amp), LOGIKK (AND, NAND, OR, NOR, XOR, XNOR, NOT, Buffer), NODER OG NETT (+V, −V, Jord, Nettnavn). Geometri og CircuiTikZ-navn: se `CT` og `symEls` i prototypen.

Lerret: prikkrutenett 20 px (`#d9d5ce`), snap 0,5 cm = 20 px, 1 cm = 40 px. Dra for å flytte, R roter, ⌫ slett, W ledning (klikk to tilkoblingspunkter; rute = horisontal så vertikal `-|`), knutepunktprikk r 2,8 når ≥ 2 ledninger møtes. Valgt = blå `oklch(0.52 0.15 250)` + stiplet ramme.
- **Auto-plassering (standard på):** etter hver endring kjøres `autoLayout`. Inndata/kilder lengst til venstre, lag etter signalflyt, justert på tilkoblings-y, kilder vertikale, shunt-komponenter til jord hengende under noden, jord under/forsyning over, løse komponenter til høyre. Dra eller roter manuelt → bytter til Manuell (toast). «Rydd nå» i Manuell kjører én gang. Valget lagres per figur (`circuit.manual`).
- **Lim inn LaTeX:** knapp eller ⌘V på lerretet → dialog (720 px) med textarea, «Erstatt skjemaet | Legg til ved siden av», advarsler. Parseren støtter `\draw` med `to[...]` (l, a, \qty), `--`, `-|`, `|-`, `++()`, `\node[<port>, anchor=..] (navn) at (...)`, ankre `(G1.out)`, `node[ground|vcc|vee]`, etiketter → nettnavn/pinnenavn, `\coordinate`.
- Kodepanel 210 px: live CircuiTikZ, klikk linje = velg komponent.
- Inspektør 280 px: Navn og indeks, Verdi (tall + prefiks + enhet → `\qty`), IC (porter), **Innganger og utgang** (navn per pinne, `~D` = overline, `Y_U` = indeks, pinnenummer), Roter, Slett, tellere.
- Topp: Lim inn LaTeX · Avbryt · **Lagre som Figur n**.

### 3. Enhets-/symbolvelger (⌘E, 780 px modal)
Søk øverst. Faner: Verdi med enhet (tall, prefiks p n µ m k M G, 14 enheter, forhåndsvisning 30 px STIX + kode) · Størrelser og symboler (v i R C L P ℓ ω τ φ Δ α β θ + indeks). Notasjonsboks (`oklch(0.96 0.03 75)`): «Malen krever v for spenning, ikke U …». Tall valideres `^-?\d+([.,]\d+)?$`. Enter setter inn ved markøren.

### 4. Deling (420 px popover under Del)
Faner **Inviter | Send på e-post**. Gul advarsel hvis SMTP ikke er satt opp (admin: «Sett opp SMTP», bruker: «Si fra til administrator»).
- Inviter: e-post + rolle (Kan redigere/kommentere/lese) + Inviter; ☐ «Send e-post med lenke og innloggingskode»; melding; personer med rolle-velger og «Invitert · e-post»; Lenke + Kopier; «Alle med lenken»; gruppemappe.
- Send på e-post: Til, Emne, Melding, Vedlegg PDF/.tex/Bilder, «Åpne i e-postprogram» (mailto), Send.
- SISTE E-POSTER med «Vis» → forhåndsvisning av e-posten (Fra = SMTP-avsender, knapp «Godta invitasjon», unik lenke `https://<server>/i/<kode>`, gyldig 7 dager uten konto).

### 5. Prosjektoversikt
Grupper (ADK 61 · ELI1300 …), A4-kort med miniside, tittel, meta, Slett. «Start fra mal»: Rapportmal ELI1300, Labjournal, Tom artikkel. «Ny oblig» → modal med tittel + mal.

### 6. Innstillinger (sidepanel 220 · innhold maks 700 · fil-panel 460)
MINE INNSTILLINGER: **Mal-oppsett** (skriftstørrelse, spalter, innrykk, maks sider, desimaltegn, imaginær enhet j/i, notasjonsvarsel, symbolstil, standard tabellstil) · **Kompilering** (motor, auto) · **Konto**.
ADMINISTRASJON (kun `admin`; andre ser «Bare for administrator» og blir sendt til Konto): **Server** · **DuckDNS** (subdomene `^[a-z0-9-]{1,63}$`, token UUID, intervall 5/10/30, IPv6, Let's Encrypt, Oppdater nå, logg, status) · **Backup til SMB** (server, share, mappe, bruker, passord, domene, SMB 2.1/3.0/3.1.1, tidsplan, behold 7/14/30, innhold, Test tilkobling, Kjør backup nå med fremdrift, liste med Gjenopprett/Last ned) · **E-post (SMTP)** (Proton Mail standard, se under) · **Installer server** (Proxmox/Unraid/Compose, felt, kommando, trinn).
Høyre fil-panel viser generert fil (preamble.tex / .env / install.sh / XML / compose) med Kopier og Last ned. Hemmeligheter maskeres i visning, ekte i nedlasting.

## E-post: Proton Mail (standard leverandør)
`SMTP_HOST=smtp.protonmail.ch`, `SMTP_PORT=587`, STARTTLS, auth PLAIN/LOGIN, `SMTP_USER` = adressen tokenet er laget for, `SMTP_PASS` = SMTP-token (ikke Proton-passord), `SMTP_FROM="Navn <adresse>"` (må være samme adresse). Krever betalt plan + adresse på eget domene; avvis `@proton.me|protonmail.com|protonmail.ch|pm.me` med forklaring og tilby **Proton Bridge** (127.0.0.1:1025, Bridge-brukernavn/-passord). Øvrige forhåndsvalg: Gmail (`smtp.gmail.com:587`, app-passord), Outlook (`smtp-mail.outlook.com:587`), Annen. Instruksjonstrinnene i appen skal vises ordrett.
E-poster: invitasjon, «dokument delt med deg» (med vedlegg), varsel om ny kommentar. HTML + tekstversjon, merkevare «Kobling», primærknapp.

## Interactions & Behavior
- Autokompilering 1,1 s etter siste endring; ⌘S kompiler nå; ⌘E velger; ⌘N ny fil; ⌘O fil-meny; ⌘P skriv ut; ⌘, innstillinger; ⌥⌘L vis/skjul kode; Esc lukker øverste lag.
- Enter i avsnitt = nytt avsnitt; Backspace i tomt avsnitt = slett og gå opp.
- Kryssreferanser nummereres live (`figur n`, `tabell n`, `likning (n)`), bilder og kretsfigurer deler figurnummer.
- Dra-håndtak mellom editor og PDF: col-resize, dobbeltklikk = 500 px, lagres per bruker.
- Toast nederst midt, 2,2 s, `#1f1e1c`.
- Tom-tilstander og feiltekster: bruk ordrett fra prototypen.

## State / Data
- `Document { id, title, authors, group, folder, blocks: Block[] }` (Yjs-dokument).
- `Block` = `abstract{text}` · `h1|h2{text}` · `p{segs: (text|unit{num,prefix,unit}|sym{base,sub,tex}|ref{target})[]}` · `eq{src,label}` · `fig{caption,label,span,circuit{comps,wires,manual}}` · `img{src→fil-id,file,w,span,caption,label}` · `table{style,caption,label,rows: string[3][]}`.
- `Component { id, type, x, y, rot, name, sub, val?, ic?, pinl?: {[pin]: {name,pin}} }`, `Wire { id, a:{c,t}, b:{c,t} }`.
- Server: users (role admin/user), memberships (rolle per dokument), invites (token, utløp 7 d), comments, versions (snapshot), files (bilder), settings (DuckDNS/SMB/SMTP – kun admin-API), mail-log.
- Brukerinnstillinger lokalt: rightW, recent, mal-oppsett.

## Design Tokens
- Bakgrunn `#fbfaf8` · panel `#f3f1ed` · PDF-panel `#e9e6e0` · kort `#fff` · aktiv rad `#e4e0d9` · segmentbakgrunn `#ece9e3` / `#e6e3dd`
- Linjer `#e2dfd9`, `#ebe8e3`, `#d6d2cb` · tekst `#1f1e1c`, `#3d3a36`, `#4a4742`, `#6b6862`, `#8d8982`, `#a29e97`, `#b5b0a8`
- Aksent `oklch(0.52 0.15 250)` (hover `0.47`) · lys `oklch(0.95 0.03 250)` · kant `oklch(0.86 0.06 250)` · utheving `oklch(0.93 0.04 250)`
- OK `#4d8a5a` · advarsel `#b26a1e` (boks `oklch(0.96 0.03 75)`, tekst `#6b4a1a`) · feil `#b3261e` (kant `#e8b4ae`)
- Brukerfarger `oklch(0.62 0.13 30|150|300)`
- Kode-tokens: kommando `oklch(0.48 0.15 300)`, \qty/\cref `oklch(0.5 0.15 250)`, enheter `oklch(0.52 0.15 30)`, matte `oklch(0.5 0.13 150)`, kommentar `#a29e97`
- Fonter: Instrument Sans 400/500/600/700 (UI), JetBrains Mono 400/500 (kode), STIX Two Text (dokument/PDF/symboler). Ligaturer av (`font-variant-ligatures:none`) så `-|` ikke blir ⊣.
- Radius 5/6/7/8/10/12/14 · skygger: vindu `0 30px 80px rgba(0,0,0,.25)`, popover `0 24px 60px rgba(0,0,0,.2)`, meny `0 16px 44px rgba(0,0,0,.16)`, segment `0 1px 2px rgba(0,0,0,.1)`.

## LaTeX-utdata
Preamble skal være som `preamble()` i prototypen (basert på `reference/main.tex`, + `booktabs`, `cleveref` sist). Generert kode skal kompilere uten feil med TeX Live 2024+. Skriv tester: hvert eksempeldokument i prototypen → `latexmk` → 0 feil.

## Akseptansekriterier
1. Alle skjermer ser ut som prototypen (sammenlign side om side).
2. Rundtur: visuell → LaTeX → «Rediger LaTeX» → visuell uten tap.
3. Innlimt CircuiTikZ fra `reference/main.tex` (diodekretsen) importeres og eksporteres til kompilerbar kode.
4. To nettlesere på samme dokument ser hverandres endringer og markører < 300 ms.
5. Invitasjon via Proton SMTP kommer fram med fungerende lenke.
6. `bash install.sh` på Proxmox 8 gir kjørende server; Unraid-malen starter containeren.
7. Planlagt backup havner på SMB-share og kan gjenopprettes.
8. Ikke-admin får 403 på alle admin-API-er og ser ikke admin-faner.

## Assets
Ingen bilder eller ikoner utover tekstglyfer (§ ¶ Ω α ∑ ⏚ ▣ ▦ ↗ ⋮⋮ ⚙). Kretssymboler tegnes som SVG-stier (se `symEls`). Fonter fra Google Fonts. KaTeX 0.16.

## Files
- `prototype/Kobling App v2.dc.html` – **gjeldende prototype** (design 1a + alle funksjoner). Åpnes direkte i nettleser (trenger `support.js` i samme mappe).
- `prototype/Kobling App.dc.html` – forrige visuelle versjon (samme funksjoner, varm palett). Kun referanse.
- `prototype/Kobling Redesign.dc.html` – de tre retningene 1a/1b/1c. Valgt: **1a**, men med «SETT INN»-baren fra eksisterende editor (ikke den flytende pillen).
- `prototype/Kobling.dc.html` – tidlig utforskning (to visuelle retninger, kun referanse).
- `deploy/generators.js` – generator for install.sh, Unraid-XML, compose og .env (bruk som den er).
- `deploy/proxmox/install.sh`, `deploy/unraid/my-kobling-server.xml`, `deploy/docker-compose.yml`, `deploy/.env.example`, `deploy/README.md`.
- `reference/main.tex` – skolens LaTeX-mal. `reference/kretsskjema-eksempel.png` – eksempel på krets studentene må tegne.

## Forslag til første melding i Claude Code
> Les `design_handoff_kobling/README.md` og åpne `prototype/Kobling App v2.dc.html`. Sett opp monorepoet i «Anbefalt stakk». Start med `packages/core` (flytt `docCode`, `circLines`, `parseCircuit`, `autoLayout`, `parseBlock` til TypeScript med tester), deretter `apps/web` (editor + PDF), så kretseditoren, så `apps/server` (Yjs, kompilering, invitasjoner, SMTP), og til slutt Tauri-appene og Docker-imaget. Følg prototypen pikselnært og bruk tekstene ordrett.


---

# Oppdateringer etter første handoff

Alt under er implementert i prototypen og skal med i produktet. Kildefunksjonene i prototypen er nevnt i parentes, så de kan flyttes til `packages/core`.

## 1. Redigerbar LaTeX-kode (fullt dokument)
- Kodevisningen (Kode/Delt) er et **redigerbart tekstfelt over syntaksfarget kode**. Kopier/lim inn fungerer som vanlig. Tab = to mellomrom.
- 600 ms etter siste tastetrykk tolkes hele `main.tex` (`parseDoc`) og synkroniseres til blokkmodellen, innstillingene og PDF-en. Status i kodelinjen: «Synkronisert» (grønn) / «Ikke synkronisert» (rød).
- Ved tolkningsfeil: rød stripe «Linje N: … Visuell editor og PDF viser siste gyldige versjon.» og linjen markeres. Utkastet beholdes til det er gyldig.
- `parseDoc` leser: `\documentclass[...]` (størrelse, twocolumn → spalter), `\title`, `\author{… \\ gruppe}`, `output-decimal-marker`, imaginær enhet, circuitikz-stil, `\setlength{\parindent}{0pt}`. **Ekstra preamble-linjer lagres i `doc.pre`** og skrives ut igjen etter standard-preamble.
- Brødtekst deles i blokker: `abstract`, `equation`, `figure(*)` (circuitikz → krets, `\includegraphics` → bilde), `table`, `itemize` (→ tabell med stil «list»), `\section`, `\subsection`, avsnitt. **Alt annet** (ukjente miljøer, `multicols`, `center`, avsnitt som starter med ukjent kommando, `\[ … \]`) blir blokktypen **`raw`** med `src` ordrett. Blokk-id-er gjenbrukes per type i rekkefølge, så kretser/bilder ikke mistes.
- Klikk på en kodelinje (uten utkast) markerer tilhørende blokk.

## 2. `raw`-blokker (LaTeX-blokk)
- Editor: merkelapp med miljønavn + «LaTeX-blokk · rediger koden direkte», forhåndsvisning, og når aktiv et mono-tekstfelt.
- Forhåndsvisning (`texRender`): overskrifter med nummerering (1, 1.1, 1.1.1; `*` = unummerert), `\SI/\qty/\si/\num` med enhetssymboler, `\cref/\ref` → «tabell 1 / figur 2 / likning (1)» (etiketter fra `texLabels` over hele koden), likninger med nummer, `align`-familien, `\[ \]`, tabeller (booktabs/hline), `\caption`/`\captionof`, `multicols` (CSS-spalter), `center`, lister, `\includegraphics` fra `bilder/` (mangler → rød stiplet boks «Mangler bilder/…»). TikZ/CircuiTikZ vises som stiplet plassholder «… · tegnes i ferdig PDF». Brukerdefinerte makroer fra `doc.pre` (`\newcommand`) sendes til KaTeX.
- **I produktet skal PDF-en komme fra ekte kompilering** (server). Forhåndsvisningen over brukes bare i den visuelle editoren.
- PDF-sider: en blokk høyere enn en side får høyde `auto` (min 622 px) i stedet for å kuttes.

## 3. Feilsjekk og kompileringslogg
- `lintTex(src, files)` kjøres live på koden og ved hver kompilering. **Feil** stopper kompileringen: ubalanserte `{}`/`$`, `\begin`/`\end` som ikke matcher, miljø uten pakke (f.eks. `multicols` → `\usepackage{multicol}`), ukjent miljø, `_ ^ & #` utenfor matte/tabell (tillatt inne i `tikzpicture`/`circuitikz` og i `\newcommand`), manglende bildefil. **Advarsler:** udefinert `\cref`, dobbel `\label`. Linjenumre telles også inne i flerlinjers argumenter. Like meldinger på samme linje vises én gang.
- Kodevisning: rødt/oransje linjenummer, svak bakgrunn og melding i kursiv bak linjen (✕ feil, ▲ advarsel). Antall vises i kodelinjen og åpner loggen.
- Høyrepanel har fanen **«Logg n»**: overskrift («Kompileringen stoppet · n feil» / «Kompilert uten feil»), «Kompiler på nytt», og for hver melding: merke Feil/Advarsel, `main.tex:linje`, TeX-melding (engelsk), forklaring (norsk), kodelinjen. Klikk → hopper til linjen i koden.
- **Hurtigretting:** manglende `}` i `\newcommand` → knapp «Legg til } på linje N». Manglende bilde → «Last opp bildet …» (lagres med nøyaktig filnavnet fra koden).
- Ved feil: statuspillen blir rød «n feil · kompilering stoppet», PDF beholder forrige vellykkede versjon med rød stripe «Vis logg».
- I produktet: kombiner `lintTex` (rask, i klienten) med **ekte latexmk-logg fra serveren** (parse `! …`, `l.NN`, `LaTeX Warning:`) i samme fane og samme format.

## 4. Bilder i fillisten
- Slipp bilder på «FILER» (stiplet ramme + blå tone ved drag) eller klikk «Slipp bilder her, eller klikk for å laste opp». Lagres i `doc.files[] {id, file, src}` → `bilder/<navn>`. Navnekollisjon → `-2`, `-3`.
- Ubrukte bilder vises med «ikke i bruk», forhåndsvisning ved hover, kan dras inn i editoren eller klikkes (settes inn etter aktiv blokk). `\includegraphics{bilder/x}` i koden finner også disse.

## 5. Topplinje, meny og profil
- Logo alltid synlig: blå «K» 24 px (radius 6) + «Kobling», klikk → prosjekter.
- **Fil-knapp**: 30 px høy, radius 8, dokumentikon + «Fil» + chevron (roteres 180° når åpen). Åpen: blå kant + ring `0 0 0 3px`. Meny 300 px, radius 12: Nytt dokument … ⌘N · Dupliser dokument · Last opp bilder … | EKSPORTER: PDF ⌘P · LaTeX-kildekode .tex · Bilder (n) | NYLIG ÅPNET (sideikon, aktivt dokument blå kant) | Alle prosjekter →. Ikoner: 16 px strek 1,4.
- **Tannhjulet er fjernet.** Innstillinger ligger bak **profilikonet** (30 px rund, initialer): meny med navn/e-post, Mørk modus (På/Av), Innstillinger ⌘,, Konto, (admin) Server og backup. Lukkes med Esc/klikk utenfor.

## 6. Mørk modus
- Innstilling **Tema: Lys | Mørk | Som systemet** (Konto › Utseende, standard «Som systemet», følger `prefers-color-scheme` live) + bryter i profilmenyen.
- Implementert med CSS-variabler på roten (`data-theme`). **Papirflater** (PDF-sider, kretslerret, kretsfigurer, hover-forhåndsvisning) holdes lyse med mørk tekst (`[data-paper]`).

## 7. Admin: historikk for andre
- Innstillinger › Server › «TILGANG FOR ANDRE BRUKERE» › **Vis versjonshistorikk** (standard på). Av → «Historikk»-fanen skjules for ikke-admin (historikken lagres fortsatt). Håndheves også i API-et.

## 8. Visuell versjon 2 (design 1a) – tokens
Layout: appbakgrunn med 10 px marg; **sidepanel, editor og høyrepanel er kort** (radius 14, skygge `0 1px 3px rgba(16,24,40,.06), 0 0 0 1px rgba(16,24,40,.03)`), 10 px mellomrom (dra-håndtaket er det 10 px brede mellomrommet). Topplinje 56 px uten bakgrunn/kant. **«SETT INN»-baren beholdes som før.**

Skrift: **Geist** (UI) og **Geist Mono** (kode). PDF: STIX Two Text.

Lys:
- App `#eceef2` · kort `#fff` · hover/flate `#f3f4f7` · kodebakgrunn `#f8f9fb` · linjer `#e4e6ea`, `#eef0f3`, `#d3d7de`
- Tekst `#16181d`, `#30343c`, `#3c414b`, `#5b616d`, `#8b919c`, `#9aa0ab`
- Blå (primær, Del, logo) `oklch(0.55 0.17 255)`, hover `oklch(0.5 0.17 255)`
- **Grønn** (valgt modus, valgt fil, valgt disposisjon) `#138a36` · grønn tone `#e2f3e7` · grønn tekst `#0f6e2b`
- Syntaks: kommando `oklch(0.5 0.16 270)` kursiv · argument/miljønavn/enhet `oklch(0.56 0.14 60)` kursiv · matte `oklch(0.52 0.14 150)` · kommentar `#8b919c` · tekst `#30343c`

Mørk (marineblå):
- App `#141a22` · kort `#1b222c` · flate `#222a35`/`#232c38` · linjer `#2b3441` · tekst `#e9edf2`, `#d6dce4`, `#aab4c2`, `#8f9bab`
- Grønn `#1f9d55`, tone `rgba(31,157,85,.18)`, tekst `#6fdc9c`
- Syntaks: kommando `#9db4ff` · argument `#f2c36b` · matte `#7ad6a0` · kommentar `#6f7d90` · tekst `#dfe5ec`
- Statuspiller: ok `rgba(31,157,85,.18)`, advarsel `rgba(224,163,92,.16)`

Komponenter v2:
- Modusvelger Visuell/Kode/Delt: pille på kort, padding 3, punkter 5×15, radius 999, aktiv grønn med hvit tekst.
- Statuspille: 13/500, padding 5×12, radius 999, bakgrunn etter status (ok grønn tone, advarsel oransje tone, feil rød tone).
- «Del»: pille, padding 7×17.
- Disposisjon: rader 6×10, radius 8; aktiv grønn tone + grønn tekst.
- «main.tex» i fillisten: grønn bakgrunn, hvit tekst 600, radius 8.
- «Krav i malen»: eget felt nederst i sidepanelet (bakgrunn `#f6f7f9`, radius 10, padding 12) med fremdriftsstrek 5 px (sider / maks sider; grønn `oklch(0.62 0.14 150)`, rød over maks).

## Nye akseptansekriterier
9. Lim inn hele rapporten (med `multicols`, tikz-matriser, `\newcommand`) i kodevisningen → ingen falske feil. Bare ekte feil vises (f.eks. manglende `}`, manglende bilde, udefinert `\nb` fra ekte kompilering).
10. Hurtigrettingene fungerer og kompilerer automatisk på nytt.
11. Bilder dratt inn i fillisten kan refereres fra koden med `\includegraphics{bilder/…}`.
12. Mørk/lys/system bytter uten omstart; papirflater forblir lyse.
13. Ikke-admin ser ikke Historikk når den er slått av, og API-et nekter.
