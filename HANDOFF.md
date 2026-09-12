---
schemaVersion: 1
status: active
currentGoal: Spegeln av Systembolagets sortiment 2026-09-12 (beslut 23), live: D1-tabell med 27 035 rader fylld av GitHub Actions varje natt, reserv för sök och produktuppslag när frontendnyckeln eller produktsidan felar, Cache API på sök och lager, nattens prisuppdatering läser ur spegeln utan produktsidor. Kvar för att natten ska gå av sig själv: hemligheten FLASKOR_GATE_CODE i repots Actions-secrets, som bara Patrik får skapa.
nextAction: Nattens spegelimport är i drift sedan 2026-09-12 (§Nästa steg 0). Kolla i morgon att körningen 03:30 blev grön på https://github.com/buildapp-se/flaskor/actions/workflows/assortment.yml. Sedan ägar-QA av 2026-09-09 (namnsök, Caviste-länk, Drucket, "Kolla lagret för alla"), de tre Caviste-bildlänkarna, omskanningen. Ja eller nej på FTS5 i spegeln (BACKLOG §Spegeln P2) och på Distiller-importen.
blockers: []
reviewedAt: 2026-09-12
---

# Handoff: Flaskor

Senast uppdaterad: 2026-09-12. **Spegeln av Systembolagets sortiment** (commits `8890ca7`, `558e67d`, `d344980`, migrering `0006_sb_product.sql` körd i molnet, Worker `4fadb2e4`). Bakgrund: Systembolaget sa nej till officiell API-åtkomst, så de inofficiella vägarna (frontendnyckeln, produktsidan) är de enda, och de ska tåla både att nyckeln dör och många användare. Chunk-läge på "kör".

- **Spegeln** är tabellen `sb_product` (artikelnummer, söktext, hela produkten som vår `Product`-JSON, körningsstämpel) plus `sb_meta` med `imported_at`. Källa: tredjepartsdumpen `susbolaget.emrik.org/v1/products` (C4illin/systembolaget-data, 27 035 rader, förnyad 03:00). **Workern läser inte dumpen själv**: första versionen strömmade 100 MB i cronen och dog på Cloudflares fel 1102 efter 2 s CPU och 9 000 rader. Kontot är på gratisplanen (bekräftat av Cloudflares kvotmail samma dag). I stället laddar `scripts/assortment.ts` dumpen i GitHub Actions (`.github/workflows/assortment.yml`, 01:30 UTC) och postar 300 rader åt gången till `POST /api/assortment`, sist `done` som rensar äldre körningar och stämplar spegeln. Kört mot molnet för hand: 27 035 rader på 9 s, 92 anrop, högst 15 ms CPU per anrop.
- **Reserv:** `GET /api/search` och skanningens sök går till Systembolaget först och till spegeln när nyckeln svarar 401/403/429/5xx (`searchOrMirror`, `scanSearchOrMirror` i `worker/src/index.ts`). `GET /api/systembolaget` och alla produktuppslag går till spegeln när produktsidan svarar 5xx eller inte nås; en 404 förblir 404 så spegeln aldrig återupplivar en utgången vara (`productOrMirror`). Lagersaldo har ingen reserv, bara Systembolaget vet det.
- **Cache API** (`worker/src/cache.ts`): sök 30 minuter (Systembolagets egen `max-age`), lager 10 minuter. Live: 361 ms, sedan 98 och 69 ms. Lokalt lasttest: 200 samtidiga sökningar på 10 frågor, alla 200, kall cache 86 ms i snitt, varm 5 ms.
- **Natten** (beslut 23): `refreshAll` läser pris, årgång och tillgänglighet ur spegeln när den är yngre än 36 timmar, och hämtar produktsidan bara för nummer spegeln saknar; taket på 50 gäller bara sidhämtningarna. Live: `POST /api/refresh-all` gav `refreshed 19, mirrored 19, failed 0` på 0,98 s. Cronen kör oförändrat 04:00 svensk sommartid.

Verifierat: `npm run check` (tsc, 65 enhetstester, 65 Worker-tester varav 13 nya i `worker/test/assortment.test.ts`, torrdeploy), `wrangler dev` med riktig dump lokalt, och i molnet enligt ovan: `sb_product` 27 035 rader med en enda körningsstämpel, `sb_meta.imported_at` satt. **Ovanpå gratisplanen:** D1 har 100 000 skrivna och 5 miljoner lästa rader per dygn för hela kontot. Nattens import kostar 27 000 skrivningar; i dag gick två fulla körningar plus den dödade (cirka 63 000). Spegelns LIKE-sök läser alla 27 035 rader per fråga, så 185 reservsökningar på ett dygn tömmer läsbudgeten: därför BACKLOG §Spegeln P2 om FTS5.

