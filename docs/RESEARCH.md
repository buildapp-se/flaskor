# Research: vinlistelösningar och datakällor

Flyttad hit 2026-09-05 från vaultens Inbox. Skriven före första grillomgången; besluten den ledde till står i [GRILL-STATUS.md](../GRILL-STATUS.md).

Utgångsläge: Patriks vin-Excel (21 rader, 25 flaskor, 8 345 kr) plus sparade listor på Systembolaget, med sprit i barskåpet och en tänkt synk till Sipdecks skafferi.

## Datakällor, verifierade med curl 2026-09-05

**Systembolaget, produktsida per artikelnummer: fungerar utan nyckel.**
`https://www.systembolaget.se/produkt/vin/<vilken-slug-som-helst>-<artikelnummer>/` är serverrenderad Next.js. Sluggen ignoreras, bara numret styr. Hela produkten ligger i `<script id="__NEXT_DATA__">` med bland annat: `productNumber`, `productId`, `productNameBold`, `productNameThin`, `producerName`, `vintage`, `country`, `originLevel1..5`, `categoryLevel1..4` (Vin / Rött vin / Fylligt & Smakrikt), `grapes`, `priceInclVat`, `volume`, `alcoholPercentage`, `usage` (serveringstemp och mat i fritext), `tasteSymbols` (Fisk;Fläsk;Fågel), `taste`, `aroma`, `tasteClockBody/Fruitacid/Sweetness/Roughness/Bitter`, `seal`, `isOrganic`, `isNaturalWine`, `assortmentText`, `isDiscontinued`, `isTemporaryOutOfStock`, bildadress `product-cdn.systembolaget.se/productimages/<productId>/<productId>`. Inget drickfönster (`preservable` är null). Hämtningen måste ske server-side (CORS), alltså i en Worker.

**Systembolaget, sök på namn: osäkert.** Den officiella API-portalen ger bara butiker och leverantörer sedan 2021. Det inofficiella `api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch` med nyckeln ur webbplatsens JS svarade 404 på den gamla sökvägen 2026-09-05; nyckeln och vägen måste grävas ur nuvarande JS-bundle om namnsökning behövs. Alternativ: [C4illin/systembolaget-data](https://github.com/C4illin/systembolaget-data) hostar hela sortimentet som JSON (73 MB, uppdaterad 03:00 varje natt) på `susbolaget.emrik.org/v1/products`; en tredjepartsdump, kan försvinna.

**Bilder:** `https://product-cdn.systembolaget.se/productimages/<productId>/<productId>_200.webp` (ca 15 kB, frilagd flaska med transparent bakgrund) och `_400.png` (ca 120 kB) svarar 200; adressen utan suffix ger 404. Verifierat 2026-09-05.

**[AlexGustafsson/systembolaget-api](https://github.com/AlexGustafsson/systembolaget-api):** Go-verktyg för Systembolagets öppna och stängda API:er, med systerrepot `systembolaget-api-data` som håller aktuell data. Patrik pekade på det 2026-09-05; alternativ till C4illin-dumpen om den försvinner.

**Systembolagets sparade listor: ingen export.** "Dryckeslistan" finns under Mina sidor och kan delas som länk eller skrivas ut. Inget API, inloggningsskyddat. Väg in: kopiera artikelnummer eller dela-länken för hand.

**Caviste (caviste.se): WooCommerce.** Produktsidorna svarar 200 på curl, `wp-json` finns. Store API-sökningen `wc/store/v1/products?search=marcoux` gav tom lista, så en produktsida får läsas som HTML (titel, og-taggar, pris) om Caviste-import ska stödjas. Patriks nuvarande 21 rader är alla Caviste-paket (CAV-nummer).

## Open source

| Projekt | Stack | Licens | Vad de gjort bra | Relevans |
|---|---|---|---|---|
| [Cellarion](https://github.com/jagduvi1/Cellarion) | Node, Express, MongoDB, React, Meilisearch, Qdrant, Claude | AGPL-3.0 | Delad vindefinition skild från flaska, kurerade drickfönster per vin och årgång med larm (närmar sig, i fönstret, förbi), önskelista, import från Vivino/CellarTracker/CSV, AI-chatt över egna flaskor | Datamodellen (Wine, Bottle, VintageProfile) är rätt tänkt. Stacken är tio gånger större än vi behöver |
| [Wine Cellar, the-broke-sommeliers](https://github.com/the-broke-sommeliers/wine-cellar) | Django | AGPL-3.0 | Streckkod för att lägga till och ta bort, lagersaldo, mailpåminnelse när ett vin bör drickas, matmatchning | Enkel modell, närmast vår skala |
| [cellarman](https://github.com/sredna43/cellarman) | Docker | ? | Självhostad, liten | Litet, ej granskat i detalj |

## Betalappar

| App | Pris | Styrka | Svaghet för oss |
|---|---|---|---|
| [CellarTracker](https://support.cellartracker.com/article/80-cellartracker-subscription) | Gratis, frivillig prenumeration efter källarstorlek | Störst community-databas, mogna drickfönster, "ready to drink"-rapport, CSV-export | Ingen Systembolaget-koppling, tungt gränssnitt, USA-centrerat |
| [Vivino](https://www.vivino.com/en/wine-news/discover-vivinos-wine-cellar-feature) | Gratis | Etikettskanning i toppklass, källarvy med drickfönster, önskelista | Byggd för upptäckt och köp, inte inventering; ingen Systembolaget-data |
| [InVintory](https://invintory.com/blog/best-wine-apps-top-tools-for-collectors-compared/) | Prenumeration | Visuell källarkarta, plats per flaska | Lyxsegment, för mycket för 25 flaskor |
| Cellared | iPhone, prenumeration | Drickfönster som huvudfunktion, "vad ska jag öppna ikväll" | Bara iPhone |
| VinoCell | | | Bara Frankrike |

Mönstret i alla granskningar 2026: ingen app gör allt, samlare kör Vivino i butiken och CellarTracker/Cellared hemma. Ingen av dem känner till Systembolagets artikelnummer eller pris.

## Vad Patriks Excel redan innehåller som apparna ofta saknar

Serveringstemp, karaffering i timmar, matförslag i fritext, drickfönster som årsintervall, Caviste-paketnummer, summa per rad. Systembolagets JSON täcker temp och mat (i `usage`) men inte karaffering eller drickfönster: de stannar som egna fält.

## Källor
- https://github.com/topics/wine-cellar
- https://cellared.ai/guides/best-wine-cellar-apps
- https://cellarlog.app/vs/cellartracker-vs-vivino
- https://github.com/dcronqvist/systembolaget-api
- https://github.com/C4illin/systembolaget-data
- https://api-portal.systembolaget.se/
- https://press.systembolaget.se/pressmeddelanden/2011/dryckeslistan-ny-funktion-pa-systembolagetse/
