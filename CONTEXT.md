# CONTEXT.md: Flaskor

Vad produkten är, domänorden, datamodellen och arkitekturen. Besluten som ledde hit står numrerade i [GRILL-STATUS.md](GRILL-STATUS.md); frågeomgångarna i [docs/GRILL-HISTORIK.md](docs/GRILL-HISTORIK.md); omvärldsresearchen i [docs/RESEARCH.md](docs/RESEARCH.md). Ett faktum lever i en fil: modellen här, arbetet i `BACKLOG.md`, läget i `HANDOFF.md`.

**Språkregel:** gränssnitt och produktdokument på svenska, kod, API och databasfält på engelska. Alla gränssnittssträngar ligger i en ordbok från dag ett (svenska nu, engelska senare, beslut 18).

## Produkten

Ett hushåll (Patrik och Julia) håller reda på vilka flaskor som finns hemma, vilka de vill köpa, och när vinet bör drickas. Ersätter ett Excel-ark med 21 rader och Systembolagets sparade listor. Skala: tiotals rader, två användare. Inte en samlarapp: ingen källarplats, ingen värdering, ingen community.

## Domänord

| Svenska (UI) | Kod | Betyder |
|---|---|---|
| Flaska | `drink` | En rad: ett vin eller en sprit i en viss årgång. Räknas i antal, aldrig per fysisk flaska (beslut 4) |
| Källaren | `cellar` | Vin med flaggan `owned`, i vyn Källaren |
| Barskåpet | `bar` | Sprit med flaggan `owned`, i vyn Barskåpet |
| Önskelistan | `wishlist` | Rader utan `owned`, vin och sprit i samma vy |
| Slut | `depleted` | En ägd rad vars antal är 0; stannar grå i en ihopfälld sektion (beslut 30) |
| Drickfönster | `drinkWindow` | Årsintervall från och till, egna fält, förifylls av tumregeln (beslut 5, 13) |
| Piller | `windowState` | Härledd: `wait`, `drink`, `soon`, `past`, `unknown` (beslut 12) |
| Hushåll | `household` | Ägaren av all data; ett enda i dag, id från dag ett (beslut 22) |
| Grindkod | `gate code` | Den delade koden som låser upp appen och skickas till Workern (beslut 2, 10) |
| Källa | `source` | Var raden kommer ifrån: Systembolaget (artikelnummer) eller Caviste (CAV-nummer), med länk (beslut 17) |

## Datamodell

En tabell `drink`, en modell för vin och sprit (beslut 3). Fält:

- `id`, `household_id`
- `kind`: `wine` | `spirit`
- `owned`: boolean. `owned = 0` betyder önskelista
- `name`, `producer`, `vintage` (år eller null), `country`, `region`, `category` (Systembolagets nivå 2, t.ex. Rött vin), `style` (nivå 3, t.ex. Fylligt & Smakrikt), `grapes`, `volume_ml`, `alcohol`
- `source_kind`: `systembolaget` | `caviste` | `manual`; `source_id` (artikelnummer eller CAV-nummer); `source_url`; `image_url`
- `price_paid` (per flaska, kr), `price_current` (senast kända pris i källan), `price_checked_at`, `availability`: `in_stock` | `temporarily_out` | `discontinued` | `unknown` (beslut 23)
- `count`: antal oöppnade. Sprit dessutom `open_level`: `null` | `4` | `3` | `2` | `1` fjärdedelar av en öppnad flaska (beslut 14)
- `drink_from`, `drink_to`: år. `serve_temp` (text som "16-18"), `decant_hours`, `food` (fritext), `note` (fritext, "smakade gött, köp mer")
- `created_at`, `updated_at`

Ingen drucken-logg, inget betyg (beslut 16, i backlog). Ingen plats (beslut 9).

## Pillerlogiken (beslut 12)

Räknat på dagens datum mot `drink_from` och `drink_to`:

- `unknown`: något av fälten saknas. Streckat piller.
- `wait`: före `drink_from`. Grått.
- `past`: efter 31 december `drink_to`. Rött.
- `soon`: inom 12 månader före slutet. Gult.
- `drink`: annars inne i fönstret. Grönt.

Sprit får inget fönster.

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
- **Köpt** (beslut 29): ett tryck, ruta med antal (1) och pris (Systembolagets), raden får `owned = 1`. Vin till Källaren, sprit till Barskåpet.
- **Drack en**: antalet minskar ett steg, ingen ruta (beslut 16). Sprit: plus/minus på fjärdedelar (beslut 14).
- **Slut**: antal 0 stannar grått med "lägg på önskelistan igen" (beslut 30).
- **Nattlig uppdatering** (beslut 23): cron i Workern hämtar varje artikelnummer en gång per natt (dedupe över hushåll, tak) och uppdaterar pris, årgång och tillgänglighet. En "uppdatera"-knapp per rad gör samma sak på begäran.

## Vyer (beslut 24, 28)

Startsidan är Källaren: grupperad på kategori, sorterad på pris (bytbar till årgång eller fönsterslut), sökruta, chips för kategori, land och piller, en rad överst "Dags att dricka: N". Önskelistan, Barskåpet och Lägg till i bottennavigeringen på mobil, sidnavigering på desktop. Bara svenska.

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
- Caviste är WooCommerce; produktsidan läses som HTML för bild och pris.
