# Backlog

Öppet arbete, prioriterat `[P0]` till `[P3]`. Besluten bakom står i [GRILL-STATUS.md](GRILL-STATUS.md), modellen i [CONTEXT.md](CONTEXT.md). En punkt bockas när koden är verifierad, inte när den tros klar.

## Flaskor och Sipdeck, beslutat 2026-10-04

Specifikation: [ADR 0001](docs/adr/0001-sipdeck-hemma.md). Byggt och live 2026-10-06 (PR #1, squash `509ac91`). Ägar-QA med riktiga inloggningar återstår, punkterna står i `HANDOFF.md`.

- [x] `[P1]` (byggt 2026-10-06, 15 Worker-tester i `worker/test/sipdeck.test.ts`) Säker valfri kontokoppling till hushåll, tillgänglighet från relevanta flaskor och återkallelse enligt ADR. Klassificeringen ägs av Sipdeck.
- [x] `[P1]` (byggt 2026-10-06, `src/sipdeck.test.ts`, gästflödet kört i Chrome på 390 och 1 280 px) Kontextlänk till Sipdecks recept; integrationstester för flera flaskor, sista slut, hushållsbyte, raderat konto, två hushåll och fel projekt-token.
- [x] `[P2]` (byggt 2026-10-06) Svensk inköpsväg: `#/lagg-till?q=` kör söket, produkten väljs före önskelistan.
- [x] `[P1]` (2026-10-06) Migrering 0010 körd mot lokal D1 med riktiga rader, utrullnings- och återställningsplan i `HANDOFF.md`.
- [x] `[P1]` (utrullad 2026-10-06 kl. 17:38 till 18:20 på Patriks ja, steg och kontroller i `HANDOFF.md` §2026-10-06) **Patrik:** godkänn utrullningen och kör den i ordningen i `HANDOFF.md`.
- [ ] `[P1]` **Patrik:** ägar-QA av Sipdeck-kopplingen med riktiga inloggningar, sju punkter i `HANDOFF.md` §Ägar-QA efter utrullning.
- [x] `[P3]` (reproduceras inte 2026-11-24: live-sök via `flaskor-api.buildapp.se/api/search` gav 10 träffar på "Kaffelikör", 8 på både "Kahlúa" och "Kahlua", 10 på "Glögg", "Moët", "Smögen" och "Côtes du Rhône". Systembolagets sök tål nu diakriter och hittar ingrediensnamnet; ingen kodändring) Inköpshjälpens sökord är ingrediensens svenska namn. "Kaffelikör" ger noll träffar hos Systembolaget; användaren får skriva om frågan. Ett eget sökord per ingrediens (fältet `buy` i Sipdecks `drinks.json` läses redan) om det stör. Kandidat refuserad 2026-10-31: den tog bort diakriter ur användarens sökning, men bara Kahlúa är verifierat; å, ä och ö hos Systembolaget är inte provat och kan förstöra svenska sökningar.

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
- [x] `[P1]` Barskåpet från Sipdecks skafferi (36): 18 sorter seedade i molnet 2026-09-06 med `npm run seed:bar` (`seed/barskap.tsv`, skript mot API:t, hoppar över namn som redan finns).
- [x] `[P1]` Lägg till från Vivino-länk (38): producent, namn, typ, region, land, druvor, alkohol, bild, betyg och mat ur vinsidan, årgång ur `?year=`.
- [x] `[P1]` Skriv in själv (39): formuläret från Ändra i Lägg till, vin eller sprit, sedan samma förhandsvisning och sparknappar.
- [x] `[P1]` Bulkimport via egen AI (40): "Importera lista" under Lägg till, prompt att kopiera, JSON klistras in, artikelnummer slås upp hos Systembolaget, granskningstabell med mål och antal per rad, ångra i tio minuter. Kryssrutor i tabellvyn med Ta bort och Lägg på önskelistan igen, båda med ångra.
- [x] `[P1]` Tabellen döljer viner med noll flaskor tills "Visa slut" trycks (42), så en sökning på "skaldjur" bara ger det som finns hemma.
- [x] `[P2]` Sorteringen flyttad bredvid sökrutan, Lista/Tabell längst till höger på samma rad (43).
- [x] `[P1]` Streckkod eller etikett för att lägga till (37, byggd 2026-09-08 på Patriks begäran, beslut 15 återöppnat): EAN-källan dök upp (Open Food Facts) och etikettläsningen blev billig (Gemini Flash-Lite på gratisnivån). Foto eller streckkod ger en gissning, Systembolagets sök ger tre kandidater att välja bland, sedan hela raden med pris och bakgrund som vanligt.
- [x] `[P3]` Lager i vald butik: byggt 2026-09-09. Blockeringen föll när nyckeln kom in i repot för skanningen 2026-09-08, den behövde aldrig grävas ur deras bundle. Svaret ger både saldo och hyllplats.

## Efter första molndeployen

- [ ] `[P1]` Verifiera live som användare: logga in på https://buildapp.se/flaskor, lägg till ett Systembolagsvin, PWA-installation på hushållets telefoner. (D1, Worker, secret, Pages och seed gjorda 2026-09-05; grinden ger 401 på fel kod.) **Cronen är avbockad 2026-09-09**: 19 rader i molnet bär `price_checked_at` 2026-09-09 kl. 04:00 och 04:01 svensk tid (02:00 UTC), vilket är exakt schemat `0 2 * * *`. Beslut 23 är därmed inte längre overifierat i molnet.
- [x] `[P2]` Caviste-bilden: rätt flaska väljs nu ur sidan (2026-09-09). `scripts/caviste.ts` rankar på ord ur vinnamnet i filnamnet och därefter på höjd genom bredd ur WordPress storlekssuffix; `npm run fix:caviste` rättade alla 21 rader i molnet. 18 blev rätt flaska, 3 (Chianti Classico, Côtes du Rhône, La Butte 'O') fick fel eftersom Caviste förkortar dem `CC`, `CDR` och `CNP`. De rättas för hand i Ändra, som nu har både bildlänk och Vivino-länk.
- [x] `[P2]` Grindkoden ligger i localStorage i klartext på delad dator; räcker tills Firebase Auth (beslut 2). Löst av inloggningen 2026-09-15: en sparad kod används en gång och tas bort.
- [x] `[P2]` Ta bort en rad: knapp längst ner i detaljvyn, två tryck utan dialogruta (2026-09-06, Patrik saknade den efter en felinläggning).

## Öl och betyg 2026-09-07

- [x] `[P1]` Öl som tredje `kind`: går att lägga till (Lägg till, Systembolagets nivå 1 "Öl") och äger plats i både Källaren och Önskelistan, inget drickfönster, ingen öppen-flaska-logik.
- [x] `[P1]` Eget betygsfält (`rating`, `rating_url`) för sprit och öl, som Vivino inte täcker; `Rating`-komponenten visar det när Vivino-betyget saknas, samma stjärnformat.
- [x] `[P1]` Önskelistan ombyggd i samma stil som Källaren/Barskåpet: sök, sortering (billigast först som standard), kind- och kategorichips, lista/tabell-växel.
- [x] `[P2]` Distiller-import utredd och avfärdad som helautomatisk lösning (2026-09-07): Cloudflares utmaningssida blockerar all vanlig HTTP-hämtning, bara en riktig webbläsarflik tar sig igenom, så en Worker/cron kan aldrig göra det. Att först hämta "alla vanligaste spritprodukter" från Systembolaget är dessutom redan blockerat (se P3-raden om sortimentsdumpen nedan). Byggt istället: en "Sök på Distiller"-länk i detaljvyn för sprit och öl (`distiller.com/search?term=<namn>`), samma mönster som "Sök på Vivino" för vin. Manuell, en i taget, men funkar för alla flaskor för alltid utan skrapningsrisk.

## Vivino och bilder 2026-09-09

- [x] `[P1]` Vivino-länken går att rätta i Ändra, och en rad med sparad `vivino_url` hämtar betyget från just den vinsidan i stället för att söka om på namnet. Förut skrev nattens cron tillbaka fel vin. Bildlänken är också redigerbar.
- [x] `[P2]` Caviste-bilden, se ovan.
- [x] `[P2]` `npm run seed -- --remote` kräver nu `--force`: den raderar alla caviste-rader och skriver om dem, så antal och kommentarer i molnet försvann utan varning.
- [x] `[P3]` Ölkategorin verifierad mot skarpa data: Systembolagets `categoryLevel1` är exakt `"Öl"`, som gissat 2026-09-07. Ingen kodändring behövdes.

## Lager och namnsök 2026-09-09

- [x] `[P1]` Lagersaldo i vald butik, med hyllplats. `GET /api/stock?drink=&store=`, butiken vald en gång och sparad i `localStorage`, saldot hämtat på knapptryck i detaljvyn. Migrering 0004 lade till `sb_product_id`: lagret slås upp på Systembolagets interna produkt-id, och artikelnumret ger tyst 0 på varje butik.
- [x] `[P1]` Butikslistan, 455 butiker, genererad ur Systembolagets sitemap med `npm run stores`. Namnen tas ur varje butikssidas titel eftersom slugen tappat å, ä och ö. Ligger i bundeln (27 kB), inte hämtad vid körning: appen är en PWA.
- [x] `[P1]` Kolla lagret för hela Önskelistan i vald butik: butiksrad, knappen "Kolla lagret för alla N", summering ("3 av 5 finns i butiken") och en saldorad med hyllplats per vara. Fyra anrop i taget via den vanliga routen, ingen ny Worker-route, inget automatiskt.
- [x] `[P1]` Sök på namn i Lägg till. Samma ruta som artikelnummer och länkar: rena bokstäver går direkt till söket, en fråga med siffror provar artikelnumret först och faller tillbaka på söket. Träffarna visas i skanningens kandidatlista.
- [x] `[P3]` Lagersaldo för hela Önskelistan, byggt 2026-09-09 senare samma dag. Invändningen gällde automatiska anrop vid sidladdning, inte funktionen: nu sker det på en knapp, fyra åt gången, och resultatet lever i minnet.

## Caviste-import och drucken-logg 2026-09-09

- [x] `[P1]` Caviste-import via produktlänk (beslut 6). En CAV-låda innehåller flera viner, och sidan bär hela raden för vart och ett: antal, årgång, namn, pris, typ, ursprung, druvor, alkohol, drickfönster, serveringstemperatur, karaffering, smaknot och matförslag. Klistra in lådans länk i Lägg till, välj vinet, spara. Varje vin får sin egen flaskbild ur radens cell. Verifierat mot CAV0143 och CAV0179, som har olika taggning.
- [x] `[P1]` Drucken-logg per rad (beslut 16), migrering 0005: datum, betyg 1 till 5 och kommentar, senast druckna först, i detaljvyns block "Drucket". **"Drack en" är oförändrad**, beslut 16 säger uttryckligen ingen ruta och inget betyg vid nedräkningen.
- [x] `[P3]` Loggen syns i listan, byggt 2026-09-09 (femte omgången). `GET /api/drinks` bär senaste avsmakningens datum och betyg samt antalet, hämtade i samma fråga med en LEFT JOIN, så inget anrop per rad behövs. Raden visar "Drucken 30 aug 2026 ★★★★★ · 2 ggr", tabellen får kolumnen Drucken (dold från start) och sorteringen nyckeln "Senast drucken". **Flödet blev sorteringen**, inte en ny vy: fallande på senast drucken är samma sak, och kostade ingen route och ingen nav-plats.

## Senare, beslutat uppskjutet

- [x] `[P2]` Firebase Auth som Beefcake, användare kopplade till `household_id` (beslut 2). Byggd 2026-09-15, se §Öppen för fler hushåll.
- [x] `[P2]` Caviste-import via produktlänk (beslut 6): byggd 2026-09-09, se nedan.
- [ ] `[P2]` Dagspris från fler källor än Systembolaget, inköpspris mot dagspris (beslut 4).
- [ ] `[P3]` Streckkodsläsning i kameran på iPhone: `BarcodeDetector` finns inte i WebKit, ett WASM-bibliotek på cirka 1 MB krävs. Tills dess läser Gemini siffrorna ur fotot, eller så skrivs de i rutan.
- [x] `[P3]` Drucken-logg per rad: byggd 2026-09-09, se nedan.
- [ ] `[P3]` Engelska som andra språk (beslut 18).
- [x] `[P3]` Byt sidläsning mot Systembolagets sortimentsdump om användarantalet växer (beslut 23): byggd 2026-09-12 som spegeln, se nedan.
- [x] `[P3]` Namnsökning hos Systembolaget: byggt 2026-09-09, samma nyckel och samma sök som skanningen redan använde.

## Spegeln 2026-09-12

Systembolaget sa nej till officiell API-åtkomst. Workaround: spegel av sortimentet i D1, reserv och cache, så frontendnyckeln får dö och många användare får dela den.

- [x] `[P1]` Spegel av sortimentet (beslut 23), migrering 0006: `sb_product` med 27 035 rader fylld av GitHub Actions varje natt via `POST /api/assortment` i bitar om 300. Workern dog på CPU-taket när den försökte själv (fel 1102 efter 2 s och 9 000 rader), därför skriptet.
- [x] `[P1]` Reserv: söket och skanningen faller till spegeln vid 401/403/429/5xx från Systembolaget; produktuppslag vid 5xx från produktsidan (404 förblir 404). Natten läser ur spegeln, taket på 50 gäller bara sidhämtningar.
- [x] `[P1]` Cache API på sök (30 min) och lager (10 min). Lokalt lasttest: 200 samtidiga sökningar, kall cache 86 ms, varm 5 ms, alla 200.
- [x] `[P1]` **Patrik:** Actions-hemligheten `FLASKOR_GATE_CODE` skapad 2026-09-12, nattens körning 2026-09-13 grön.
- [x] `[P0]` Spegeln skriver bara ändrade rader (`fd88043`, 2026-09-13): `INSERT OR REPLACE` kostade två D1-skrivningar per rad, 54 000 per natt, och tre körningar samma dag sprängde kontots kvot på 100 000 så alla sju databaserna gav skrivfel till midnatt UTC. Utgångna rader hittas nu via dumpens nummerlista i `done`. Kvar att läsa av: nattens logg, se `HANDOFF.md` §Nästa steg 0c.
- [x] `[P3]` (byggt 2026-10-06: `shared/retry.ts`, tre försök per anrop vid nätavbrott, 429 och 5xx, aldrig vid 4xx; test i `shared/retry.test.ts`, och skriptet kört mot en lokal låtsasserver som bröt ett anrop och svarade 503 på ett: 94 anrop, 92 lyckade, `ok: 27295 rader`. Inte kört i Actions än) `scripts/assortment.ts` har inget omförsök. Nattkörningen 2026-10-06 föll på `fetch failed, other side closed` (ett nätavbrott, fem gröna nätter före), omkörd för hand samma kväll: 27 295 rader, 20 ändrade, 31 borttagna. Lägg till ett omförsök per anrop om det händer igen.
- [x] `[P2]` FTS5 i spegeln i stället för LIKE, byggd 2026-09-15 (migrering 0009, cirka 300 skuggrader). Fyllningen kostar cirka 27 000 skrivna rader en gång, se `HANDOFF.md` §Nästa steg. Gratisplanens D1-kvot är 5 miljoner lästa rader per dygn för hela kontot, och LIKE läser alla 27 035 rader per fråga: 185 reservsökningar på ett dygn tömmer kvoten. FTS5 (som D1 stöder) läser bara träffarna. Blir akut först när reserven används på riktigt, alltså när nyckeln dör eller lasten ger 429.
- [x] `[P3]` Rate Limiting-bindningen per användare, byggd 2026-09-15 (`SCAN_LIMIT` 10/min, `LOOKUP_LIMIT` 60/min per konto).

## Tillgänglighet 2026-09-13

Patrik: "Tillfälligt slut i butiken" i Önskelistan går inte att tolka. Utredningen visade fel data: dumpens `isTemporaryOutOfStock` är true på varje rad, så natten satte `temporarily_out` på alla 19 Systembolagsrader.

- [x] `[P1]` Spegeln ignorerar dumpens `isTemporaryOutOfStock`; `sb_assortment` (sortimentskoden) på raden; `availability` vidgad med `supplier_out` och `sold_out`; Önskelistan skriver "sortiment · status" ("Ordervara · Slut hos leverantören", "Fast sortiment · Finns hos Systembolaget", "Slutsåld", "Utgått ur sortimentet"). Migrering 0007 bygger om `drink` och `tasting`. Commit `7fa58a7`.
- [x] `[P1]` Migrering 0007 körd i molnet av Patrik 2026-09-13, Worker `be3892f7`, spegeln körd om, refresh-all 19 av 19. På vägen: `DUMP_FIELDS` saknade `assortment` och `isSupplierTemporaryNotAvailable` så första spegelkörningen gav null; fix `c2258fa` med test genom `slim`.
- [x] `[P3]` (byggt 2026-10-06, `availabilityText` i `src/format.ts` delas av Önskelistan och detaljvyn, test i `src/format.test.ts`, sett i Chromium på 1 280 och 390 px i gästläge) Samma text i detaljvyn: raden Tillgänglighet i priskortet för Systembolagsrader.

## Öppen för fler hushåll 2026-09-15

Patrik vill dela appen på AI-forum och senare vinforum. Byggt i batch-läge, tre commits: `6e61858` Worker, `fafc1ee` klient, `62730d7` FTS5.

- [x] `[P0]` Firebase-inloggning (Google, e-post med bekräftelse), ett hushåll per konto, inbjudningskod, radera konto. Migrering 0008. 12 Worker-tester med riktigt signerade token.
- [x] `[P0]` Nattjobbet och spegelimporten bara för grindkoden. Före 2026-09-15 kunde vem som helst med koden trigga dem; med konton hade varje användare kunnat skriva om spegeln.
- [x] `[P1]` Kontovy (`#/konto`, femte platsen i navigeringen) och integritetstext på inloggningen och under Konto.
- [x] `[P0]` **Patrik:** registrera en webbapp i Firebase-projektet `flaskor-d3762`, lägg `buildapp.se` under Authorized domains, klistra in `apiKey` och `appId` i `src/config.ts`. Migreringarna, Workern (`20fd7bc3`) och Pages är gjorda 2026-09-15; nycklarna inlagda och live samma dag kl. 16:30.
- [x] `[P1]` (roterad 2026-09-16 kl. 17:40, Worker `27a4d7cc`, verifierad 200/401; gamla `GATE_CODE` i Workern raderad kl. 17:50) **Patrik kör rotationen** (klassificeraren stoppar hemlighetsskrivning 2026-09-16, kommandot står i HANDOFF): sätt den nya `SERVICE_TOKEN` (Worker), `FLASKOR_SERVICE_TOKEN` (Actions) och `.dev.vars`, ta bort gamla `GATE_CODE` och `FLASKOR_GATE_CODE`, sedan Worker-deploy. Den har legat i två webbläsare och ger fortfarande hushåll 1.
- [x] `[P2]` (klar 2026-09-23: authhost på Firebase Hosting, CNAME DNS only, certifikat, båda konsollistorna plus JavaScript origin, `authDomain` bytt; live-popupen går till `flaskor.buildapp.se/__/auth/handler` och Google visar buildapp.se utan redirect-fel) Egen authDomain (`flaskor.buildapp.se`).
- [x] `[P2]` Dygnstak på skanningen per konto: `SCAN_DAILY` i `worker/src/index.ts`, 50 foton per konto och 1 200 totalt per dygn, räknat i `sb_meta` (`countScan`, granskningsbatchen 2026-09-16, test i `worker/test/scan.test.ts`). Punkten stod öppen av misstag till 2026-09-24.
- [x] `[P1]` Natten skriver bara ändrade rader, datumet högst en gång i veckan (`562f688`, 2026-09-24): D1-skrivkvoten före forumlänkarna.
- [x] `[P1]` Personuppgiftsansvarig och kontakt i integritetstexten (`6f1bc44`, 2026-09-24).
- [ ] `[P3]` Nattens `listAllDrinks` läser alla hushålls rader. Linjärt med användarna; tak eller uppdelning när det blir tusentals rader. Kandidat refuserad 2026-10-31: tak på 1 000 sorterat på `price_checked_at` låter rader som aldrig stämplas (egna flaskor, NULL först) tränga ut resten, och kräver migrering. Behövs inte förrän raderna är tusentals.

## Gästläge och export 2026-09-15

Patrik: "Jag vill att man ska kunna leka runt i appen och att det ska sparas i localdata, men dom som kräver databas-sync ska få en logga in med konto för att använda och förklaring." Plus export som JSON och CSV. Commits `c0df8e0` (Worker) och `891feea` (klient), Worker `a8d81a81`.

- [x] `[P1]` "Prova utan konto": allt som bara rör den egna listan sparas i `localStorage`, uppslag utan konto med tak per IP.
- [x] `[P1]` Lås med förklaring för skanning, lagersaldo, uppdatering och hushåll.
- [x] `[P1]` Påminnelser: rad överst, rad efter sparning (1, 5, 10 ...), jämförelse under Konto.
- [x] `[P1]` Lokala rader följer med till kontot vid inloggning, eller valet "lägg till eller släng" när kontot redan har rader.
- [x] `[P1]` Exportera JSON och CSV under Konto, för gäst och konto.
- [x] `[P2]` (byggt 2026-10-06 på gren: `parseExport` i `src/export.ts`, `importItems` i `src/local.ts`, knappen Importera JSON under Konto; enhetstester, och export, rensning och import körd i Chromium i gästläge. Kontovägen overifierad mot en riktig Worker) Importera en exporterad JSON-fil tillbaka (flytt mellan webbläsare utan konto, återställning). Lägger till, skriver aldrig över: samma fil två gånger ger dubbletter.
- [ ] `[P3]` Kontoimporten nekar en fil där en flaska har 40 eller fler avsmakningar (eller över 60 kB text): `POST /api/drinks/import` svarar inte med id:n, så resten av loggen kan inte skickas efteråt. Lös med id:n i svaret om någon stöter på det. Mistral-försök 2026-10-30 refuserat: skickar resten av loggen mot nya id:t, men ett fel mitt i den ger dubblett vid nytt försök, och 429 hanteras inte där.
- [ ] `[P3]` Uppladdningen till kontot är overifierad med en riktig inloggning: bitningen och Worker-routen är testade var för sig. Prova: lägg in en flaska som gäst, skapa konto, se att den finns kvar.

## Captured

- [x] `[P0]` Minus och plus i tabellens Antal-kolumn, minus före siffran och plus efter (2026-09-15), i Källaren och Barskåpet. Tryck på knapparna öppnar inte detaljvyn. Önskelistan har ingen Antal-kolumn.
- [x] `[P0]` Nya ikoner för minus och plus. Patrik 2026-09-15: "ikonerna är lösta".

## Granskning 2026-09-16

Fynd från cockpitens granskningskolumner (Lighthouse mobil, W3C, UX-skript, headers, TLS, OWASP). Mätvärdena står under `## Audits` i CONTEXT.md.

- [x] `[P2]` (rättad 2026-09-16, `7727340`: 200/4 000/500 tecken per fält, `readJson` med 64 KB, foto 3 MB, spegel 2 MB) OWASP A04, granskning 2026-09-16: inga längdtak på textfält i `sanitize` (`worker/src/db.ts`) och inget tak på kroppen före `request.json()` (`index.ts`). Ett verifierat konto kan fylla den delade D1-kvoten. Fix: tak per fält (namn 200, anteckning 4 000), avvisa content-length över 64 KB utom `/api/scan` (3 MB).
- [x] `[P3]` (rättad 2026-09-16, `2384e1f`, Worker `3cbae156`) Förstainloggningens race gav två hushåll per nytt konto, ett föräldralöst. Förloraren raderar nu sitt eget; hushåll 2 och 3 raderade i molnet.
- [x] `[P2]` (grenen borttagen 2026-09-16, `8d3e5dd`, Worker `8c940b75`, testet vänt till 404; rotationen kvar i P1 ovan) **2026-09-16 kl. 15:40: Patrik inloggad med Google och flyttad till hushåll 1 för hand** (`wrangler d1 execute`, en rad i `member`; kontot hade fått det tomma hushållet 2, som ligger kvar utan medlemmar). partnern är inte inloggad än, så grindkodsgrenen i `joinHousehold` är fortfarande hennes väg in i hushåll 1; rotationen är en secret och kräver ditt ja. Ordning: du och din partner loggar in, sedan rotera, sedan ta bort grenen. OWASP A04, granskning 2026-09-16: `GATE_CODE` gör tre jobb: full skrivning i hushåll 1, `POST /api/assortment` och `refresh-all`, plus inträde i hushåll 1 via `/api/household/join` (`household.ts`). Ligger i Actions-secret, `.dev.vars` och två webbläsares localStorage. Rotera (P1 finns redan), ta sedan bort grindkodsgrenen i `joinHousehold` när hushållet är medlemmar.
- [x] `[P2]` (rättad 2026-09-16, `countScan` i `sb_meta`, 50 per konto och 1 200 totalt per dygn, test, `7727340`) OWASP A04, granskning 2026-09-16: `SCAN_LIMIT` 10/min per uid utan dagstak (`index.ts`, `wrangler.jsonc`). Ett konto kan tömma Geminis fria nivå (~1 500/dag) på 2,5 h. Fix: dagsräknare per uid och globalt i `sb_meta`, neka över 50/uid/dag och 1 200/dag.
- [x] `[P3]` (rättade 2026-09-16, `7727340`, `c37dd79`, `32e7505`; SDK 12.19.0 sedan 2026-09-23, `14c15dd`, felaktig inloggning ger rätt fel lokalt, lyckad inloggning overifierad) OWASP, låga: 500-svar ekar `error.message` (`index.ts`); `sb_product_id` interpoleras rått i `stockUrl` (`stock.ts`), kräv `^\d+$`; CSV-export citerar inte inledande `= + - @` (`src/export.ts`); Caviste-hämtning utan `https:`-krav och med följda redirects (`caviste.ts`); localhost-origins i prod `FRONTEND_ORIGINS`; wrangler 4.129 (fix i 4.131) och Firebase SDK 11.6.1 mot 12.19.
- [x] `[P3]` (rättad 2026-09-16, `a89b5c4`: `.fl-textbtn` 44 px, gästknappen textknapp, `<main>` på grinden) UX, Fitts: "Nytt här? Skapa konto" och "Glömt lösenordet?" är 24 px på inloggningen. Von Restorff: två knappar med primärstil på samma vy. Lighthouse: inget `<main>`-landmärke.

## Mutation 2026-09-24

- [x] `[P3]` (rättad 2026-09-24, `SORT_VALUE.serve_temp` ger null för text utan siffror, test sett rött före) Sortering på serveringstemperatur blev oförutsägbar när en rad hade text utan siffror ("Rumstemperatur"): `parseInt` gav NaN och jämförelsen returnerade NaN. Flaggad av Antigravity som misstänkt bugg under mutation-lanen för `sort.ts`.

- [x] `[P2]` (rättad 2026-09-24, `num` kräver en siffra, test) Bulkimporten sparade pris 0 för ett pris utan siffror: `num("abc")` i `src/importParse.ts` rensar bort allt utom siffror och `Number("")` blir 0, så en AI-rad med `"pris":"okänt"` blir 0 kr i stället för tomt. Fix: returnera null när strängen saknar siffror, med ett test. Hittad när Antigravity skrev ett test som låste 0 som rätt svar (raden togs bort före commit).

## Ägar-QA, flyttad från Active Priorities 2026-09-16

Bara Patrik kan göra dessa: de kräver telefonen, riktiga flaskor eller ett öga på live-sidan. Flyttade hit från vaultens Active Priorities, som annars läses in i varje session i alla projekt.

- [ ] `[P1]` Prova minus och plus i tabellens Antal-kolumn live (`5da909c`, 2026-09-15).
- [ ] `[P1]` Läs Önskelistan live (tillgängligheten 2026-09-13): två rader ska säga "Ordervara · Slut hos leverantören", resten sitt sortiment plus "Finns hos Systembolaget".
- [ ] `[P1]` Skanningen, omgång två: matchningen rättad 2026-09-08 efter att första testet gav streckkod 2/3 och foto 0/3 (tolv riktiga flaskor ger nu 12/12 rätt bland kandidaterna). Skanna om samma flaskor som missade. Streckkod i kameran bara på Android; på iPhone läser AI:n siffrorna ur fotot.
- [ ] `[P1]` Prova Caviste-importen (klistra in en lådlänk i Lägg till, välj vinet) och drucken-loggen (blocket "Drucket" i detaljvyn). Anteckningen syns på raden i Källaren, sorteringen "Senast drucken" är flödet över allt druckt.
- [ ] `[P1]` Prova "Kolla lagret för alla" i Önskelistan med din butik vald: vad av det du vill ha finns i butiken just nu, med hyllplats.
- [ ] `[P1]` Prova lagersaldot och namnsöket: välj butik i en flaskas detaljvy och tryck Kolla lagret; skriv ett namn i Lägg till i stället för ett artikelnummer.
- [ ] `[P2]` Rätta tre Caviste-bildlänkar i Ändra (Chianti Classico, Côtes du Rhône, La Butte 'O'): Caviste förkortar dem `CC`, `CDR` och `CNP`. Adresserna står i `HANDOFF.md`. Övriga 18 rättades automatiskt 2026-09-09.
- [ ] `[P2]` Prova bulkimporten med en riktig Systembolagslista (Lägg till, "Importera en hel lista via din AI"), massåtgärderna i tabellen, Vivino-länk, ta bort, och barskåpet (18 sorter från Sipdeck, "Öppna en" på de öppnade). Installera på telefonen. Ja eller nej på §Val tagna åt Patrik i `HANDOFF.md`.
- Gästläget: uppladdningen vid riktig inloggning står redan som `[P3]` under §Gästläge och export.

## OWASP-granskning 2026-10-16

Kodgranskning av Gemini 4 Argon (High) genom agy i planläge, läsande export av
`a1fe068`, varje fynd kontrollerat mot koden av Claude. Ingen live-probe. Alla fynd
från 2026-09-16 kändes igen som rättade. `a1fe068` låg sex commits efter main; fynden
nedan är kontrollerade på `2437c73` (index.ts, household.ts och auth.ts oförändrade),
men JSON-importen under Konto (`d4d6f68`, `shared/sanitize.ts`) är ogranskad.

Rättat 2026-10-16 på grenen `fix/owasp-2026-10-16`, varje skydd prövat med en mutant som fäller testerna. Workern deployad 2026-10-17 (`2b9301db`) på Patriks klartecken.

- [x] `[P2]` (granskad 2026-10-16) JSON-importen (`d4d6f68`): allt går genom `sanitize` och servern kontrollerar igen, React escapar texten, 429-omförsöket är säkert eftersom både strypningen och dagstaket kastar före skrivningen. Inget fynd utöver `sb_product_id` nedan.
- [x] `[P2]` (2026-10-16) A04 skrivvägar: allt som inte är GET stryps per konto överst i `route` och räknas mot ett dagstak på 2 000 skrivningar per konto (`countWrite`, en import väger `IMPORT_WEIGHT_MAX`), och ett hushåll rymmer högst 2 000 rader (`HOUSEHOLD_DRINKS_MAX`). Avsmakningar har inget eget radtak; dagstaket begränsar dem.
- [x] `[P2]` (2026-10-16) A04 `countScan`: bilden valideras (`labelImage`) före räkningen, och kontots räknare kollas före den globala.
- [x] `[P3]` (2026-10-16) A01 `invite_code` byts när den använts och när någon lämnar ett hushåll som finns kvar. Att ta bort en medlem finns fortfarande inte.
- [x] `[P3]` (2026-10-16) A07 `signOutUser` tar bort `flaskor.drinks` och `flaskor.uid`.
- [x] `[P3]` (2026-10-16) A10/A04: `fetchProduct` kräver siffror, `sanitize` kräver siffror i `sb_product_id`, nattjobbet hoppar över icke-numeriska `source_id` och tar äldst kontrollerade först, Vivino-rader som felar stämplas så de prövas igen efter de andra. `source_id` valideras inte i `sanitize`: Caviste och manuella rader har andra format. Ordningen och omköandet testade 2026-10-17 (`6a5def9`, tre tester i `worker/test/api.test.ts`, var och en röd när sin rad tas bort; Vivino-mocken svarar 503 för vin 503).
- [x] `[P3]` (2026-10-16) `POST /api/assortment` kontrollerar identiteten före kroppen.
- [x] `[P3]` (2026-10-16) `GET /api/search`: högst 100 tecken, `searchMirror` högst 8 termer.
- [x] `[P3]` (2026-10-16, SRI 2026-10-17) Lågt: `nosniff` från API:t; spegeldumpens id:n måste vara siffror och texten kapas vid 1 000 tecken. SRI på Firebase-SDK:n (`c26ddb8`): den laddas med dynamisk import från en versionsmärkt gstatic-adress, och import-mappens `integrity` i `index.html` bär sha384 för `firebase-app.js` och `firebase-auth.js` (räknade ur filerna). `crossorigin` behövs inte: moduler hämtas alltid med CORS, och gstatic svarar `*`. Verifierat i Chromium mot byggd `dist`: rätt hash laddar SDK:n, en ändrad hash nekas ("Failed to find a valid digest"). `test/sri.test.ts` fäller om `src/auth.ts` byter version utan ny hash. Webbläsare utan stöd för import-mappens `integrity` laddar som förut.
- [x] `[P3]` (deployad 2026-10-17, headern syns på `flaskor-d3762.web.app`) `nosniff` i `authhost/firebase.json` till Firebase Hosting.
- [x] (rättad 2026-10-30) `[P3]` Nattjobbet (2026-10-17): en Systembolagsrad vars sida felar tillfälligt (5xx, inte i spegeln) stämplas inte, så den står kvar äldst och tar en av de 50 sidhämtningarna först varje natt. 404 stämplas och hamnar sist. Effekt i dag: en sida per sådant nummer. Rättning kräver ett val: bakdaterad stämpel som Vivino (men `price_checked_at` visas som "Kollat") eller en egen kolumn.

## Beroenden 2026-10-17

- [ ] `[P3]` vitest 5: stannar på 4.1.12, eftersom `@cloudflare/vitest-pool-workers` 0.23.0 (senaste) kräver `vitest ^4.1.0`. Uppgradera när pool-workers stöder 5.
- [ ] `[P3]` `overrides` i `package.json` pekar pool-workers wrangler och miniflare på samma versioner som roten (pool-workers 0.23 låser sårbara sharp och undici). Höj overriden när wrangler höjs, ta bort den när pool-workers själv låser en fixad miniflare. 2026-11-04: höjd till wrangler 4.153.0 och miniflare 5.20261023.0-beta, plus zod 4.6.7 (pool-workers låser 4.4.3, hög). 2026-11-17: roten höjd till wrangler 4.164.0, men overriden stannar på 4.153.0: miniflare 5.20261117.0-beta saknar `getNodeCompat`, som pool-workers 0.23 importerar, och `test:worker` startar inte.
- [ ] `[P2]` `npm audit` 2026-11-17: 13 high och 2 moderate, alla i dev- och byggkedjan. De höga är en och samma advisory: picomatch <=4.0.7 (ReDoS) via vite, vitest, tinyglobby, @vitejs/plugin-react, pool-workers och vite-plugin-pwa; 4.0.7 är senaste versionen, ingen fix publicerad, och npm föreslår bara nedgraderingar. De måttliga: glob och minimatch under `workbox-build`. Kör `npm audit fix` igen när picomatch 4.0.8 finns. Kollat 2026-11-24: picomatch senast 4.0.7, pool-workers senast 0.23.0, oförändrat.

## Git history 2026-10-22

Unika tillagda rader i 154 commits granskade av Gemini 4 Argon (`tools/history-lane.mjs` i aifabriken, 712 s, 507 000 tokens), stickprov kontrollerade av Claude med `git grep` och `git log -G`. Repot är publikt. Inga lösenord, nycklar, telefonnummer eller privata adresser.

- [x] `[P2]` (rensat 2026-10-22 efter ägarens beslut: `git-filter-repo` på alla grenar, force-push av `main` och `feat/sipdeck-koppling`; nås fortfarande via GitHubs PR-referenser tills GitHub Support rensar dem. Hushållsnamnet i produktionsdatabasen är orört) **Ägaren:** ett hushållsmedlems förnamn står i 11 nuvarande filer (bland annat `worker/migrations/0001_init.sql` som hushållsnamn, `CONTEXT.md`, `HANDOFF.md`, `BACKLOG.md`, designfilerna) och i 32 commits. Välj: acceptera, eller rensa filerna och skriv om historiken (`git-filter-repo`, force-push av publikt repo; `main` kräver att force-push slås på tillfälligt i grenregeln). Hushållsnamnet i produktionsdatabasen påverkas inte av en ändring i migreringsfilen.
- Accepterat: ägarens namn och ort (står redan i integritetstexten som personuppgiftsansvarig), Systembolagsbutiken i testdata (offentlig adress), `patrik@example.com` i test, vinlistans värde i två gamla docs, `buildapp-se`, Firebase webbnyckel.

## Backlogrunda 2026-11-04

- [x] `[P3]` (rättad 2026-11-04, PR #4) Detaljvyn med Ändra öppen saknade h1: rubriken står kvar ovanför formuläret.
- [x] `[P3]` (rättad 2026-11-04, PR #4) Köpt-arket i Önskelistan: prisrutan gick utanför arket på 390 px.
- [x] `[P3]` (rättad 2026-11-04, PR #4) Plus och minus i Köpt-arket och Barskåpet hade namnen "−" och "+".

## Sweep 2026-11-24

- [x] `[P2]` (rättad 2026-11-24, `7a9bc54`) En bildlänk som svarar 404 även efter bytet webp till png, eller en egen bildlänk som inte finns, visade en trasig bildruta i listan och detaljvyn. `Bottle` visar nu designens platshållare. Verifierat i Chromium mot byggd `dist` i gästläge på 390 px: tre rader (egen 404, Systembolags-webp som saknas, hel bild) gav en bild och två platshållare; samma kontroll före ändringen gav tre `<img>` varav två trasiga.

## OWASP review, 2026-11-24

Kodgranskning av Gemini 4 Neon High på `33f7020`, varje fynd kontrollerat av Claude mot `origin/main` (`20bc9c4`, samma Worker-kod). Ingen live-probe. Rättat på grenen `owasp/2026-11-24`, varje nytt test rött mot koden före rättningen.

- [x] `[P2]` (rättad 2026-11-24) A04 läsningar: alla inloggade anrop stryps nu per konto (60 i minuten), GET också, och `DELETE /api/sipdeck/link` har fått samma tak. Förut ströps GET bara för uppslagen längst ned i `route`, så `/api/drinks` och `/api/export` gick att köra utan tak.
- [ ] `[P2]` A04 läskvoten, kvar efter strypningen (medel): ett konto med 2 000 rader läser cirka 4 000 rader per `/api/drinks` eller `/api/export`, och 60 anrop i minuten tömmer kontots 5 miljoner lästa rader per dygn på runt 20 minuter, för Sipdeck också. Avsmakningar har inget radtak (dagstaket på skrivningar begränsar dem per dygn, inte totalt). **Patrik:** välj ett dagstak på lästa rader per konto, som `countWrite` för skrivningar (förslag: 200 000 rader, 4 % av dygnet, räknat på returnerade rader i lista, export och Sipdecks flasklista; kostar en skriven rad per sådant anrop), och om avsmakningar ska få ett tak per hushåll. Ett tak per konto hindrar inte den som skapar många konton.
- [x] `[P3]` (rättad 2026-11-24) A04 nattjobbet: hushållen turas om i nattens kö (`fairOrder` i `worker/src/index.ts`), så ett hushåll med 50 aldrig kollade rader inte tar taket för Systembolagssidor eller Vivino från alla andra. `price_checked_at` och `vivino_checked_at` får fortfarande skrivas från klienten: exportfilen bär dem, och med turordningen ger de inget försprång utöver det egna hushållets tur. Neon kallade det medel; effekten är att andras priser uppdateras senare, och spegeln täcker de flesta rader utan tak, så lågt.
- [ ] `[P3]` Nattjobbet läser spegeln och skriver raderna ett nummer i taget (`mirroredFresh` och `updateDrink` i en slinga): 2 000 rader ger upp till 4 000 D1-anrop i en körning. Begränsat av `HOUSEHOLD_DRINKS_MAX` per hushåll och av att en rad bara skrivs när något ändrats eller stämpeln är äldre än 7 dagar. Samma tak som `ponytail`-kommentaren i `refreshAll`: batcha när hushållen blir fler.
- [x] `[P3]` (rättad 2026-11-24) A01 inbjudningskoden byts villkorat (`UPDATE ... WHERE invite_code = ? RETURNING id`) innan medlemmen flyttas: av två samtidiga inträden med samma kod vinner ett.
- [x] `[P3]` (rättad 2026-11-24) A10 `parseCavisteUrl` tar bara `caviste.se` och `www.caviste.se`, utan port eller inloggning, och skickar vidare bara sökvägen (fråga och fragment bort). Routen är öppen utan konto.
- [x] `[P3]` (rättad 2026-11-24) A07 `deleteFirebaseUser` rensar `flaskor.drinks` och `flaskor.uid` som utloggningen gör.
- [x] `[P3]` (rättad 2026-11-24) A05 ett 4xx från Gemini loggas, klienten får bara `gemini answered <status>`.
- [x] `[P3]` (rättad 2026-11-24) A08 `scripts/assortment.ts` avbryter en dump över 60 000 rader och en körning över 10 000 ändrade rader (10 % av dygnets skrivkvot); resten tas nästa natt, spegeln stämplas inte färsk den natten.
- [ ] `[P3]` A05 delat ursprung: Flaskor och syskonapparna delar `https://buildapp.se`, så ett XSS-hål i en annan app där når Flaskors `localStorage`, Firebase-token och API:t. **Patrik:** egen underdomän för Flaskor (till exempel `flaskor.buildapp.se`) och `FRONTEND_ORIGINS` snävat till den, eller acceptera. Kräver ny Pages-värd, Firebase-domän och CORS.
- Avfärdat: `Cache-Control: no-store` saknas på API-svaren. Svaren saknar `Last-Modified` och `Expires` och får alltså ingen heuristisk cache, och delade cachar får inte lagra svar på anrop med `Authorization` (RFC 9111 §3.5).

## UX-audit 2026-11-24

`ux-checks.mjs --interact` i gästläge mot `vite` på 390 px, sex vyer, plus skärmbilder på 390 och 1 440 px. Fem av åtta skriptkontroller gröna före, sex efter.

- [x] `[P2]` (rättad 2026-11-24, `11fdcce`) `#/importera`: det inklistrade AI-svaret försvann vid omladdning (Zeigarnik). Utkastet sparas nu med `usePersisted` och töms när importen sparats; utloggningen tar bort det. På vägen hittad rotorsak: `usePersisted` skrev `localStorage` inuti en state-uppdatering, som aldrig körs om komponenten avmonteras samma tick (Importera tömmer och navigerar bort), så utkastet låg kvar. Skrivningen sker nu direkt; test rött före. Verifierat i Chromium: utkastet kvar efter omladdning, tomt efter sparad import, raden sparad.
- [x] `[P3]` (rättad 2026-11-24, `f404ae1`) Tomlägen: Källaren sa "via Systembolagets artikelnummer" fast Lägg till tar namn, länk och foto; Barskåpet sa bara "Inget i barskåpet." Båda säger nu vad man gör.
- [ ] `[P3]` **Patrik, design:** Fitts varnar (ingen fail, WCAG 2.5.8 klaras) på 34 till 36 px höga chips, sortering och Lista/Tabell i Källaren, Önskelistan och Barskåpet, Vin/Sprit/Öl i Lägg till, samt 20 px höga textlänkar ("Importera en hel lista via din AI" i Lägg till, "Integritet" under Konto, "Skapa konto" i gästremsan). Att höja dem till 44 px ändrar designens täthet; säg till om det ska göras.
- Mutationstest samma dag på Workerns parsers, aldrig mätta förut (Stryker 10, bara testfiler): caviste 45,85 till 93,36 %, systembolaget 58,50 till 86,56 %, vivino 59,17 till 85,80 %. Ingen bugg. Kvar i vivino är landstabellen, typtabellen, feltexter och huvuden, plus 13 likvärdiga mutanter. Värdena står på Mutation-raden i CONTEXT.
- Inte fynd, skriptet har fel: sökrutans `<input>` mäts till 25 px men hela `<label class="fl-search">` (44 px) fokuserar den; Von Restorff räknar gästremsans understrukna textknapp `fl-guestbar__cta` som primär på grund av klassnamnet. `#/lagg-till`-rutans text överlever inte omladdning: det är en uppslagsruta, inte ett utkast, och `#/lagg-till?q=` täcker länkad förifyllning.

## Funktionspass 2026-11-24

Inga öppna P0 till P2 som en agent kan bygga ensam (samma läge som sweepen och djuppasset samma dag). Fynden nedan kom ur en genomgång av inmatningsfälten i gästläge.

- [x] `[P1]` (rättad 2026-11-24, `69c4cc0`) Ett pris skrivet "1 299" i Ändra eller i Köpt-arket blev `NaN`: detaljvyn visade "NaN kr" och raden sparades utan pris. Samma sak för all text i sifferfälten. `parseDecimal` i `src/format.ts` tar mellanslag, hårt mellanslag, decimalkomma och "kr"/"%"; något annat stoppar sparningen med "Skriv ett tal, till exempel 1 299 eller 13,5." (Ändra: webbläsarens felruta på fältet; Köpt: knappen grå och texten under). Fälten förifylls med decimalkomma ("13,5", inte "13.5"). Gäller även Skriv in själv i Lägg till, som använder samma formulär. Verifierat i Chromium mot `vite` i gästläge: före rättningen gav "1 299" "NaN kr" och `price_paid` null; efter: "ett par hundra" stoppas med texten, "1 299" sparar 1299 och visar "1 299 kr", Köpt-arket förifyller "129,9", "1 2a" ger grå knapp, "1 149,50 kr" sparar 1149,5. Enhetstester i `src/format.test.ts`.
- [x] `[P2]` (rättad 2026-11-24, `7ece57e`) Pages-bygget föll ibland med "No artifacts named github-pages" eller "count is 2". Deploy i eget jobb efter bygget och `upload-pages-artifact` v4, samma struktur som investeringar `85358bc`.
- [x] `[P3]` (rättad 2026-11-24, `eee2afa`) Workertestet "läsningarna stryps också per konto" föll en gång i `npm run check` och gick grönt vid omkörning. Strypningen räknar i 60-sekundersfönster; testet kör nu tills det får 429, högst 125 anrop. Rött när `throttle` kommenteras bort. Att fönstergränsen var orsaken är troligt, inte bevisat.

## Användarjakt 2026-11-24

Gästläget genomgånget i Chromium mot `vite` på 390 och 1 440 px: Skriv in själv (vin, sprit, öl), Önskelistan och Köpt, Barskåpet, Källaren i lista och tabell, sök utan träff, Lägg till med nedlagd server, Konto, bakåtknapp och omladdning. Reproduktionsskripten (`toast.mjs`, `wish.mjs`, `limits.mjs`) föll före rättningen och gick gröna efter, på båda bredderna.

- [x] `[P2]` (rättad 2026-11-24, `ff28582`) Gästens påminnelse efter sparning ("Sparat i den här webbläsaren ...") låg på en rad: på 390 px klipptes texten och Skapa konto och stängknappen hamnade utanför skärmen. Texten bryts nu, knapparna inte.
- [x] `[P1]` (rättad 2026-11-24, `e1e30b2`) Köpt-arket förifyllde bara dagspriset, så en egen rad på Önskelistan (Skriv in själv, Vivino) med pris 349 fick tom prisruta och sparades utan inköpspris. Arket förifyller nu samma pris som raden visar. Raden slutade dessutom på "349 kr ·" när källa och nummer saknas.
- [x] `[P2]` (rättad 2026-11-24, `4dce6a4`) Sifferfälten tog negativa tal ("-50" gav "-50 kr" i Barskåpet); nu stoppas de med samma text som annan felskrivning, test i `src/format.test.ts`. Textfälten i Ändra och Skriv in själv och avsmakningens anteckning har serverns tak (`maxLength` ur `shared/sanitize.ts`): gästen sparade ett namn på 287 tecken som servern nekar med 400. Kontovägen (400 vid sparning, uppladdningen från gäst) inte testat.

## Användarjakt 2, 2026-11-24

Det jakt 1 inte gick, i gästläge i Chromium mot `vite` på 390 och 1 440 px: alla routes med påhittade rader (även `#/flaska/999` och en okänd adress), tomlägen i en ny webbläsare, inloggningskortet, Konto med JSON- och CSV-export, Rensa lokal data i två tryck, import av samma JSON tillbaka och av en felaktig fil, massborttagning med Ångra i tabellen, Ta bort i detaljvyn, och andra besöket utan nät mot byggd `dist` (service workern laddar alla vyer, söket säger "Systembolaget svarade inte"). Länkar: buildapp.se/flaskor, OG-bilden, manifest och ikoner, Sipdeck, Firebase-SDK:n, `/health`, buildapp.se/integritet och en Systembolagsprodukt svarar 200. Distiller och Vivinos söksida svarar 403 mot skript (Cloudflare- och CloudFront-skydd), i en riktig webbläsare inte testat.

- [x] `[P2]` (rättad 2026-11-24) Karaffering 1,5 timmar visades "1.5 timmar" i detaljvyn, "1.5" i Ändra och i tabellens kolumn Karaff. Vivinos röster visades "1200 röster" och "(1200)". Nu "1,5 timmar", "1,5", "1 200 röster" och "(1 200)". Test i `src/format.test.ts`, rött före rättningen. Verifierat i Chromium på 390 och 1 440 px: Ändra förifyller "1,5" och sparar 1.5 oförändrat.
- [x] `[P3]` (rättad 2026-11-24) CSV-exportens kolumn Källa skrev `manual`, `systembolaget` och `caviste`; nu Egen, Systembolaget och Caviste, som kolumnen Typ redan översätts. Sett i den nedladdade filen.
- [x] `[P3]` (rättad 2026-11-24) `#/flaska/<okänt id>` (gammalt bokmärke, borttagen rad) visade bara en grå rad utan rubrik; nu h1 "Flaskan finns inte.".

## Fart och tillgänglighet 2026-11-25

Mätt med headless Chromium (`measure.mjs` i lanens temp-mapp) på åtta vyer i gästläge med påhittade rader (inloggningen, Källaren, Önskelistan, Barskåpet, Lägg till, Importera, Konto, detaljvyn), på 390 px med 4x CPU och Slow 4G (150 ms, 1,6 Mbit/s) och på 1 440 px utan strypning, live på buildapp.se/flaskor före och efter deployen. axe-core 4.14.0 (WCAG 2.2 AA plus best practice): 0 fel på alla 16 före och efter.

- [x] `[P2]` (rättad 2026-11-25, `f877b57`) Layoutskifte när Google Fonts byter in Work Sans och Instrument Serif: gästremsans Skapa konto bröts till ny rad och allt under flyttades. CLS på mobil upp till 0,237 live (detaljvyn) och 0,19 till 0,24 på sex vyer lokalt, beroende på om typsnitten hann före appen. Reservtypsnitt med webbtypsnittens mått (`size-adjust` mätt i Chromium mot Arial och Times New Roman) i `src/tokens.css`, och gästens rader läses vid första renderingen i stället för efter en "Laddar"-ruta. Efter: CLS högst 0,0001 på alla 16 live. Android saknar Arial och Times New Roman lokalt och får det gamla beteendet.
- [x] `[P2]` (rättad 2026-11-25, `0850ace`) Appen ritar inget förrän Firebase-SDK:n laddats, och den hämtades först när bundeln körts. `modulepreload` med samma SRI-hash som import-mappen i `index.html` (`test/sri.test.ts` fäller om de skiljer), och `registerSW.js` med `defer` i stället för renderingsblockerande. LCP mobil live 1 928 till 2 172 ms före, 1 608 till 1 836 ms efter; 1 440 px 216 till 248 ms före, 176 till 212 ms efter. Renderingsblockerande resurser 3 till 2.
- [x] `[P3]` (rättad 2026-11-25, `0850ace`) Service workern förcachade OG-bilden (74 kB) som appen aldrig visar: förcachen 504 till 431 KiB.
- [x] `[P3]` (rättad 2026-11-25, `ca96d30`) Sidtiteln var "Flaskor" i varje vy; nu "Källaren · Flaskor" och så vidare, flaskans namn i detaljvyn. Sett live på alla åtta.
- [ ] `[P3]` Hashade filer under `/flaskor/assets/` svarar `Cache-Control: max-age=14400` (fyra timmar) trots unikt namn. Sätts av GitHub Pages och zonen buildapp.se, inte av repot; en Cache Rule för `/flaskor/assets/*` med ett års livslängd är en zoninställning för hela buildapp.se. **Patrik:** vill du ha den? Effekten är liten: service workern cachar skalet efter första besöket.
- Inte ändrat: flaskfotona kommer från Systembolagets CDN i 200 px (visas 32 till 50 px, redan `loading="lazy"` och storleksatta i CSS). Metadata: `lang="sv"`, beskrivning, OG-bild, favicon och manifest finns; ingen canonical, sidan är `noindex` och har en adress.

## Scenariojakt 2026-11-25

Flerstegsscenarier i gästläge i headless Chromium mot `vite` och mot byggd `dist` (skripten `s1` till `s6` i lanens temp-mapp `scen-flaskor`), 390 och 1 440 px: en vecka komprimerad (Drack en, Ändra, massborttagning med Ångra, Ta bort, gammal adress), två flikar på samma rad, 600 rader med 400 avsmakningar, export, rensning, import och återimport, uppgradering från gårdagens bygge (`4522668`) med service worker och sparat läge, och breddbyte mitt i Ändra, tabellmarkering och Skriv in själv. Varje rättning nedan föll i sitt skript före och gick grön efter.

- [x] `[P1]` (rättad 2026-11-25, `14d17e5`) Ångra efter Ta bort i tabellen gav tillbaka raderna utan drucken-logg: Barolo med två avsmakningar kom tillbaka med 0, och detaljvyn visade ingen logg. Loggen läses nu före borttagningen (`restorable` i `src/local.ts`) och ångringen går genom `importItems`, för gäst och konto. Mot kontot kapas loggen till 39 avsmakningar per rad, annars nekar importen hela ångringen. Tester i `src/local.test.ts`. Kontovägen inte provad mot en riktig Worker.
- [x] `[P2]` (rättad 2026-11-25, `2046a92`) Massåtgärderna ritade om hela tabellen en gång per rad: Ta bort på 200 markerade rader tog 10,3 s och Lägg på önskelistan igen 19,7 s (Ångra lika länge), 600 rader hängde sidan över 30 s. Nu en rendering för hela markeringen (`remove` tar flera id:n, `patchMany`): 200 rader 0,3 s och 0,2 s, 600 rader 1,8 till 1,9 s och 2,1 till 2,5 s. Inget enhetstest: repot har ingen testmiljö för `StoreProvider`; skriptet `s3-volume.mjs` är kontrollen.
- [x] `[P1]` (rättad 2026-11-25, `fee6e2d`) Ett nytt bygge nådde inte användare med appen öppen: `registerSW.js` skickar inget `SKIP_WAITING` och sw.js hade varken `skipWaiting` eller `clientsClaim`, så nya workern låg som `waiting` tills varje flik och den installerade appen stängts helt; omladdning gav gårdagens skal, också utan nät. Nu tar den över vid nästa öppning (en bundel, inga lata delar som kan saknas). Sparat filter, tabellvy, kolumner, importutkast och rader överlever uppgraderingen. Sidan laddas inte om under användaren.
- [x] `[P3]` (gjort 2026-11-25, `24044bb`) Typsnitten ligger i bundeln (`src/fonts/`, Googles egna woff2-filer och `unicode-range`, latin och latin-ext) i stället för Google Fonts. Ingen CSP-ändring behövdes: zonens CSP live är `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. Mätt med `measure.mjs` mot byggd `dist` lokalt med gzip, åtta vyer, två körningar: renderingsblockerande resurser 2 till 1, anrop 10 till 8, 1 440 px LCP median 204 till 138 ms (164 till 244 före, 104 till 208 efter), 390 px 4x CPU Slow 4G oförändrad (median 1 710 och 1 696 ms), CLS högst 0,0005 före och 0 efter, axe 0 på alla. Inga IP-adresser till Google för typsnitten. Förcachen 431 till 511 KiB (latin-ext hämtas när den behövs och förcachas inte); typsnitten hämtades förut ändå vid första besöket.
- Inte fynd: två flikar som ändrar samma rad (Ändra i den ena, Drack en i den andra) behåller båda ändringarna, en rad borttagen i den andra fliken återuppstår inte, och nya rader från båda får unika id:n. Breddbyte behåller formulärtext och markering, ingen sidscroll i sju vyer på 390 px. Export, rensning och import ger samma fält och avsmakningar.
- Inte provat: en utgången session mitt i Ändra. Den kräver ett riktigt Firebase-konto (gästläget har ingen session).

