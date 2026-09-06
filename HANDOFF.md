---
schemaVersion: 1
status: active
currentGoal: Allt Patrik bad om 2026-09-06 är byggt och live, senast bulkimport via egen AI med ångra, massåtgärder i tabellen, tabellen utan slut, sorteringen bredvid sök.
nextAction: Patrik provar importen med en riktig Systembolagslista (Lägg till, "Importera en hel lista via din AI"), massåtgärderna i tabellen, och säger ja eller nej på §Val tagna åt Patrik.
blockers: []
reviewedAt: 2026-09-06
---

# Handoff: Flaskor

Senast uppdaterad: 2026-09-06 kl. 13:05, bulkimport, massåtgärder, visa slut och sorteringens plats live (Worker `bfc28ed5`, commit `00e2531`). Verifierat: tsc, 40 enhetstester, 17 Worker-tester, Chromium 1 280 och 390 px (import av två rader, ångra, massborttagning av två rader och ångra som gav dem tillbaka med betyg och antal).

## Läge

v1 (commits `ca195ed` till `4583af4`) plus önskelistan 2026-09-06 (`1e76ee3` till `99021cc`, en commit per punkt) finns i `main` och är live. Verifierat lokalt: `tsc -b`, 33 enhetstester (piller, tumregel, format, sortering, Systembolaget-parsern, Vivino-parsern mot en fixtur klippt ur den riktiga söksidan), 14 Worker-tester i workerd med lokal D1, och Källaren (lista och tabell), Önskelistan och Vindetalj i Chromium på 1 280 och 390 px mot `vite dev` (5180) och `wrangler dev` (8787).

Molnet 2026-09-06: migrering `0002_vivino.sql` körd (fyra nya nullbara kolumner), Workern deployad som version `2f9dc058` (`/health` 200), Pages-workflowkörningen kl. 08:42 grön och bundeln `index-CaUE-K5e.js` bär de nya strängarna. `POST /api/refresh-all` kördes live: 5 Systembolagsrader uppdaterade, 20 viner fick Vivino-svar på 22 sekunder, 19 av dem med betyg (ett vin har under fem röster). Databasen hade 26 rader, så Patrik har redan lagt till fem sedan i går. Resten av vinerna får betyg i natt (tak 20 per natt).

Layout: `src/` (React, `app.css` ovanpå `tokens.css`; `sort.ts` är den enda sorteringen för lista och tabell, `persist.ts` sparar vyval i `localStorage`, `views/CellarTable.tsx` är tabellvyn, `components/Rating.tsx` och `Highlight.tsx`), `shared/` (typer, fel, piller- och tumregellogik), `worker/` (routes i `src/index.ts`, D1 i `src/db.ts`, Systembolaget i `src/systembolaget.ts`, Vivino i `src/vivino.ts`, migreringar, tester, fixturer), `scripts/seed.ts`, `design/` (facit).

## Nästa steg

1. **Barskåpet är seedat** (kl. 09:05): 18 sorter ur Sipdecks skafferi, antal 1 oöppnad, utan pris och bild, kommentaren "Från Sipdecks skafferi (id)". Tryck "Öppna en" på de som är öppnade. Sipdecks D1 lästes av Patrik själv (Claude Codes klassificerare stoppar D1-läsning i molnet), och kontot var id 1 av sex; de två största skafferierna (id 7 och 8) är testkonton.
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
- **Ta bort** är två tryck på samma knapp ("Säkert? Tryck igen"), ingen dialogruta: webbläsarens `confirm()` blockerar allt annat och ser olika ut per telefon. Knappen ligger längst ner i detaljvyn, grå, röd vid hover. Ingen ångra: raden är borta när servern svarat.
- **Vivino-länken** ger källa `manual` (inte en ny `source_kind`, det hade krävt en ny CHECK-constraint och tabellbygge i SQLite) med Vivino-länken i betygsfältet. Vivinos matförslag kommer på svenska tack vare `accept-language`. Landsnamn översätts för de 17 vanliga, resten behåller Vivinos engelska. Namnet blir producent plus vinnamn ("Colombera & Garella Cascina Cottignano Bramaterra"), längre än Excel-namnet.
- **Skriv in själv** återanvänder Ändra-formuläret (nu exporterat ur `Detail.tsx`) och matar den vanliga förhandsvisningen, så sparknapparna är desamma. Namn är obligatoriskt (webbläsarens `required`). Kategori förifylls "Rött vin" för vin.
- **Bulkimporten** slår upp artikelnummer i klienten via `GET /api/systembolaget` fyra åt gången, ingen ny Worker-route. Raderna sparas en och en med vanliga `POST /api/drinks`, så varje vin får Vivino-betyg på vägen (cirka en sekund per rad). Rader utan nummer blir källa `manual` med kategori "Rött vin" för vin. Prompten ligger i `strings.ts` och ber om `nr, namn, argang, pris, antal, typ`; läsaren `importParse.ts` tål kodstaket, text runt om och tal som strängar.
- **Ångra** lever i minnet i tio minuter (`store.setUndo`), inte i databasen: en omladdning tar bort raden. Ångrad borttagning återskapar raderna som nya id:n med samma innehåll. Vald hellre än en papperskorg i databasen (mer schema, mer kod) för ett hushåll med två användare.
- **Massåtgärderna** i tabellen är Ta bort och Lägg på önskelistan igen, inte Drack en eller Köpte fler (de är ett tryck per rad ändå). Markeringen nollställs när vyn byts.
- **Tabellen utan slut** är standard (`showZero: false`), motsatt listvyn som har Slut-sektionen ihopfälld. Knappen "Visa slut (N)" står först i kolumnraden.
- **Barskåpsseeden** går via API:t med grindkoden ur `.dev.vars` (`scripts/seed-bar.ts`), inte via wrangler, och hoppar över sprit som redan finns med samma namn. Kategorierna (Whisky, Rom, Gin, Likör, Bitterlikör, Bitter) är satta för hand i `seed/barskap.tsv`, Sipdeck har bara grupperna spirits, liqueurs och pantry.

## Fällor

- **`wrangler dev` under Claude Code svarar 401 på allt.** Starta med agentvariablerna avstängda, metoden står i vaultnoten `Browser Automation`. För kontroll i webbläsaren utan att grindkoden hamnar i chatten: `--var GATE_CODE:test-kod` och skriv `test-kod` i grinden.
- **Lokal D1 kan vara tom** även om migreringarna står som körda (2026-09-06). `npm run seed` fyller på från Excel-raderna.
- **Vivinos söksida är 1,7 MB** per vin. Nattens tak på 20 håller cronen kort; höj inte utan att kolla körtiden i `wrangler tail`.
- **Caviste-bilden är en liggande banner**, inte en flaska. Backlog P2.
- **Skärmbilder av utvecklingsservern visar cachad lista** tills sidan laddas om; `location.hash`-byten hämtar inte om.