Tidigare: 2026-09-09, femte omgången. **Senast drucken i listan och som sortering** (commit `7438253`, Worker `e84feecd`, Pages-körning 34358196558 grön, bundeln `index-g4ZeS_U2.js`; ingen migrering, ingen schemaändring). Backloggens sista fria punkt: loggen syntes bara i detaljvyn, och den byggdes i morse med noteringen att ett flöde kräver att loggen följer med i `GET /api/drinks`.

- **Listfrågan bär aggregatet.** En LEFT JOIN ger `last_drunk_on`, `last_rating` och `tasting_count` per rad, alltså ett anrop för hela listan i stället för ett per rad. Fälten är läsfält: de finns inte som kolumner på `drink` och går inte att skriva.
- **Raden visar "Drucken 30 aug 2026 ★★★★★ · 2 ggr"** i Källaren och Barskåpet. Tabellen har kolumnen Drucken, dold från start. Önskelistan har egen radmarkup och visar inget: en vara du inte äger har sällan en logg.
- **Flödet blev sorteringen.** "Senast drucken" fallande *är* "vad drack vi sist", och kostade varken route, vy eller plats i navigeringen.
- **Betyget hör till rätt rad.** `MAX(drunk_on)` med `rating` som naken kolumn ger SQLite-garanterat betyget från just den raden. Verifierat med två anteckningar på samma vin: 3 den 5 januari och 5 den 30 augusti gav 5, inte 3.
- **Cronen är verifierad i molnet** (beslut 23, öppen sedan 2026-09-05): 19 rader bär `price_checked_at` kl. 04:00 och 04:01 svensk tid i dag (02:00 UTC), vilket är schemat `0 2 * * *`. Ingen kodändring, bara belägget.
- **Ändra-formulärets Vivino-länk och bildlänk är nu kontrollerade i webbläsaren**, det som stod som ogjort efter förmiddagens omgång: bildlänken ändrades i formuläret och lästes tillbaka ur databasen.

Verifierat: `npm run check` (tsc, 65 enhetstester, 52 Worker-tester, torrdeploy), hela flödet i Chromium på 1 280 och 390 px mot `vite dev` + `wrangler dev` med två riktiga anteckningar, och efter deploy mot molnet: en anteckning skriven på rad 1, sedd på raden i Källaren live under sorteringen "Senast drucken", och borttagen igen tillsammans med testraden på rad 22. Databasen är tillbaka utan avsmakningar.

**Sidofynd, inte åtgärdat:** ett 404 i konsolen live på `product-cdn.systembolaget.se/productimages/516/516_200.webp`. En seedad rad bär en gissad bildadress för en produkt utan bild. Samma klass av fel som `Product.hasImage` löste för skanningen 2026-09-08, men på en gammal rad. Rättas med en bildlänk i Ändra, eller genom att nollställa `image_url` på rader vars bild svarar 404.

Tidigare samma dag: fjärde omgången. **Kolla lagret för hela Önskelistan i vald butik** (commit `7a45a81`, Pages-körning 34353704189 grön, bundeln `index-CD0y5EKs.js`; ingen Worker-ändring, ingen migrering). Det är hela poängen med lagersaldot: vad av det jag vill ha kan jag köpa i dag. Punkten låg som P3 i morse med motiveringen att ett anrop per rad vid varje sidladdning var för mycket. Invändningen gällde automatiken, inte funktionen: nu sker det på en knapp, fyra åt gången, samma mönster som bulkimportens uppslag av artikelnummer, och utan ny route.

- Önskelistan har en butiksrad (samma sparade butik som detaljvyn), knappen "Kolla lagret för alla N", en summering ("3 av 5 finns i butiken") och en saldorad med hyllplats per vara.
- **Resultatet lever i minnet, inte i databasen.** Saldot åldras på timmar och ska inte se ut som ett faktum efter en omladdning.
- En rad som misslyckas hoppas över i stället för att sänka hela körningen.
- Verifierat i Chromium mot skarpa Systembolagsdata: fem varor, tre i lager med hyllplats, två som butiken inte för.

Tidigare samma dag: tredje omgången. **Caviste-import via produktlänk (beslut 6) och drucken-logg (beslut 16)**, båda byggda, verifierade och live (commits `358f532` och `d8e7e74`, migrering 0005 körd i molnet, Worker `ab709a53`, Pages-körning 34340681913 grön, bundeln `index-DUDPN5ca.js`). Båda stod som "senare" i backloggen, ingendera var bortvald.

1. **Caviste-import.** Klistra in lådans länk i Lägg till, välj vinet, spara. Sidan bär hela raden per vin i en tabell längst ner, så antal, årgång, namn, pris, typ, ursprung, druvor, alkohol, drickfönster, serveringstemperatur, karaffering, smaknot och matförslag kommer med. Det är samma fält som Excel-raderna hade, utan att någon skriver av dem. Varje vin får sin egen flaskbild ur radens cell, så bildvalsgissningen från i morse (`scripts/caviste.ts`) behövs inte här.
   - **Sidformatet varierar mellan lådor.** CAV0143 har en extra `<em>` runt faktarutan, CAV0179 inte. Första versionen läste den inre taggen och gav tomma fält på CAV0179. Nu plockas fälten ur hela specen. Båda sidorna är verifierade mot skarpa anrop, och CAV0143 ligger som fixtur.
   - **"Direkt till källaren" sparar lådans antal** (2 flaskor Brouilly blir 2), inte alltid 1 som förut. Övriga vägar ger fortfarande 1.
