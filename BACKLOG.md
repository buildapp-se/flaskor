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
- [ ] `[P2]` Grindkoden ligger i localStorage i klartext på delad dator; räcker tills Firebase Auth (beslut 2).
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

- [ ] `[P2]` Firebase Auth som Beefcake, användare kopplade till `household_id` (beslut 2).
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
- [ ] `[P1]` **Patrik:** Actions-hemligheten `FLASKOR_GATE_CODE` (grindkoden) i repot, annars kör inte nattens spegelimport. Länk och kommando i `HANDOFF.md` §Nästa steg 0.
- [ ] `[P2]` FTS5 i spegeln i stället för LIKE. Gratisplanens D1-kvot är 5 miljoner lästa rader per dygn för hela kontot, och LIKE läser alla 27 035 rader per fråga: 185 reservsökningar på ett dygn tömmer kvoten. FTS5 (som D1 stöder) läser bara träffarna. Blir akut först när reserven används på riktigt, alltså när nyckeln dör eller lasten ger 429.
- [ ] `[P3]` Rate Limiting-bindningen per användare när Firebase Auth finns (beslut 2). Meningslös i dag: alla delar en grindkod.

## Captured

- [ ] [P0] [Wish] + - även i tabellen på antal flaskor (före och efter siffran blir nog bra?) låt claude design göra nya ikoner som syns till vänster (de är inte snygga nog för release)
