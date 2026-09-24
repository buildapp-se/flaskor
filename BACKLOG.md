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
- [x] `[P1]` Barskåpet från Sipdecks skafferi (36): 18 sorter seedade i molnet 2026-09-06 med `npm run seed:bar` (`seed/barskap.tsv`, skript mot API:t, hoppar över namn som redan finns).
- [x] `[P1]` Lägg till från Vivino-länk (38): producent, namn, typ, region, land, druvor, alkohol, bild, betyg och mat ur vinsidan, årgång ur `?year=`.
- [x] `[P1]` Skriv in själv (39): formuläret från Ändra i Lägg till, vin eller sprit, sedan samma förhandsvisning och sparknappar.
- [x] `[P1]` Bulkimport via egen AI (40): "Importera lista" under Lägg till, prompt att kopiera, JSON klistras in, artikelnummer slås upp hos Systembolaget, granskningstabell med mål och antal per rad, ångra i tio minuter. Kryssrutor i tabellvyn med Ta bort och Lägg på önskelistan igen, båda med ångra.
- [x] `[P1]` Tabellen döljer viner med noll flaskor tills "Visa slut" trycks (42), så en sökning på "skaldjur" bara ger det som finns hemma.
- [x] `[P2]` Sorteringen flyttad bredvid sökrutan, Lista/Tabell längst till höger på samma rad (43).
- [x] `[P1]` Streckkod eller etikett för att lägga till (37, byggd 2026-09-08 på Patriks begäran, beslut 15 återöppnat): EAN-källan dök upp (Open Food Facts) och etikettläsningen blev billig (Gemini Flash-Lite på gratisnivån). Foto eller streckkod ger en gissning, Systembolagets sök ger tre kandidater att välja bland, sedan hela raden med pris och bakgrund som vanligt.
- [x] `[P3]` Lager i vald butik: byggt 2026-09-09. Blockeringen föll när nyckeln kom in i repot för skanningen 2026-09-08, den behövde aldrig grävas ur deras bundle. Svaret ger både saldo och hyllplats.

## Efter första molndeployen

- [ ] `[P1]` Verifiera live som användare: logga in på https://buildapp.se/flaskor, lägg till ett Systembolagsvin, PWA-installation på Patriks och Julias telefoner. (D1, Worker, secret, Pages och seed gjorda 2026-09-05; grinden ger 401 på fel kod.) **Cronen är avbockad 2026-09-09**: 19 rader i molnet bär `price_checked_at` 2026-09-09 kl. 04:00 och 04:01 svensk tid (02:00 UTC), vilket är exakt schemat `0 2 * * *`. Beslut 23 är därmed inte längre overifierat i molnet.
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
- [ ] `[P2]` Sipdeck-synk: mappa barskåpsrad till Sipdecks ingrediens-id, knapp som skriver eget skafferi via Sipdecks Worker (beslut 7).
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
- [x] `[P2]` FTS5 i spegeln i stället för LIKE, byggd 2026-09-15 (migrering 0009, cirka 300 skuggrader). Fyllningen kostar cirka 27 000 skrivna rader en gång, se `HANDOFF.md` §Nästa steg. Gratisplanens D1-kvot är 5 miljoner lästa rader per dygn för hela kontot, och LIKE läser alla 27 035 rader per fråga: 185 reservsökningar på ett dygn tömmer kvoten. FTS5 (som D1 stöder) läser bara träffarna. Blir akut först när reserven används på riktigt, alltså när nyckeln dör eller lasten ger 429.
- [x] `[P3]` Rate Limiting-bindningen per användare, byggd 2026-09-15 (`SCAN_LIMIT` 10/min, `LOOKUP_LIMIT` 60/min per konto).

## Tillgänglighet 2026-09-13

Patrik: "Tillfälligt slut i butiken" i Önskelistan går inte att tolka. Utredningen visade fel data: dumpens `isTemporaryOutOfStock` är true på varje rad, så natten satte `temporarily_out` på alla 19 Systembolagsrader.

- [x] `[P1]` Spegeln ignorerar dumpens `isTemporaryOutOfStock`; `sb_assortment` (sortimentskoden) på raden; `availability` vidgad med `supplier_out` och `sold_out`; Önskelistan skriver "sortiment · status" ("Ordervara · Slut hos leverantören", "Fast sortiment · Finns hos Systembolaget", "Slutsåld", "Utgått ur sortimentet"). Migrering 0007 bygger om `drink` och `tasting`. Commit `7fa58a7`.
- [x] `[P1]` Migrering 0007 körd i molnet av Patrik 2026-09-13, Worker `be3892f7`, spegeln körd om, refresh-all 19 av 19. På vägen: `DUMP_FIELDS` saknade `assortment` och `isSupplierTemporaryNotAvailable` så första spegelkörningen gav null; fix `c2258fa` med test genom `slim`.
- [ ] `[P3]` Samma text i detaljvyn. I dag visas tillgängligheten bara i Önskelistan.

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
- [ ] `[P3]` Nattens `listAllDrinks` läser alla hushålls rader. Linjärt med användarna; tak eller uppdelning när det blir tusentals rader.

## Gästläge och export 2026-09-15

Patrik: "Jag vill att man ska kunna leka runt i appen och att det ska sparas i localdata, men dom som kräver databas-sync ska få en logga in med konto för att använda och förklaring." Plus export som JSON och CSV. Commits `c0df8e0` (Worker) och `891feea` (klient), Worker `a8d81a81`.