2. **Drucken-logg.** Detaljvyn har ett block "Drucket": datum, betyg 1 till 5 och kommentar, senast druckna först. Egen tabell (migrering 0005) eftersom en rad kan drickas många gånger.
   - **"Drack en" är oförändrad.** Beslut 16 säger uttryckligen ingen ruta och inget betyg vid nedräkningen. Friktion vid fel tillfälle är precis varför loggar slutar användas, så anteckningen skrivs när man faktiskt har en åsikt, gärna i efterhand.
   - Loggen syns bara i detaljvyn. Att visa den i listan eller som ett "senast druckna"-flöde kräver att den följer med i `GET /api/drinks`; backlog P3.

Verifierat: `npm run check` (tsc, 64 enhetstester, 51 Worker-tester, torrdeploy), Caviste-importen mot två riktiga sidor i `wrangler dev`, hela flödet i Chromium (klistrade in CAV0179, valde Brouilly, sparade till källaren med 2 flaskor, antecknade betyg 4 med kommentar och såg den i listan), och efter deploy mot molnet: CAV0143 gav lådans tre viner med druvor och pris, och en anteckning skrevs, lästes och togs bort igen på rad 22.

## Val tagna åt Patrik, 2026-09-09 (senast drucken)

- **Sorteringen i stället för en egen vy.** Backloggen skrev "ett senast druckna-flöde över hela källaren"; Källaren har redan sök, chips och sortering, så flödet är en nyckel till i selecten. En vy till hade betytt en nav-plats till för något som visas en gång i veckan.
- **Aggregat i listfrågan, inte hela loggen.** Listan får senaste raden och antalet, inte varje anteckning. Hela loggen är fortfarande detaljvyns, och `GET /api/drinks` svarar lika snabbt som förut.
- **Tre läsfält på `Drink`, inga nya kolumner.** De räknas fram vid läsning, så de kan aldrig bli inaktuella, och `DrinkInput` utesluter dem så ingen kan råka skriva dem.
- **Kolumnen Drucken är dold från start.** Tabellen har redan tolv kolumner; den som vill se loggen slår på den, som Region och Druvor.
- **Önskelistan fick inget.** Den har egen radmarkup, och en vara man inte äger har sällan druckits.

## Val tagna åt Patrik, 2026-09-09 (Caviste-import och drucken-logg)

- **En låda visas som en vallista, inte som en rad.** Lådorna innehåller olika viner i olika antal, och en sammanslagen rad hade varit fel i källaren. Ett vin i taget, med lådans antal.
- **Loggen kopplas inte till "Drack en".** Se ovan; beslut 16 är uttryckligt.
- **Loggen hämtas per rad när detaljvyn öppnas**, inte i den globala listan. Den syns bara där.
- **Betyget är ett heltal 1 till 5**, inte halvor, och kontrolleras i Workern. Vivinos snitt är decimaltal, men ett eget betyg satt med fem knappar ska inte vara det.
- **Fältet `taste` heter "Smak enligt Caviste"** på caviste-rader. Etiketten sa "Smak enligt Systembolaget" på allt, vilket blev synligt fel så fort importen fanns.

Tidigare samma dag: andra omgången. **Backloggens två sista P3-punkter byggda och live** (commit `fc396b5`, migrering 0004 körd i molnet, Worker `676db653`, Pages-körning 34338316835 grön, bundeln `index-DHb9O-IJ.js`). Båda stod som blockerade av att Systembolagets frontendnyckel inte gick att få tag på. Den kom in i repot 2026-09-08 för skanningen och räcker till båda; den behövde aldrig grävas ur deras JS-bundle.

1. **Lagersaldo i vald butik, med hyllplats.** `GET /api/stock?drink=&store=` svarar `{store, stock, shelf, in_assortment}`, och detaljvyn visar "5 st, hylla 18-03-02". Butiken väljs en gång med en sökruta över alla 455 butiker och sparas i `localStorage`; saldot hämtas på knapptryck.
   - **Fällan, och varför migrering 0004 finns:** uppslaget sker på Systembolagets interna `productId`, inte artikelnumret. Artikelnumret svarar 200 med `stock: 0` och `isInStoreAssortment: false` på varje butik, alltså ett tyst fel svar. Raden bär nu `sb_product_id`, satt vid import, vid nattens uppdatering och vid första lagerfrågan på en gammal rad.
   - **Butikslistan** genereras med `npm run stores` ur `sitemap-butiker.xml` (butiksnumret står sist i sökvägen) plus varje butikssidas titel, eftersom slugen tappat å, ä och ö ("umea"). 455 butiker, 27 kB, i bundeln: appen är en PWA. Skriptet gör 455 sidhämtningar, åtta i taget, och tar ett par minuter. Kör om det när en butik öppnar eller stänger.
