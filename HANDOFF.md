---
schemaVersion: 1
status: active
currentGoal: Patriks önskelista 2026-09-06 byggd och live (filter, totalpris, tabellvy, sök på mat, Vivino-betyg). Barskåpet från Sipdeck väntar på dumpen.
nextAction: Patrik kör kommandot i §Nästa steg 1 så skafferiet kan seedas, provar tabellvyn och Vivino-betygen på buildapp.se/flaskor, och säger ja eller nej på §Val tagna åt Patrik.
blockers: [Sipdecks skafferi kan inte läsas av Claude Code (klassificeraren stoppar D1-läsning i molnet), Patrik kör kommandot själv]
reviewedAt: 2026-09-06
---

# Handoff: Flaskor

Senast uppdaterad: 2026-09-06 kl. 08:45, önskelistan 2026-09-06 live.

## Läge

v1 (commits `ca195ed` till `4583af4`) plus önskelistan 2026-09-06 (`1e76ee3` till `99021cc`, en commit per punkt) finns i `main` och är live. Verifierat lokalt: `tsc -b`, 33 enhetstester (piller, tumregel, format, sortering, Systembolaget-parsern, Vivino-parsern mot en fixtur klippt ur den riktiga söksidan), 14 Worker-tester i workerd med lokal D1, och Källaren (lista och tabell), Önskelistan och Vindetalj i Chromium på 1 280 och 390 px mot `vite dev` (5180) och `wrangler dev` (8787).

Molnet 2026-09-06: migrering `0002_vivino.sql` körd (fyra nya nullbara kolumner), Workern deployad som version `2f9dc058` (`/health` 200), Pages-workflowkörningen kl. 08:42 grön och bundeln `index-CaUE-K5e.js` bär de nya strängarna. `POST /api/refresh-all` kördes live: 5 Systembolagsrader uppdaterade, 20 viner fick Vivino-svar på 22 sekunder, 19 av dem med betyg (ett vin har under fem röster). Databasen hade 26 rader, så Patrik har redan lagt till fem sedan i går. Resten av vinerna får betyg i natt (tak 20 per natt).

Layout: `src/` (React, `app.css` ovanpå `tokens.css`; `sort.ts` är den enda sorteringen för lista och tabell, `persist.ts` sparar vyval i `localStorage`, `views/CellarTable.tsx` är tabellvyn, `components/Rating.tsx` och `Highlight.tsx`), `shared/` (typer, fel, piller- och tumregellogik), `worker/` (routes i `src/index.ts`, D1 i `src/db.ts`, Systembolaget i `src/systembolaget.ts`, Vivino i `src/vivino.ts`, migreringar, tester, fixturer), `scripts/seed.ts`, `design/` (facit).

## Nästa steg

1. **Skafferiet ur Sipdeck, ditt steg.** Claude Codes klassificerare stoppar all läsning av molnets D1 (både `wrangler d1 execute --remote` och Cloudflare-MCP:n). Kör i prompten:

   ```
   ! cd C:\dev\sipdeck; npx wrangler d1 execute sipdeck --remote --json --command "SELECT id, firebase_uid, state FROM users"
   ```

   Sedan matchas `state.pantry` mot `drinks.json` (149 ingredienser med grupp) och seedas som sprit i barskåpet: `spirits`, `liqueurs` och allt med `bitters` i id:t, antal 1 oöppnad, utan pris och bild. Blobben har inget e-postfält, bara Firebase-uid; finns flera rader med skafferi tas den största och det sägs vilken.
2. **Prova live:** tabellvyn (knappen Lista/Tabell i Källaren), klicka på en kolumnrubrik, bocka i Kommentar och Källa, sök "fisk", öppna önskelistans artikelnummer, se betyget i detaljvyn. Fortfarande ogjort från i går: installera som app på telefonen, ge Julia koden, kolla att cron gått (fältet Kollat i detaljvyn).
3. **Nyckeln till lager per butik** (backlog P3) om du vill ha det: skriptet som gräver nyckeln ur Systembolagets JS-bundle ligger i sessionens scratchpad som `sbkey.mjs` och får inte köras av Claude Code. Säg till så skrivs det in i `scripts/` för dig att köra själv.