- [x] `[P1]` "Prova utan konto": allt som bara rör den egna listan sparas i `localStorage`, uppslag utan konto med tak per IP.
- [x] `[P1]` Lås med förklaring för skanning, lagersaldo, uppdatering och hushåll.
- [x] `[P1]` Påminnelser: rad överst, rad efter sparning (1, 5, 10 ...), jämförelse under Konto.
- [x] `[P1]` Lokala rader följer med till kontot vid inloggning, eller valet "lägg till eller släng" när kontot redan har rader.
- [x] `[P1]` Exportera JSON och CSV under Konto, för gäst och konto.
- [ ] `[P2]` Importera en exporterad JSON-fil tillbaka (flytt mellan webbläsare utan konto, återställning).
- [ ] `[P3]` Uppladdningen till kontot är overifierad med en riktig inloggning: bitningen och Worker-routen är testade var för sig. Prova: lägg in en flaska som gäst, skapa konto, se att den finns kvar.

## Captured

- [x] `[P0]` Minus och plus i tabellens Antal-kolumn, minus före siffran och plus efter (2026-09-15), i Källaren och Barskåpet. Tryck på knapparna öppnar inte detaljvyn. Önskelistan har ingen Antal-kolumn.
- [x] `[P0]` Nya ikoner för minus och plus. Patrik 2026-09-15: "ikonerna är lösta".

## Granskning 2026-09-16

Fynd från cockpitens granskningskolumner (Lighthouse mobil, W3C, UX-skript, headers, TLS, OWASP). Mätvärdena står under `## Audits` i CONTEXT.md.

- [x] `[P2]` (rättad 2026-09-16, `7727340`: 200/4 000/500 tecken per fält, `readJson` med 64 KB, foto 3 MB, spegel 2 MB) OWASP A04, granskning 2026-09-16: inga längdtak på textfält i `sanitize` (`worker/src/db.ts`) och inget tak på kroppen före `request.json()` (`index.ts`). Ett verifierat konto kan fylla den delade D1-kvoten. Fix: tak per fält (namn 200, anteckning 4 000), avvisa content-length över 64 KB utom `/api/scan` (3 MB).
- [x] `[P3]` (rättad 2026-09-16, `2384e1f`, Worker `3cbae156`) Förstainloggningens race gav två hushåll per nytt konto, ett föräldralöst. Förloraren raderar nu sitt eget; hushåll 2 och 3 raderade i molnet.
- [x] `[P2]` (grenen borttagen 2026-09-16, `8d3e5dd`, Worker `8c940b75`, testet vänt till 404; rotationen kvar i P1 ovan) **2026-09-16 kl. 15:40: Patrik inloggad med Google och flyttad till hushåll 1 för hand** (`wrangler d1 execute`, en rad i `member`; kontot hade fått det tomma hushållet 2, som ligger kvar utan medlemmar). Julia är inte inloggad än, så grindkodsgrenen i `joinHousehold` är fortfarande hennes väg in i hushåll 1; rotationen är en secret och kräver ditt ja. Ordning: du och Julia loggar in, sedan rotera, sedan ta bort grenen. OWASP A04, granskning 2026-09-16: `GATE_CODE` gör tre jobb: full skrivning i hushåll 1, `POST /api/assortment` och `refresh-all`, plus inträde i hushåll 1 via `/api/household/join` (`household.ts`). Ligger i Actions-secret, `.dev.vars` och två webbläsares localStorage. Rotera (P1 finns redan), ta sedan bort grindkodsgrenen i `joinHousehold` när Patrik och Julia är medlemmar.
- [x] `[P2]` (rättad 2026-09-16, `countScan` i `sb_meta`, 50 per konto och 1 200 totalt per dygn, test, `7727340`) OWASP A04, granskning 2026-09-16: `SCAN_LIMIT` 10/min per uid utan dagstak (`index.ts`, `wrangler.jsonc`). Ett konto kan tömma Geminis fria nivå (~1 500/dag) på 2,5 h. Fix: dagsräknare per uid och globalt i `sb_meta`, neka över 50/uid/dag och 1 200/dag.
- [x] `[P3]` (rättade 2026-09-16, `7727340`, `c37dd79`, `32e7505`; SDK 12.19.0 sedan 2026-09-23, `14c15dd`, felaktig inloggning ger rätt fel lokalt, lyckad inloggning overifierad) OWASP, låga: 500-svar ekar `error.message` (`index.ts`); `sb_product_id` interpoleras rått i `stockUrl` (`stock.ts`), kräv `^\d+$`; CSV-export citerar inte inledande `= + - @` (`src/export.ts`); Caviste-hämtning utan `https:`-krav och med följda redirects (`caviste.ts`); localhost-origins i prod `FRONTEND_ORIGINS`; wrangler 4.129 (fix i 4.131) och Firebase SDK 11.6.1 mot 12.19.
- [x] `[P3]` (rättad 2026-09-16, `a89b5c4`: `.fl-textbtn` 44 px, gästknappen textknapp, `<main>` på grinden) UX, Fitts: "Nytt här? Skapa konto" och "Glömt lösenordet?" är 24 px på inloggningen. Von Restorff: två knappar med primärstil på samma vy. Lighthouse: inget `<main>`-landmärke.

## Mutation 2026-09-24

- [ ] `[P2]` Bulkimporten sparar pris 0 för ett pris utan siffror: `num("abc")` i `src/importParse.ts` rensar bort allt utom siffror och `Number("")` blir 0, så en AI-rad med `"pris":"okänt"` blir 0 kr i stället för tomt. Fix: returnera null när strängen saknar siffror, med ett test. Hittad när Antigravity skrev ett test som låste 0 som rätt svar (raden togs bort före commit).

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