2. **Sök på namn hos Systembolaget.** `GET /api/search?q=` ger samma kandidatlista som skanningen, utan omrankning. I Lägg till delar namnet ruta med artikelnummer, streckkod och länkar: rena bokstäver går direkt till söket, en fråga med siffror provar artikelnumret först och faller tillbaka på söket när det svarar 400.

Verifierat: `npm run check` (tsc, 52 enhetstester, 44 Worker-tester, `wrangler deploy --dry-run`), båda routerna mot skarpa Systembolagsdata i `wrangler dev`, hela flödet i Chromium på 390 och 1 280 px mot `vite dev` (sökte "Kahlua", valde kandidat, sparade, valde butiken Umeå Rådhusesplanaden, fick 5 st och hyllplats), och efter deploy mot molnet: `/api/search?q=Barolo` gav 10 träffar, `/api/stock` gav 9 st och hylla 08-12-01 och sparade `sb_product_id` på raden.

**Medvetet inte byggt:** lagersaldo per rad i Önskelistan. Det hade blivit ett anrop per rad mot Systembolaget vid varje sidladdning, och kräver köhantering eller cache först. Backlog P3.

## Val tagna åt Patrik, 2026-09-09 (lager och namnsök)

- **Butiken sparas per webbläsare, inte i databasen.** Patrik och Julia handlar inte nödvändigtvis i samma butik, och det är ett vyval som allt annat i `localStorage`.
- **Saldot hämtas på knapptryck**, inte när detaljvyn öppnas. Ett anrop när du faktiskt undrar, i stället för ett per sidvisning.
- **Hela butikslistan följer med**, inte bara Umeås fyra. Samma kod, och den är rätt även när ni är någon annanstans.
- **Namnsöket rankar inte om träffarna.** Skanningen rankar för att den gissar åt användaren; här har användaren skrivit frågan själv, och då är sökmotorns ordning bättre än vår.
- **`sb_product_id` fylls i vid behov i stället för genom en engångsbackfill.** Nattens uppdatering tar ändå alla Systembolagsrader inom några dygn, och en rad du frågar om fyller i sig direkt.

Tidigare samma dag: Två fixar byggda, verifierade och live (commits `57e2fc9` och `9288665`, Worker `bddd8cb2`, Pages-körning 34334402505 grön):

1. **Vivino-länken är pinnad.** En rad med sparad `vivino_url` hämtar betyget från just den vinsidan; bara rader utan länk söker på namnet. Förut sökte nattens cron alltid om på namnet och kunde skriva tillbaka fel vin över en länk rättad för hand. `refreshVivino()` i `worker/src/vivino.ts`, använd av både `refreshDrink` och `refreshAll`. Vinsidan är dessutom en bråkdel av söksidans 1,7 MB. Verifierat live: `POST /api/drinks/1/refresh` behöll länken och svarade på 1 sekund, `id 2` (Buondonno) gav 3,9 av 3 350 röster.
2. **Vivino-länk och bildlänk går att ändra i Ändra.** Ändrad Vivino-länk hämtar betyget direkt i stället för att vänta till natten. Förut krävdes ett PATCH-anrop för hand.
3. **Caviste-bilderna rättade.** Seeden tog sidans första `CAV<nr>`-bild, vilket blev den liggande bannern eller gruppbilden på hela paketet. `pickCavisteImage()` i `scripts/caviste.ts` rankar på ord ur vinnamnet i filnamnet (diakriter borttagna, så "Forêts" hittar `-Forets`) och därefter på höjd genom bredd, läst ur WordPress storlekssuffix. `npm run fix:caviste` (torrkörning som standard, `--write` sparar) ändrade alla 21 rader i molnet via API:t, utan att röra något annat fält. **18 av 21 fick rätt flaska.** De tre kvarvarande går inte att härleda, Caviste förkortar dem:

   | Vin | Rätt bildlänk |
   |---|---|
   | Buondonno Chianti Classico | `https://www.caviste.se/wp-content/uploads/2021/09/CAV0139-webb-CC.jpg` |
   | Domaine de Marcoux Côtes du Rhône | `https://www.caviste.se/wp-content/uploads/2021/09/CAV0140-webb-CDR.jpg` |
   | Patrick Piuze Chablis La Butte 'O' | `https://www.caviste.se/wp-content/uploads/2021/12/CAV0144-webb-ButteO.jpg` |

   Klistra in dem i Ändra, fältet Bildlänk. Alla tre svarar 200 (kontrollerat), men vilken flaska de visar är tolkat ur Cavistes förkortningar, inte sett: titta på bilden innan du sparar. (Chianti Classico Riserva, Châteauneuf du Pape och de andra på samma sidor är redan rätt.)

