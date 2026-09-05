# Flaskor: designbrief

Klistra in allt inuti staketet i Claude Design (claude.ai/design). Den är skriven för att vara självbärande: designsessionen ser inte repot. Det den levererar landar i `design/` (tokens, ikon, artboards) och blir underlaget för koden. Samma process som Sipdecks identitetssession 2026-07-18.

```
Designa gränssnittet för **Flaskor**, en webbapp för ett hushåll som håller reda på
vilka viner och spritflaskor som finns hemma, vilka de vill köpa, och när vinet bör
drickas. Ersätter ett Excel-ark och Systembolagets sparade listor. Två användare
(Patrik och Julia), tiotals rader, ingen samlarapp: ingen källarplats, ingen
värdering, ingen community.

## Produkten

Fem vyer ur samma data:
- **Källaren**: ägda viner, grupperade på typ (rött, vitt, mousserande), sorterade på
  pris. Sök, chips för typ, land och drickstatus. En rad överst: "Dags att dricka: N".
- **Önskelistan**: vin och sprit man vill köpa, lagda via Systembolagets artikelnummer
  eller produktlänk. Visar pris och om varan finns på Systembolaget. Ett tryck "Köpt"
  öppnar en liten ruta (antal, pris) och flyttar raden till Källaren eller Barskåpet.
- **Barskåpet**: ägd sprit. Antal oöppnade flaskor plus en öppnad flaska med nivå i
  fjärdedelar (full, 3/4, halv, 1/4) som stegas med plus och minus.
- **Vindetalj**: allt om ett vin: flaskfoto, namn, producent, årgång, ursprung, druvor,
  drickfönster som tidslinje, serveringstemp, karaffering i timmar, mat, smak (från
  Systembolaget), egen kommentar ("smakade gött, köp mer"), antal, inköpspris och
  dagens pris, länk till källan.
- **Lägg till** (mobil): ett fält för artikelnummer eller länk, sedan en förhandsvisning
  av det hämtade vinet med förifyllt drickfönster, och "Lägg på önskelistan" eller
  "Direkt till källaren".

Varje rad räknas i antal flaskor, aldrig per fysisk flaska. "Drack en" minskar antalet
utan ruta. Antal noll stannar grått i en ihopfälld sektion "Slut" med "lägg på
önskelistan igen".

**Drickfönstret** är ett årsintervall ("2024–2029") och visas som ett piller:
- grått "Vänta" före fönstret
- grönt "Drick" inne i fönstret
- gult "Snart" under fönstrets sista tolv månader
- rött "Förbi" efter fönstret
- streckat "Okänt" när fönster saknas
Sprit har inget fönster. Pillret är den viktigaste statusen i hela appen och ska vara
läsbart på ett ögonblick i en lista med 20 rader.

Bilden på varje rad är Systembolagets produktfoto: en frilagd flaska på transparent
bakgrund, 200 px bred, stående. Inga illustrationer.

## Fixade beslut

- Namn: **Flaskor**. Bara svenska i gränssnittet.
- Desktop och mobil är lika viktiga. Desktop för att planera middag, mobil för att stå
  i butiken och titta på önskelistan. Mobil har bottennavigering med fyra val:
  Källaren, Önskelistan, Barskåpet, Lägg till.
- **Flaskor är syskon till Sipdeck**, en befintlig app i samma familj. Ärv följande
  exakt, ändra inte:
  - Typsnitt: Instrument Serif (400 och kursiv, bara för vinnamn och rubriker) och
    Work Sans (400, 500, 600, allt annat). Belopp och antal använder
    `font-variant-numeric: lining-nums tabular-nums`.
  - Bakgrund `#EFE8DB`, yta/kort `#FBF7EF`, bläck `#211B12`, sekundärt bläck
    `#6E6455`, linje `rgba(33,27,18,.14)`, skugga
    `0 1px 2px rgba(33,27,18,.06), 0 12px 32px -12px rgba(33,27,18,.25)`.
  - Ton: ljus, luftig, varm, typografisk. Tänk restaurangens vinlista, inte
    samlarens databas.
- **Egen accentfärg**, inte Sipdecks vermouthgröna `#2F6B3F`. Välj en i oklch med
  samma ljushet och kroma som den gröna (ungefär L 0,47, C 0,09) och en annan
  nyans: vinröd, oliv eller terrakotta är kandidater, men välj det som bäst bär
  knappar, aktiv navigering och länkar mot den varma bakgrunden. Motivera valet.
- Pillerfärgerna (grön, gul, röd, grå) är status, inte accent. Grön får vara
  Sipdecks `#2F6B3F`. Gul och röd måste klara WCAG AA som text på sin tonade
  bakgrund och som prick på `#FBF7EF`.
- Inga emoji, inga gradienter, inga kort med rundad vänsterkant i accentfärg.
  Ikoner som linjer i SVG, en stil, 20 px-rutnät.

## Hårda krav

1. Allt kodfärdigt: färger, typ och avstånd som CSS custom properties för `:root`
   med prefixet `--fl-`, ikoner som inline-SVG i kodblock, inga rasterbilder.
2. Appikon som fungerar vid 16 px (favicon) och 512 px, och överlever maskable-
   beskärning (håll märket i den centrala 80 %-zonen). Ingen flaska som kopierar
   Sipdecks glas.
3. Alla text- och bakgrundspar med kontrastvärden listade, WCAG AA.
4. Mobilens tryckytor minst 44 px. Inga falska statusfält eller tangentbord i
   mobilskisserna.
5. Svenska å, ä, ö i alla typexempel. Decimalkomma och mellanslag som
   tusentalsavgränsare i belopp: "1 125 kr", "12,5 %".

## Leveranser, i denna ordning

1. Tokens: färg (ljust läge; mörkt läge valfritt, säg om du stryker det), typ-skala
   (display, rubrik, brödtext, etikett, belopp), avstånd, radier, skuggor.
2. Pillerkomponenten: de fem tillstånden, i lista och i detaljvy.
3. Artboards för alla vyer: Källaren på desktop (1440×900) och mobil (390×844),
   Önskelistan på mobil, Barskåpet på mobil (med fjärdedelsnivån), Vindetalj på
   desktop, Lägg till på mobil (efter att vinet hämtats), samt Köpt-rutan som
   overlay på Önskelistan.
4. Appikon plus ordmärke.
5. Regler att inte bryta: fem "gör inte", specifika för Flaskor.

Använd riktiga exempel i skisserna: Chablis Premier Cru Les Montmains 2024 (350 kr,
drickes 2025–2032), Chianti Classico Riserva 2021 (260 kr, 2022–2027), Barolo 2021
(499 kr, 2027–2035, alltså "Vänta"), Châteauneuf-du-Pape 2024 (375 kr, 3 flaskor),
Hendrick's gin (480 kr, på önskelistan), Talisker 10 (479 kr, öppnad, halv).
```
