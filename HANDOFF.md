---
schemaVersion: 1
status: active
currentGoal: Flaskor grillad och beslutad 2026-09-05 (30 beslut i GRILL-STATUS.md), repot skapat, designbrief och startdata på plats, ingen kod än. Arbetsflödet är grill, skiss, överlämning till Claude Design, sedan bygge i Claude Code.
nextAction: Patrik kör docs/DESIGN-BRIEF.md i claude.ai/design och lägger resultatet i design/ (tokens.css med prefixet --fl-, artboards som HTML, ikon). Därefter prompten under §Prompt för byggsessionen i en ny terminal i C:\dev\flaskor.
blockers: []
reviewedAt: 2026-09-05
---

# Handoff: Flaskor

Senast uppdaterad: 2026-09-05 kl. 17:10, efter grillen och designbriefen.

## Läge

Fyra grillomgångar 2026-09-05 gav 30 beslut, alla i [GRILL-STATUS.md](GRILL-STATUS.md). Modell, flöden och arkitektur i [CONTEXT.md](CONTEXT.md). Research i [docs/RESEARCH.md](docs/RESEARCH.md). Designbrief för claude.ai/design i [docs/DESIGN-BRIEF.md](docs/DESIGN-BRIEF.md). En referensskiss av Källaren på desktop i `design/artboards/Main.dc.html` (Claude Design-format, öppnas inte fristående; läs den som HTML för layout och mått). Startdata från Excel i `seed/vinlista.tsv` (21 rader, 25 flaskor). Ingen kod finns.

## Nästa steg

1. Claude Design levererade 2026-09-05. Byggsessionen sparar leveransen i `design/` som första commit (steg 0 i prompten).
2. Bygg v1 P0 enligt prompten nedan, i chunk-läge, en commit per punkt. Prompten läser `design/` om det finns.
3. P1: vindetalj, startdata, cron, PWA, cockpit.

## Val tagna åt Patrik

Repot fick namnet `flaskor` utan uttryckligt ja (rekommenderat framför `bottles`, inte motsagt); `gh repo rename` rättar. Referensskissen använder riktiga Systembolagsviner i Patriks stil, inte Caviste-raderna, för att bilderna skulle finnas.

## Prompt för byggsessionen

Kopiera allt nedanför linjen till en ny Claude Code-terminal i `C:\dev\flaskor`.

---

Bygg v1 av Flaskor i chunk-läge (kör hela batchen, en commit per punkt, push efter varje verifierad punkt; repot har inga externa användare).

Steg 0, före allt annat: Claude Designs leverans klistras in direkt efter den här prompten. Spara den ordagrant i `design/`: alla CSS custom properties i `design/tokens.css`, varje artboard som `design/<vy>.html` (kallaren-desktop, kallaren-mobil, onskelistan, barskapet, vindetalj, lagg-till, kopt-rutan), appikon och ordmärke som `design/icon.svg` och `design/wordmark.svg`, kontrastparen och de fem "gör inte" i `design/README.md`. Ändra ingenting i innehållet. Committa som första commit: `design: Claude Designs leverans 2026-09-05`.

Läs sedan, helt: `CONTEXT.md`, `GRILL-STATUS.md`, `BACKLOG.md`, `HANDOFF.md`, `docs/RESEARCH.md`, `docs/DESIGN-BRIEF.md`, `design/artboards/Main.dc.html`, `seed/vinlista.tsv`. Modellen, flödena, pillerlogiken och tumregeltabellen i CONTEXT.md är beslutade och ändras inte utan att jag säger till.

Bygg BACKLOG.md §v1 P0 uppifrån och ner, sedan P1 i ordning. Ramar:

- Stack enligt beslut 10 och 21: React + Vite + TypeScript `strict`, handskriven CSS, ingen Tailwind, ingen komponentbibliotek. Kopiera Vite-, tsconfig- och Pages-workflow-mönstret från `C:\dev\beefcake` (workflow bygger på push till `main` och deployar `dist/` till GitHub Pages, `base: '/flaskor/'`). Worker i `worker/` med wrangler, D1-bindning, route `flaskor-api.buildapp.se`, cron `0 2 * * *` (04:00 Stockholm sommartid). Vitest för ren logik (piller, tumregel, Systembolaget-parsern) och `@cloudflare/vitest-pool-workers` för Workern som i `C:\dev\schema`.
- Grindkoden (beslut 2): Workern jämför `Authorization: Bearer` mot secret `GATE_CODE`. Att skapa secreten är mitt jobb: skriv kommandot i sammanfattningen, kör det inte. Lokalt går `.dev.vars`.
- Design: `design/` från steg 0 gäller ordagrant: tokens in i `src/tokens.css` (samma namn, samma värden), artboardernas mått, radier och avstånd är facit, ikonen blir favicon och PWA-ikoner. Saknas något i leveransen, stanna och fråga; nödlösning bara om jag säger till: kopiera värdena från `C:\dev\sipdeck\design\tokens.css` till `src/tokens.css` med prefixet `--fl-`, byt accenten till `#872F3D` (pressed `#6C2331`) och lägg pillerfärgerna: drick `#2F6B3F` på `rgba(47,107,63,.13)`, snart `#7A5A0A` på `rgba(184,134,11,.14)`, förbi `#A03B2E` på `rgba(160,59,46,.12)`, vänta `#6E6455` på `rgba(33,27,18,.08)`. Fonter via Google Fonts-länken i Sipdecks tokens. Layouten i `design/artboards/Main.dc.html` är riktmärket för Källaren: sidnavigering 232 px, rader med 88 px flaska, namn i Instrument Serif 21 px, piller 26 px, plus/minus 34 px runda. Mobil: bottennavigering med fyra val, tryckytor minst 44 px.
- Alla strängar i `src/strings.ts` (beslut 18), bara svenska. Belopp med mellanslag som tusentalsavgränsare, `tabular-nums`.
- Systembolaget-hämtningen: `GET https://www.systembolaget.se/produkt/vin/x-<artikelnummer>/` med en vanlig webbläsar-User-Agent, läs `<script id="__NEXT_DATA__">`, hitta objektet med `productNumber` och `productNameBold`. Fält att ta: `productId`, `productNumber`, `productNameBold`, `productNameThin`, `producerName`, `vintage`, `country`, `originLevel1`, `originLevel2`, `categoryLevel1..3`, `grapes`, `priceInclVat`, `volume`, `alcoholPercentage`, `usage`, `taste`, `isTemporaryOutOfStock`, `isCompletelyOutOfStock`, `isDiscontinued`. Bild: `https://product-cdn.systembolaget.se/productimages/<productId>/<productId>_200.webp`. `kind` = `spirit` när `categoryLevel1` är `Sprit`, annars `wine`. Länkar in tolkas med regexen `-(\d{5,7})/?$` på sökvägen. Tumregeln fyller `drink_from`/`drink_to` från `vintage` och `priceInclVat`; sprit och saknad årgång ger null. Skriv ett Vitest-test mot en sparad kopia av en riktig produktsida (hämta en med curl till `worker/test/fixtures/`).
- Startdata: `seed/vinlista.tsv` läses av ett skript `npm run seed` som skriver till D1 via Workern (eller `wrangler d1 execute`). `typ` "Torrt vitt vin" blir kategori `Vitt vin`, `drickes` "2021-2026" blir `drink_from`/`drink_to`, `temp` behålls som text, rader med `antal_kvar` 0 blir `owned = 1, count = 0` (Slut-sektionen), `source_kind = caviste`, `source_id` = `cav_nr`. Bild från Caviste-sidans första `wp-content/uploads/...CAV<nr>...jpg` om den finns, annars ingen bild.
- Funktionskontrakt enligt `C:\dev\CLAUDE.md`: succeed or throw, `get*` kastar `NotFoundError`, `find*` returnerar `T | null`.
- Verifiera varje punkt med den billigaste kontrollen som kan fallera: `tsc`, sedan Vitest, sedan `vite build`, sedan Chromium via Playwright på 1 280 och 390 px mot `vite dev` plus `wrangler dev` (obs: wrangler 4.114 lägger lokala servern bakom Cloudflare Access under Claude Code, lösningen står i vaultnoten `Browser Automation`).
- Stopp som gäller trots chunk-läge: skapa secret, skapa D1-databasen i molnet (`wrangler d1 create`, skriv kommandot till mig), allt som kostar pengar. Allt annat: bestäm, bokför i HANDOFF §Val tagna åt Patrik.

Avsluta med: `BACKLOG.md` bockad för det som är verifierat, `HANDOFF.md` med läge, nästa steg, valen du tog och kommandona jag ska köra (secret, D1, DNS för `flaskor-api.buildapp.se`, GitHub Pages-inställningen), `reviewedAt` satt, daily note i `C:\devbrain\01 - Daily Notes\` med egen sessionssektion. En sammanfattning: byggt, valt åt mig, öppet.