4. **`npm run seed -- --remote` kräver nu `--force`.** Seeden raderar alla caviste-rader och skriver om dem, så antal, kommentarer och rättade länkar i molnet försvann utan varning. `fix:caviste` finns just för att slippa den vägen.
5. **Ölkategorin verifierad**, ingen kodändring: Systembolagets `categoryLevel1` är exakt `"Öl"` (sök på "Norrlands Guld" mot deras sök-API). Gissningen från 2026-09-07 stämde.

Verifierat: `tsc -b`, 46 enhetstester, 38 Worker-tester, `wrangler deploy --dry-run`, torrkörning av `fix:caviste` mot molnet före skrivningen, `/health` 200 efter deploy, två riktiga refresh-anrop mot molnet, och de nya strängarna i den live-byggda bundeln `index-EHr9hNLi.js`. **Ogjort:** ingen webbläsarkontroll av Ändra-formulärets två nya fält, bara typcheck och bundelsträngar.

Tidigare: 2026-09-08 (andra omgången), matchningen mot Systembolaget rättad efter Patriks första skanning: streckkod träffade 2 av 3, foto 0 av 3, och en träff saknade flaskbild. Fyra rotorsaker, alla belagda med riktiga anrop och fixade i `worker/src/scan.ts` (commit `c4e1149`, Worker `eb848030`):

1. **Söket kräver att alla ord matchar.** Ett fullständigt etikettnamn ger därför noll träffar ("Jack Daniel's Old No. 7 Tennessee Whiskey": 0, "Jack Daniel's": 13). Nu körs tre frågor samtidigt, från hela namnet till bara märket, och träffarna slås ihop. En ratad fråga (429, vanligt när flera flaskor skannas tätt) sänker inte längre hela skanningen.
2. **Diakriter bryter söket.** "Kahlúa" ger noll träffar, "Kahlua" ger åtta. Sökfrågan skickas utan dem.
3. **Rankningen belönade längd.** Fler matchade ord vann, så "Jack Daniel's Tennessee Honey" slog originalet. Nu vägs likheten åt båda håll (Dice på unika ord) och produkttypsord räknas inte (`STOP` i `scan.ts`). Ensiffriga och tvåsiffriga tal räknas däremot: "The Glenlivet 12 Years" och "21 Years Old" skiljs bara av dem.
4. **`images` är tom för en del varor.** Den gissade bildadressen blev en trasig ruta i stället för designens platshållare. Gäller både kandidatlistan och den sparade raden (`toPreview` via `Product.hasImage`).

Mätt på tolv riktiga spritflaskor mot skarpa data: rätt produkt bland de tre i 12 av 12, överst i 10 av 12 (Kahlúa och Cointreau hamnar tvåa). Verifierat: `tsc -b`, 40 enhetstester, 38 Worker-tester, `wrangler deploy --dry-run`, foto- och streckkodsflödet i Chromium mot `vite dev`, och alla tre vägarna mot molnets Worker efter deploy. Fixen rör bara `worker/`, så frontendbundeln är oförändrad sedan `6ac1350`.

Första omgången samma dag, streckkod och etikettfoto (backlog 37, beslut 15 återöppnat): `POST /api/scan` tar foto och/eller streckkod, svarar med en gissning och upp till tre Systembolagskandidater. Verifierat lokalt: `tsc -b`, 40 enhetstester, 30 Worker-tester, `wrangler deploy --dry-run`, och i Chromium på 390 och 1 280 px mot `vite dev` + `wrangler dev`: streckkod i rutan gav tre Absolut-kandidater, ett tryck hämtade hela raden med pris, ursprung, mat och smak; foto på ett vin gav Blanc före Rosé och Rouge; "Ingen av dessa" gav formuläret förifyllt med namn, producent, årgång och kategori ur etiketten. Live: Worker deployad (version `768e938a`, `/health` 200) och de tre vägarna körda mot molnet med riktiga foton, 1 till 2,3 sekunder per anrop. Commit `6ac1350`.

Tidigare: 2026-09-07, öl som tredje kind, eget betygsfält (`rating`, `rating_url`) för sprit och öl, Önskelistan ombyggd i samma stil som Källaren/Barskåpet. Verifierat lokalt: `tsc -b`, 40 enhetstester, 17 Worker-tester (migrering 0003 mot lokal D1), `wrangler deploy --dry-run`, och manuellt i Chromium mot `vite dev` + `wrangler dev`: lade till ett öl med eget betyg och länk, såg det landa i Källaren (inte Barskåpet) utan drickfönster-piller, betyget synas på raden och i detaljvyn, Önskelistans nya tabell/lista-växel, sedan borttaget igen. Live: migrering 0003 körd i molnet, Worker deployad (version `569ce9a6`, `/health` 200), GitHub Pages-workflowkörningen grön, commit `729f884`.

Tidigare: bulkimport, massåtgärder, visa slut och sorteringens plats live (Worker `bfc28ed5`, commit `00e2531`).

