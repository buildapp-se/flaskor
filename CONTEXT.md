# CONTEXT.md: Flaskor

Vad produkten är, domänorden, datamodellen och arkitekturen. Besluten som ledde hit står numrerade i [GRILL-STATUS.md](GRILL-STATUS.md); frågeomgångarna i [docs/GRILL-HISTORIK.md](docs/GRILL-HISTORIK.md); omvärldsresearchen i [docs/RESEARCH.md](docs/RESEARCH.md). Ett faktum lever i en fil: modellen här, arbetet i `BACKLOG.md`, läget i `HANDOFF.md`.

**Språkregel:** gränssnitt och produktdokument på svenska, kod, API och databasfält på engelska. Alla gränssnittssträngar ligger i en ordbok från dag ett (svenska nu, engelska senare, beslut 18).

## Produkten

Ett hushåll (Patrik och Julia) håller reda på vilka flaskor som finns hemma, vilka de vill köpa, och när vinet bör drickas. Ersätter ett Excel-ark med 21 rader och Systembolagets sparade listor. Skala: tiotals rader, två användare. Inte en samlarapp: ingen källarplats, ingen värdering, ingen community.

## Domänord

| Svenska (UI) | Kod | Betyder |
|---|---|---|
| Flaska | `drink` | En rad: ett vin eller en sprit i en viss årgång. Räknas i antal, aldrig per fysisk flaska (beslut 4) |
| Källaren | `cellar` | Vin och öl med flaggan `owned`, i vyn Källaren (öl 2026-09-07: dricks upp helt, ingen öppen-flaska-logik som sprit) |
| Barskåpet | `bar` | Sprit med flaggan `owned`, i vyn Barskåpet |
| Önskelistan | `wishlist` | Rader utan `owned`, vin, sprit och öl i samma vy |
| Slut | `depleted` | En ägd rad vars antal är 0; stannar grå i en ihopfälld sektion (beslut 30) |
| Drickfönster | `drinkWindow` | Årsintervall från och till, egna fält, förifylls av tumregeln (beslut 5, 13) |
| Piller | `windowState` | Härledd: `wait`, `drink`, `soon`, `past`, `unknown` (beslut 12) |
| Hushåll | `household` | Ägaren av all data; ett enda i dag, id från dag ett (beslut 22) |
| Grindkod | `gate code` | Den delade koden som låser upp appen och skickas till Workern (beslut 2, 10) |
| Källa | `source` | Var raden kommer ifrån: Systembolaget (artikelnummer) eller Caviste (CAV-nummer), med länk (beslut 17) |

## Datamodell

En tabell `drink`, en modell för vin och sprit (beslut 3). Fält:

- `id`, `household_id`
- `kind`: `wine` | `spirit` | `beer` (öl 2026-09-07, hamnar i Källaren som vin, inte Barskåpet). Vid import styr Systembolagets nivå 1: `"Sprit"` ger `spirit`, `"Öl"` ger `beer`, allt annat `wine`. Strängarna verifierade mot skarpa data 2026-09-09 (sök på "Norrlands Guld" ger `categoryLevel1: "Öl"`), inte längre gissade.
- `owned`: boolean. `owned = 0` betyder önskelista
- `name`, `producer`, `vintage` (år eller null), `country`, `region`, `category` (Systembolagets nivå 2, t.ex. Rött vin), `style` (nivå 3, t.ex. Fylligt & Smakrikt), `grapes`, `volume_ml`, `alcohol`
- `source_kind`: `systembolaget` | `caviste` | `manual`; `source_id` (artikelnummer eller CAV-nummer); `source_url`; `image_url`; `sb_product_id` (2026-09-09, migrering 0004: Systembolagets interna produkt-id, som lagersaldot slås upp på)
- `price_paid` (per flaska, kr), `price_current` (senast kända pris i källan), `price_checked_at`, `availability`: `in_stock` | `temporarily_out` | `discontinued` | `unknown` (beslut 23)
- `count`: antal oöppnade. Sprit dessutom `open_level`: `null` | `4` | `3` | `2` | `1` fjärdedelar av en öppnad flaska (beslut 14)
- `drink_from`, `drink_to`: år. `serve_temp` (text som "16-18"), `decant_hours`, `food` (fritext), `note` (fritext, "smakade gött, köp mer")
- `vivino_rating` (vinets snitt 1 till 5, null när Vivino har för få röster), `vivino_count`, `vivino_url` (vinets sida), `vivino_checked_at`
- `rating`, `rating_url` (öl/sprit 2026-09-07: eget eller importerat betyg 1 till 5 med länk till källan, Vivino täcker bara vin. `Rating`-komponenten visar `vivino_rating` när den finns, annars `rating`)
- `created_at`, `updated_at`

Ingen drucken-logg (beslut 16, i backlog). Ingen plats (beslut 9).

