# Backlog

Öppet arbete, prioriterat `[P0]` till `[P3]`. Besluten bakom står i [GRILL-STATUS.md](GRILL-STATUS.md), modellen i [CONTEXT.md](CONTEXT.md). En punkt bockas när koden är verifierad, inte när den tros klar.

## Byggt

v1 byggd 2026-09-05 i chunk-läge (commits `ca195ed` till `c1de427`): tsc, 23 enhetstester, 11 Worker-tester i workerd, `vite build`, Chromium 1 280 och 390 px mot `vite dev` och `wrangler dev`. Samma kväll i molnet: D1, Worker på `flaskor-api.buildapp.se` med secret, GitHub Pages på `buildapp.se/flaskor`, 21 seedade rader. Grinden svarar 401 på fel kod live.

Patriks önskelista 2026-09-06 (GRILL-STATUS 31 till 35) byggd i chunk-läge, commits `1e76ee3` till `99021cc`: tsc, 33 enhetstester, 14 Worker-tester, Chromium 1 280 och 390 px. Migrering 0002 körd i molnet, Worker-version `2f9dc058`, Pages-bygget grönt, `refresh-all` live gav Vivino-betyg på 19 av 20 viner.

## Designrunda (före kod)

- [x] `[P0]` Designbrief skriven: `docs/DESIGN-BRIEF.md` (beslut 19, 26).
- [x] `[P0]` Claude Design körd 2026-09-05, leveransen ligger i `design/Flaskor.dc.html`.
- [x] `[P0]` Tokens, ikon och regler lyfta ur leveransen till `src/tokens.css`, `public/`, `design/README.md`.

## v1

- [x] `[P0]` Repo-skelett: React + Vite + TS strict, handskriven CSS, Worker + D1, Pages-workflow, `base: '/flaskor/'` (beslut 10, 21).
- [x] `[P0]` D1-schema `drink` och `household` enligt CONTEXT.md (beslut 3, 22).
- [x] `[P0]` Grindkod: klient sparar i localStorage, Worker jämför Bearer mot secret (beslut 2).
- [x] `[P0]` Lägg till via Systembolagets artikelnummer eller länk: Worker läser `__NEXT_DATA__`, tumregeln fyller fönstret (beslut 6, 13).
- [x] `[P0]` Källaren: gruppering, sortering, sök, chips, piller, "Dags att dricka: N" (beslut 12, 24, 28).
- [x] `[P0]` Önskelistan med Köpt-rutan (beslut 29).
- [x] `[P0]` Barskåpet med fjärdedelar och plus/minus (beslut 14).
- [x] `[P0]` Drack en, Slut-sektionen och "lägg på önskelistan igen" (beslut 16, 30).
- [x] `[P1]` Vindetalj med alla fält redigerbara, temp, karaffering, mat, kommentar (beslut 17).
- [x] `[P1]` Startdata: 21 Excel-rader inlästa, Caviste-bilder hämtade (beslut 25). Verifierat mot lokal D1; molnet väntar på databasen.
- [x] `[P1]` Nattligt cron och uppdatera-knapp: pris, årgång, tillgänglighet (beslut 23). Cron testad i workerd, inte i molnet än.
- [x] `[P1]` PWA: manifest, service worker, cache av senaste listan (beslut 11, 27). Listan cachas i localStorage, skalet av service workern. Installation på telefon overifierad.
- [x] `[P1]` Ordbok för alla strängar, svenska (beslut 18): `src/strings.ts`.
- [x] `[P1]` Cockpit: `gh repo edit --homepage https://buildapp.se/flaskor` gjort, HANDOFF har frontmatter.

## Önskelistan 2026-09-06

- [x] `[P1]` Filtret syns som filter, sortering med riktning, val överlever sidbyte (31).
- [x] `[P1]` Totalpris i Källaren, per kategori och i sidofoten (32).
- [x] `[P1]` Tabellvy med Excel-fälten, sorterbara rubriker, valbara kolumner (33).
- [x] `[P1]` Sök på mat, kommentar och smak med markerad träff; Bubbel-chip (34).
- [x] `[P1]` Vivino-betyg och länkat artikelnummer på önskelistan (35).
- [ ] `[P1]` Barskåpet från Sipdecks skafferi (36): väntar på dumpen ur Sipdecks D1, kommandot står i `HANDOFF.md` §Nästa steg.
- [ ] `[P3]` Streckkod eller etikett för att lägga till (37): Systembolagets data saknar EAN, så en streckkod kan inte bli ett artikelnummer; etikettfoto kräver AI-anrop (beslut 15). Öppnas igen om en EAN-källa dyker upp.
- [ ] `[P3]` Lager i vald butik direkt i Flaskor: `stockbalance/store/{butik}/{produkt}/` hos `api-extern.systembolaget.se` med frontendnyckeln ur Systembolagets JS-bundle (metoden i `AlexGustafsson/systembolaget-api`, `credentials.go`). Nyckeln utvinns inte av Claude Code (klassificeraren stoppar det); Patrik kör i så fall skriptet själv. Tills dess: artikelnumret länkar till produktsidan där Systembolaget minns vald butik.

## Efter första molndeployen

- [ ] `[P1]` Verifiera live som användare: logga in på https://buildapp.se/flaskor, lägg till ett Systembolagsvin, cron-körningen morgonen efter, PWA-installation på Patriks och Julias telefoner. (D1, Worker, secret, Pages och seed gjorda 2026-09-05; grinden ger 401 på fel kod.)
- [ ] `[P2]` Caviste-bilden: sidans första `CAV<nr>`-bild är paketets liggande banner, inte en flaska (upptäckt vid seed 2026-09-05). Antingen `object-fit: cover`, en annan bild från sidan, eller ingen bild för Caviste-rader.
- [ ] `[P2]` Grindkoden ligger i localStorage i klartext på delad dator; räcker tills Firebase Auth (beslut 2).
- [ ] `[P2]` Ta bort en rad (finns inte i v1: en felinlagd rad kan bara flyttas mellan önskelista och källare).

## Senare, beslutat uppskjutet

- [ ] `[P2]` Firebase Auth som Beefcake, användare kopplade till `household_id` (beslut 2).
- [ ] `[P2]` Sipdeck-synk: mappa barskåpsrad till Sipdecks ingrediens-id, knapp som skriver eget skafferi via Sipdecks Worker (beslut 7).
- [ ] `[P2]` Caviste-import via produktlänk (beslut 6).
- [ ] `[P2]` Dagspris från fler källor än Systembolaget, inköpspris mot dagspris (beslut 4).
- [ ] `[P3]` Etikettskanning med foto och AI i Workern (beslut 15).
- [ ] `[P3]` Drucken-logg per rad: datum, betyg 1 till 5, kommentar (beslut 16).
- [ ] `[P3]` Engelska som andra språk (beslut 18).
- [ ] `[P3]` Byt sidläsning mot Systembolagets sortimentsdump om användarantalet växer (beslut 23).
- [ ] `[P3]` Namnsökning hos Systembolaget om nyckeln i deras JS-bundle går att återanvända.