## Läge

v1 (commits `ca195ed` till `4583af4`) plus önskelistan 2026-09-06 (`1e76ee3` till `99021cc`, en commit per punkt) finns i `main` och är live. Verifierat lokalt: `tsc -b`, 33 enhetstester (piller, tumregel, format, sortering, Systembolaget-parsern, Vivino-parsern mot en fixtur klippt ur den riktiga söksidan), 14 Worker-tester i workerd med lokal D1, och Källaren (lista och tabell), Önskelistan och Vindetalj i Chromium på 1 280 och 390 px mot `vite dev` (5180) och `wrangler dev` (8787).

Molnet 2026-09-06: migrering `0002_vivino.sql` körd (fyra nya nullbara kolumner), Workern deployad som version `2f9dc058` (`/health` 200), Pages-workflowkörningen kl. 08:42 grön och bundeln `index-CaUE-K5e.js` bär de nya strängarna. `POST /api/refresh-all` kördes live: 5 Systembolagsrader uppdaterade, 20 viner fick Vivino-svar på 22 sekunder, 19 av dem med betyg (ett vin har under fem röster). Databasen hade 26 rader, så Patrik har redan lagt till fem sedan i går. Resten av vinerna får betyg i natt (tak 20 per natt).

Layout: `src/` (React, `app.css` ovanpå `tokens.css`; `sort.ts` är den enda sorteringen för lista och tabell, `persist.ts` sparar vyval i `localStorage`, `views/CellarTable.tsx` är tabellvyn, `components/Rating.tsx` och `Highlight.tsx`), `shared/` (typer, fel, piller- och tumregellogik), `worker/` (routes i `src/index.ts`, D1 i `src/db.ts`, Systembolaget i `src/systembolaget.ts`, Vivino i `src/vivino.ts`, migreringar, tester, fixturer), `scripts/seed.ts`, `design/` (facit).

## Nästa steg

0. **Nattens spegelimport är i drift (2026-09-12 kl. 10:43).** Patrik skapade Actions-hemligheten `FLASKOR_GATE_CODE` och körde workflowen för hand: körning 1 grön på 41 s, loggen "ok: 27035 rader speglade (27035 skickade, 0 gamla borttagna) på 34 s", och `sb_meta.imported_at` i molnet bär körningens stämpel `2026-09-12T08:43:06Z`. Från och med i natt kör den själv 01:30 UTC. Byts grindkoden måste hemligheten bytas med: https://github.com/buildapp-se/flaskor/settings/secrets/actions.
1. **Barskåpet är seedat** (kl. 09:05): 18 sorter ur Sipdecks skafferi, antal 1 oöppnad, utan pris och bild, kommentaren "Från Sipdecks skafferi (id)". Tryck "Öppna en" på de som är öppnade. Sipdecks D1 lästes av Patrik själv (Claude Codes klassificerare stoppar D1-läsning i molnet), och kontot var id 1 av sex; de två största skafferierna (id 7 och 8) är testkonton.
2. **Prova live:** tabellvyn (knappen Lista/Tabell i Källaren), klicka på en kolumnrubrik, bocka i Kommentar och Källa, sök "fisk", öppna önskelistans artikelnummer, se betyget i detaljvyn. Fortfarande ogjort från i går: installera som app på telefonen, ge Julia koden, kolla att cron gått (fältet Kollat i detaljvyn).
3. **Nyckeln till lager per butik** (backlog P3) om du vill ha det: skriptet som gräver nyckeln ur Systembolagets JS-bundle ligger i sessionens scratchpad som `sbkey.mjs` och får inte köras av Claude Code. Säg till så skrivs det in i `scripts/` för dig att köra själv.

Byta grindkod: ändra raden i `.dev.vars` och kör `npx wrangler secret bulk .dev.vars` själv i terminalen. Inte `secret put` via `!`-prefixet: den läser tom stdin och sparar en tom sträng (hände 2026-09-05).

## Val tagna åt Patrik, 2026-09-12 (spegeln)

Chunk-läge på "kör". Säg till om något ska ändras.

- **GitHub Actions i stället för Workern** för nedladdning och parsning, efter att Workern dog på CPU-taket. Alternativet, att spegla via många småcron i Workern, hade blivit två timmars körning per natt. Kostnaden: en Actions-hemlighet som bara du får skapa.
- **300 rader per anrop** (`shared/assortment.ts`), 92 anrop per natt. Mättes till högst 15 ms CPU per anrop i molnet.
- **En 404 från produktsidan går aldrig till spegeln.** Spegeln får inte återuppliva en vara Systembolaget tagit bort; däremot får en gammal spegelrad svara när sidan ligger nere.
- **Spegeln räknas som färsk i 36 timmar**, så en missad natt inte skickar hela natten tillbaka till produktsidor.
- **LIKE-sök med kortast namn först**, inte FTS5, med ponytail-kommentar. Gratisplanens läskvot gör FTS5 mer motiverat än jag trodde när valet togs, se BACKLOG §Spegeln.
- **Rate limiting-bindningen hoppad**: alla delar en grindkod, så det finns ingen nyckel att räkna per användare förrän Firebase Auth. Cachen och spegeln skyddar nyckeln i stället.
- **Ingen nyckelgrävning ur Systembolagets JS** vid 401: det steget är ditt enligt vaultnoten.

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