## Pillerlogiken (beslut 12)

Räknat på dagens datum mot `drink_from` och `drink_to`:

- `unknown`: något av fälten saknas. Streckat piller.
- `wait`: före `drink_from`. Grått.
- `past`: efter 31 december `drink_to`. Rött.
- `soon`: inom 12 månader före slutet. Gult.
- `drink`: annars inne i fönstret. Grönt.

Sprit och öl får inget fönster.

## Tumregeln för förifyllt fönster (beslut 13)

År räknade från årgången, nyckel på Systembolagets kategori och pris. Konstant i koden, skrivs alltid över för hand.

| Kategori | under 150 kr | 150 till 300 kr | över 300 kr |
|---|---|---|---|
| Rött vin | +0 till +3 | +1 till +6 | +2 till +10 |
| Vitt vin | +0 till +2 | +0 till +4 | +1 till +8 |
| Rosévin | +0 till +2 | +0 till +2 | +0 till +3 |
| Mousserande vin | +0 till +2 | +0 till +4 | +1 till +8 |
| Starkvin, söta viner | +0 till +10 | +0 till +15 | +0 till +25 |

## Flöden

- **Lägg till via Systembolaget** (beslut 6): användaren skriver artikelnummer eller klistrar in produktlänk. Workern hämtar `https://www.systembolaget.se/produkt/vin/x-<nummer>/` (sluggen ignoreras av Systembolaget), läser `__NEXT_DATA__` och returnerar fälten. Raden hamnar på önskelistan med fönster från tumregeln, temp och mat ur `usage`.
- **Lägg till via Vivino-länk** (2026-09-06): en länk med `/w/<id>` ger samma förhandsvisning ur vinsidan (producent, namn, typ, region, land, druvor, alkohol, bild, betyg, matförslag på svenska), årgång ur `?year=`. Pris och fönster fylls i för hand. Källa `manual`, Vivino-länken sparad så uppdatera-knappen träffar rätt vin.
- **Skriv in själv** (2026-09-06): Ändra-formuläret i Lägg till, vin eller sprit, sedan samma förhandsvisning och sparknappar.
- **Ta bort** (2026-09-06): knapp längst ner i detaljvyn, två tryck. Raden försvinner direkt, servern bekräftar eller listan laddas om.
- **Bulkimport via egen AI** (2026-09-06): "Importera lista" under Lägg till visar en prompt att kopiera in i valfri AI tillsammans med texten från en Systembolagslista. AI:n svarar med JSON (nr, namn, årgång, pris, antal, typ), som klistras in. Varje artikelnummer slås upp hos Systembolaget (fyra åt gången), rader utan nummer sparas som egna. Granskningstabell med kryssruta, mål (önskelistan, källaren, barskåpet) och antal per rad, "Alla till". Import sparar raderna en och en; ångra-raden längst ner tar bort dem igen inom tio minuter. Ångra lever bara i minnet.
- **Massåtgärder i tabellen** (2026-09-06): kryssrutor per rad och för alla, sedan Ta bort eller Lägg på önskelistan igen, båda med ångra (borttagna rader kommer tillbaka som nya rader med samma innehåll).
- **Köpt** (beslut 29): ett tryck, ruta med antal (1) och pris (Systembolagets), raden får `owned = 1`. Vin och öl till Källaren, sprit till Barskåpet.
- **Drack en**: antalet minskar ett steg, ingen ruta (beslut 16). Sprit: plus/minus på fjärdedelar (beslut 14).
- **Slut**: antal 0 stannar grått med "lägg på önskelistan igen" (beslut 30).
- **Nattlig uppdatering** (beslut 23): cron i Workern hämtar varje artikelnummer en gång per natt (dedupe över hushåll, tak) och uppdaterar pris, årgång och tillgänglighet. En "uppdatera"-knapp per rad gör samma sak på begäran.
- **Fota flaskan eller streckkoden** (2026-09-08, backlog 37, beslut 15 återöppnat): `POST /api/scan` tar ett foto (data-URL) och/eller en streckkod. Streckkoden slås upp hos Open Food Facts (Systembolaget känner inte till EAN, se Datakällor), fotot läses av Gemini Flash-Lite, båda ger namn, producent, typ, årgång och volym. Namnet söks i Systembolagets sök-API med tre frågor samtidigt (hela namnet, märket plus nästa ord, bara märket), eftersom söket kräver att alla ord matchar och ett helt etikettnamn därför ofta ger noll träffar. Träffarna slås ihop och rankas på namnlikhet åt båda håll, utan produkttypsord men med siffror som skiljer årgångar och åldrar. De tre bästa visas med flaskfoto, volym och pris, och användaren trycker på rätt. Sedan hämtas hela raden som för ett inskrivet artikelnummer. Vin utan Systembolagsträff går via Vivino; ingen träff alls ger formuläret förifyllt med det etiketten sa. Två secrets: `GEMINI_API_KEY` (Googles gratisnivå, projekt `flaskor-d3762`) och `SB_API_KEY` (Systembolagets publika frontendnyckel). Saknas den senare blir kandidatlistan tom.
- **Sök på namn** (2026-09-09): `GET /api/search?q=` kör Systembolagets sök med samma publika frontendnyckel som skanningen och ger kandidatlistan rakt av, utan omrankning: användaren skrev frågan själv, så sökmotorns ordning är den bästa gissningen. I Lägg till delar namnet ruta med artikelnummer, streckkod och länkar. Rena bokstäver går direkt till söket; en fråga med siffror provar artikelnumret först och faller tillbaka på söket när det svarar 400, så "Absolut 100" fungerar utan en egen gissning på klienten.
- **Lager i vald butik** (2026-09-09, backlog P3): `GET /api/stock?drink=&store=` mot `stockbalance/store/{butik}/{productId}`, som ger både saldo och hyllplats ("48 st, hylla 14-04-03"). **Uppslaget sker på Systembolagets interna `productId`, inte artikelnumret**: artikelnumret svarar 200 med `stock: 0` och `isInStoreAssortment: false` på varje butik, alltså tyst fel svar och inte ett fel. Därför bär raden `sb_product_id`, satt vid import, vid nattens uppdatering, och vid första lagerfrågan på en rad från före migreringen. Butiken väljs en gång och sparas i `localStorage` (`flaskor.store`); saldot hämtas på knapptryck i detaljvyn, inte automatiskt per rad. Butikslistan (455 butiker) ligger i bundeln, `src/stores.json`, genererad av `npm run stores`.
- **Sök på Distiller** (2026-09-07): sprit och öl saknar en automatiserad betygskälla (Distiller.com sitter bakom en Cloudflare-utmaning som bara en riktig webbläsare klarar, ingen Worker/cron kan komma åt den). Detaljvyn visar i stället en sökknapp till `distiller.com/search?term=<namn>`, samma plats och mönster som vinets "Sök på Vivino". Betyg och länk skrivs in för hand i `rating`/`rating_url`.
- **Vivino-betyg** (2026-09-06): ett vin får sitt betyg när det sparas, via uppdatera-knappen (alla viner, även Caviste och manuella) och nattligt för viner utan betyg eller med betyg äldre än 30 dagar, högst 20 per natt. `POST /api/refresh-all` kör nattens jobb på begäran. Workern läser Vivinos söksida och tar första träffen om minst hälften av sökorden finns i träffens namn; annars sparas bara hämtdatumet. **Har raden redan en `vivino_url` hämtas betyget från just den vinsidan i stället för att söka om** (2026-09-09), så en länk rättad för hand i Ändra är pinnad och överlever nattens körning. Vinsidan är dessutom en bråkdel av söksidans 1,7 MB.