Byta grindkod: ändra raden i `.dev.vars` och kör `npx wrangler secret bulk .dev.vars` själv i terminalen. Inte `secret put` via `!`-prefixet: den läser tom stdin och sparar en tom sträng (hände 2026-09-05).

## Val tagna åt Patrik

Chunk-läge 2026-09-06 (önskelistan). Säg till om något ska ändras.

- **Sorteringen** är en select (Pris, Årgång, Fönsterslut, Antal, Namn, Vivino) plus en pil som växlar riktning. Väljs en ny nyckel får den sin naturliga riktning: pris, antal, totalt och Vivino fallande, resten stigande. Tabellens kolumnrubriker delar samma tillstånd, klick på samma rubrik vänder riktningen.
- **Vyval i `localStorage`** (`flaskor.cellar`, `flaskor.columns`), inte i adressen: hash-routingen har inga sökparametrar och ingen behöver länka till ett filter.
- **Totalpriset** räknar antal gånger inköpspris, annars dagspris; rader utan pris räknas som noll utan markering (alla 21 seedrader har pris). Källarens huvud och kategorisummorna räknar bara viner med flaskor kvar; sidofoten räknar allt ägt, sprit inräknad.
- **Grundchipsen** Rött, Vitt, Rosé, Bubbel syns alltid, gråa och oklickbara när kategorin är tom. "Mousserande" heter "Bubbel" i chips och rubriker.
- **Tabellen** visar alla ägda viner, även de med noll flaskor (gråa), platt utan kategorigrupper, med summarad. Dolda från start: Region, Druvor, Karaff, Kommentar, Källa. Namnkolumnen står fast vid sidscroll. Mobilen får tabellen kant i kant.
- **Sökträffen** i mat, kommentar eller smak visas som en extra rad under vinnamnet med ordet markerat, i lista och tabell. Träff i namn, land eller druva markeras bara i tabellen.
- **Vivino**: söksträngen är producent plus namn (inte dubblerad). Första träffen tas när minst hälften av sökorden (tre tecken eller längre, årtal borträknade) finns i träffens namn; annars sparas bara hämtdatumet så raden inte frågas igen i morgon. Betyget är vinets snitt över alla årgångar, inte årgångens. Snittet 0 (under fem röster) sparas som inget betyg men med länk. Fel träff rättas inte i appen än: sätt `vivino_url` med ett PATCH-anrop eller vänta på en redigerbar Vivino-länk i detaljvyn (inte byggd).
- **Uppdatera-knappen** finns nu på alla viner, "Uppdatera från Systembolaget" för Systembolagsrader (gör båda), "Uppdatera Vivino-betyg" för övriga.
- **`POST /api/refresh-all`** bakom grindkoden kör nattens jobb på begäran. Finns för att fylla på betyg direkt och för att kunna verifiera cronen utan att vänta till natten.
- **Länkfält** (`source_url`, `image_url`, `vivino_url`) tar bara `http(s)://`, annars 400. Kom ur commit-granskningens XSS-fynd på `Rating.tsx`: fälten renderas som `href`.
- **Streckkod och etikett** uppskjutet (backlog P3) med motivering i `CONTEXT.md` §Datakällor.

## Fällor

- **`wrangler dev` under Claude Code svarar 401 på allt.** Starta med agentvariablerna avstängda, metoden står i vaultnoten `Browser Automation`. För kontroll i webbläsaren utan att grindkoden hamnar i chatten: `--var GATE_CODE:test-kod` och skriv `test-kod` i grinden.
- **Lokal D1 kan vara tom** även om migreringarna står som körda (2026-09-06). `npm run seed` fyller på från Excel-raderna.
- **Vivinos söksida är 1,7 MB** per vin. Nattens tak på 20 håller cronen kort; höj inte utan att kolla körtiden i `wrangler tail`.
- **Caviste-bilden är en liggande banner**, inte en flaska. Backlog P2.
- **Skärmbilder av utvecklingsservern visar cachad lista** tills sidan laddas om; `location.hash`-byten hämtar inte om.