## Val tagna åt Patrik, 2026-09-07 (öl och betyg)

- **Öl hamnar i Källaren, inte ett eget nav-läge.** Samma resonemang som i researchsvaret: källaren är "det man samlar/väntar på att dricka", barskåpets öppen-flaska-logik (fjärdedelar) passar inte öl som dricks upp på en gång. Ingen ny flik i navigeringen.
- **Kategorin (Systembolagets nivå 1) styr kind vid import**: `"Öl"` antas vara den exakta strängen Systembolaget använder, ograverifierat mot en riktig ölrad (ingen testades live, bara gissat av samma mönster som `"Sprit"`). Om en importerad öl landar som vin: kolla `categoryLevel1` i en riktig Systembolagsrespons och justera `systembolaget.ts`.
- **Betygsfältet (`rating`, `rating_url`) är manuellt, ingen automatisk hämtning.** Research visade inget gratis öppet API som täcker whiskey/rom/gin och öl (Distiller: ingen API, bara oofficiella scrapers; Whiskybase/Whiskystats: bara whisky, betal-API; Untappd: registrering för nya appar verkar stängd). `Rating`-komponenten föredrar `vivino_rating` (vin), annars `rating`, samma stjärnformat och länk.
- **`Rating` syns nu även i Barskåpets kort och tabell** (ny `vivino`-kolumn i `BAR_COLUMNS`, döpt om till "Betyg" i UI:t eftersom den nu bär både Vivino- och egna betyg).
- **CellarTable fick två nya valfria props** (`onShowZero`, `onRewish`) i stället för required: Önskelistan återanvänder samma tabellkomponent för sin tabellvy men har varken "Visa slut" (allt där har alltid 0 flaskor) eller "Lägg på önskelistan igen" (det är redan listan). Utelämnas propen döljs kontrollen.
- **Migrering 0003 bygger om `drink`-tabellen** (SQLite kan inte ändra en `CHECK`), inte bara `ALTER TABLE ADD COLUMN`. Kör `npm run db:migrate:remote` innan Workern deployas, annars svarar `POST /api/drinks` med `kind: beer` 500 (CHECK-krock) mot molnets gamla schema.
- **Distiller-skrapningen är medvetet inte byggd än**, väntar på ett uttryckligt ja (se BACKLOG §Öl och betyg 2026-09-07 och research-svaret i chatten): ToS-risk och underhållsbörda för en scraper mot en sajt utan officiellt API.

## Val tagna åt Patrik, 2026-09-09 (Vivino-länk och Caviste-bilder)

- **En sparad `vivino_url` vinner alltid över namnsökningen**, inte bara en som satts för hand. Att skilja "manuell" från "hittad" hade krävt en kolumn till, och att hämta om från en redan hittad länk är ändå det rätta: det är samma vin, och vinsidan är mycket billigare än söksidan. Går länken inte att läsa loggas det och namnsökningen tar över.
- **Bildlänk och Vivino-länk som vanliga fält i Ändra**, inte egna knappar. Formuläret är generiskt, så det kostade två rader; en "rätta Vivino-träffen"-dialog hade kostat en vy.
- **`fix:caviste` är ett skript, inte en Worker-route.** Det är en engångsrättning av gamla rader, och den ska inte gå att råka trigga från appen. Torrkörning som standard.
- **Ingen gissning på Cavistes förkortningar.** `CC`, `CDR`, `CNP`, `VDF` går inte att härleda ur vinnamnet ("CNP" är inte ens initialerna i Châteauneuf du Pape), och en aliaslista hade varit tre rader data som ruttnar. De tre rättas för hand i stället, en gång.
- **Bilden hämtas aldrig för att mätas.** Formatet läses ur WordPress storlekssuffix i filnamnet, så valet kostar en sidhämtning per produkt och noll bildhämtningar.

## Val tagna åt Patrik, 2026-09-08 (streckkod och etikett)