## Vyer (beslut 24, 28)

Startsidan är Källaren: grupperad på kategori (öl grupperas på sin egen stil, t.ex. "IPA", i samma lista som vinkategorierna, okända sist i bokstavsordning), sorterad på pris (bytbar till årgång, fönsterslut, antal, namn eller Betyg, riktningen växlas med en pil), sökruta som även träffar mat, kommentar och smak (träffen visas markerad under vinet), chips för kategori (Rött, Vitt, Rosé och Bubbel syns alltid, gråa när de är tomma), land och "Drick nu", en rad överst "Dags att dricka: N" och summan "N flaskor · X kr" (antal gånger inköpspris). Sök, chips, sortering och vy sparas i `localStorage` så de överlever sidbyte. En tabellvy (Excel-läget) visar alla ägda viner och öl platt med sorterbara kolumnrubriker, valbara kolumner och sidscroll.

Önskelistan (ombyggd 2026-09-07 i samma stil som Källaren/Barskåpet): sök, sortering (billigast först som standard), kind-chips (Vin, Sprit, Öl) och kategorichips, lista/tabell-växel. Visar artikelnumret som länk till produktsidan (Systembolaget minns vald butik där) och betyget (Vivino för vin, det egna för sprit och öl). Önskelistan, Barskåpet och Lägg till i bottennavigeringen på mobil, sidnavigering på desktop. Bara svenska.

## Arkitektur (beslut 2, 10, 11, 21, 27)