- **Gemini i stället för Workers AI.** Google AI Pro är en konsumentprenumeration utan API-åtkomst, men AI Studios gratisnivå räcker (cirka 1 500 anrop per dygn). Nyckeln ligger under Firebase-projektet `flaskor-d3762`, samma projekt som Auth ska använda senare. En backend mindre än Workers AI, och tydligt bättre etikettläsning än Gemma 4.
- **Flash-Lite, inte de stora Flash-modellerna.** Att läsa bokstäver från en etikett behöver ingen tankekedja: `gemini-3.5-flash-lite` svarar på cirka en sekund och läste båda testflaskorna rätt, medan 3.8 Flash tog 10 till 25 sekunder på samma bild och lade till fel (den tappade "Absolut" ur namnet). `gemini-flash-lite-latest` är reserv när kvoten tar slut eller modellen är överbelastad.
- **Kandidatval, inte automatisk matchning.** Systembolaget säljer samma vodka i tre volymer och samma vin i tre färger, och etiketten säger inte alltid vilken. Tre kandidater med flaskfoto, volym och pris, ett tryck väljer. Automatik hade gissat fel tyst.
- **Kategorin väger tyngre än årgången i rankningen** (+2 mot +1). Kom ur ett riktigt fel: Excellence Rosé rankades före Blanc för att Gemini läst 2024 på en Blanc-flaska som Systembolaget listar som 2023, och rosén råkade ha 2024. Färgen syns säkert på etiketten, årgången inte.
- **Open Food Facts som brygga för streckkoden.** Systembolagets API känner inte till EAN alls (verifierat: `barcode=` och `gtin=` ignoreras, `textQuery` med en kod ger noll träffar). Open Food Facts är gratis och nyckelfritt, täcker sprit och öl bra, vin dåligt. Okänd kod med foto faller tillbaka på etiketten, utan foto blir det 404 och texten ber om ett foto.
- **`BarcodeDetector` bara där den finns.** Android Chrome läser koden ur fotot direkt i webbläsaren, iPhone saknar den (trasig i WebKit sedan iOS 18) och får i stället Geminis läsning av siffrorna, eller inskrivning i rutan. Ingen WASM-läsare på 1 MB för det.
- **Fotot krymps till 1 280 px JPEG i webbläsaren** innan det skickas, roterat enligt EXIF. En telefonbild på 4 MB blir cirka 200 kB, och Workern avvisar allt över 3 MB base64.
- **`SB_API_KEY` är Systembolagets publika frontendnyckel**, hittad i klartext i det publika repot `oliverlevay/barcode-to-kcal`, inte utgrävd ur deras bundle. Den ligger som secret eftersom repot är publikt. Saknas den svarar skanningen ändå, men utan kandidater.

## Vad som är kvar

Backloggen har **inget fritt kvar att bygga**. Det som står öppet är antingen ditt eller väntar på ditt ja:

- **Ditt:** Actions-hemligheten `FLASKOR_GATE_CODE` (§Nästa steg 0), ägar-QA av 2026-09-09:s fem omgångar, de tre Caviste-bildlänkarna, PWA-installation på telefonerna, koden till Julia.
- **Väntar på ett ja, med skäl som fortfarande håller:** Firebase Auth (beslut 2), Sipdeck-synk (beslut 7, dessutom blockerad: Claude Code får inte läsa Sipdecks D1), dagspris från fler källor (beslut 4), engelska (beslut 18), FTS5 i spegeln (BACKLOG §Spegeln), Distiller-importen. Sortimentsdumpen (beslut 23) är byggd 2026-09-12.
- **Kvar som blockerad, prövad på nytt 2026-09-09:** streckkodsläsning i kameran på iPhone. Den kräver ett WASM-bibliotek på cirka 1 MB i bundeln eftersom WebKit saknar `BarcodeDetector`, och det går inte att pröva om härifrån: det kräver en riktig iPhone. Skälet står kvar tills du testat skanningen på din telefon, vilket ändå ligger i ägar-QA:n.

## Fällor

- **`wrangler dev` under Claude Code svarar 401 på allt.** Starta med agentvariablerna avstängda, metoden står i vaultnoten `Browser Automation`. För kontroll i webbläsaren utan att grindkoden hamnar i chatten: `--var GATE_CODE:test-kod` och skriv `test-kod` i grinden.
- **Lokal D1 kan vara tom** även om migreringarna står som körda (2026-09-06). `npm run seed` fyller på från Excel-raderna.
- **Kontot är på Cloudflares gratisplan** (bekräftat 2026-09-12 av kvotmailet om Durable Objects). Workern dör på fel 1102 när ett anrop drar mer än ungefär 2 s CPU (mätt: 2 020 ms), och D1 har 100 000 skrivna och 5 miljoner lästa rader per dygn för hela kontot. Ingen tung parsning i Workern, inga fulla speglingar för hand mer än en om dagen, och räkna rader lästa innan en fråga får skanna hela `sb_product`.
- **Skurtester mot Systembolaget stoppas av Claude Codes klassificerare** (40 parallella anrop, 2026-09-12). Mät lasten mot `wrangler dev` med cachen varm i stället.
- **Vivinos söksida är 1,7 MB** per vin. Nattens tak på 20 håller cronen kort; höj inte utan att kolla körtiden i `wrangler tail`.
- **Caviste-bilden är en liggande banner**, inte en flaska. Backlog P2.
- **Skärmbilder av utvecklingsservern visar cachad lista** tills sidan laddas om; `location.hash`-byten hämtar inte om.