- **Frontend:** React + Vite + TypeScript `strict`, handskriven CSS med tokens från designrundan (ingen Tailwind). PWA: manifest och service worker som cachar skalet och senaste listan; skrivningar kräver nät, ingen offline-kö.
- **Hosting:** publikt repo, GitHub Pages via user-site-tricket på `buildapp.se/flaskor` (Vite `base: '/flaskor/'`), samma som Sipdeck och Beefcake.
- **Backend:** Cloudflare Worker `flaskor-api.buildapp.se` med D1. Hämtar Systembolaget (CORS hindrar webbläsaren), kör cron.
- **Åtkomst nu:** en grindkod, skrivs in en gång, sparas i `localStorage`, skickas som `Authorization: Bearer` och jämförs i Workern mot en secret. Repot är publikt, så grinden måste sitta i Workern, aldrig bara i klienten.
- **Åtkomst senare:** Firebase Auth som Beefcake, användare kopplas till `household_id`. Ingen datamigrering.
- **Design:** syskon till Sipdeck i typografi (Instrument Serif + Work Sans) och varmvit bakgrund, egen accentfärg, inga illustrationer, Systembolagets flaskfoto är bilden. Ljust och luftigt. Detaljer avgörs i designrundan (beslut 8, 26).

## Datakällor

Verifierat 2026-09-05, detaljer i [docs/RESEARCH.md](docs/RESEARCH.md):

- Systembolagets produktsida är serverrenderad, JSON i `__NEXT_DATA__`, ingen nyckel. Saknar drickfönster, karaffering och EAN. Flaskfoto: `product-cdn.systembolaget.se/productimages/<productId>/<productId>_200.webp` (transparent bakgrund).
- Namnsökning hos Systembolaget är osäker (inofficiellt API svarade 404). Reserv: tredjepartsdump av hela sortimentet.
- Systembolagets sparade listor kan inte exporteras.
- Systembolagets sök-API (`api-extern.systembolaget.se/sb-api-ecommerce/v1/`) svarar med den publika frontendnyckeln på både `productsearch/search` och `stockbalance/store/{butik}/{produkt}` (verifierat 2026-09-09). Deras `/site`-vägar gör det inte: allt som skulle ge butikslistan svarar 401 eller 404 med samma nyckel. Butikslistan tas därför ur `sitemap-butiker.xml`, där butiksnumret står sist i varje sökväg.
- Caviste är WooCommerce; produktsidan läses som HTML för bild och pris. Flera viner delar ofta en sida, som förutom flaskorna bär en liggande banner och en gruppbild på hela paketet. Rätt flaska väljs på ord ur vinnamnet i filnamnet (`CAV0143-webb-Sesia`, diakriter borttagna) och därefter på höjd genom bredd, läst ur WordPress storlekssuffix (`-300x1116.jpg`): flaska ≈ 3,7, gruppbild ≈ 1,6, banner < 1. Caviste förkortar en del viner (`CC`, `CDR`, `CNP`), de tre går inte att härleda och rättas i Ändra.
- Vivino (verifierat 2026-09-06): inget öppet API, men `vivino.com/sv/explore?search_term=` är serverrenderad och bär träfflistan som HTML-kodad JSON med `wine_ratings_average`, `wine_ratings_count` och vinets id (`vivino.com/w/<id>`). Sidan väger 1,7 MB. Under fem röster skriver Vivino snittet 0. Svarar Cloudflares nät (20 av 20 träffar vid första körningen).
- Systembolagets data saknar EAN (kontrollerat i fixturerna och i `AlexGustafsson/systembolaget-api`), så en skannad streckkod kan inte mappas till artikelnummer. Verifierat med riktiga anrop 2026-09-08: `textQuery` med en streckkod ger noll träffar, `barcode=` och `gtin=` ignoreras helt (samma svar som utan filter), och gissade streckkodsvägar svarar 404. Deras egen app skannar, men via något som inte ligger i det här API:t. Bryggan blir i stället Open Food Facts (`world.openfoodfacts.org/api/v2/product/<ean>.json`, gratis, ingen nyckel), som ger namn, märke och volym: god täckning på sprit och öl, tunn på vin.
- Namnsökningen fungerar med frontendnyckeln i huvudet `ocp-apim-subscription-key` mot `api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch/search?textQuery=`. Nyckeln stod i klartext i det publika repot `oliverlevay/barcode-to-kcal` och behövde inte grävas ur deras bundle. Den ligger som secreten `SB_API_KEY` sedan 2026-09-08. Samma nyckel öppnar lager per butik: `stockbalance/store/<butik>/<produkt>/`.
- Streckkodsläsning i webbläsaren: `BarcodeDetector` finns i Android Chrome men inte på iPhone (WebKit, trasig sedan iOS 18). Därför är fotot huvudvägen och streckkodsläsningen en bonus; siffrorna går också att skriva i rutan.
- Gemini (verifierat 2026-09-08): Google AI Pro är en konsumentprenumeration utan API-åtkomst, men gratisnivån i AI Studio räcker (cirka 1 500 anrop per dygn på Flash). Flash-Lite läser en etikett på cirka en sekund; de större Flash-modellerna tar 10 till 25 sekunder på samma bild utan att läsa bättre.
