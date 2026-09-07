# Handoff: Flaskor

## Overview
Flaskor är en webbapp för ett hushåll (två användare: Patrik och Julia) som håller reda på vilka viner och spritflaskor som finns hemma, vilka de vill köpa, och när vinet bör drickas. Ersätter ett Excel-ark och Systembolagets sparade listor. Tiotals rader. Ingen samlarapp: ingen källarplats, ingen värdering, ingen community. Bara svenska i gränssnittet.

## About the Design Files
`Flaskor.dc.html` är en **designreferens i HTML**: en specifikation med tokens, komponenter och artboards som visar utseende och beteende. Det är inte produktionskod. Uppgiften är att **återskapa designen i den valda kodbasen** (React/Vue/Svelte eller vad som passar) med dess egna mönster. Öppna filen i webbläsaren och läs den parallellt med denna README. Alla mått, färger och SVG-ikoner i filen är avsedda att kopieras som värden.

Filen är ett "canvas"-dokument: sektionerna ligger under varandra, artboards har fasta pixelmått (1440×900, 390×844). Ignorera det yttre dokumentets layout, det är bara presentation.

## Fidelity
**High-fidelity.** Färger, typografi, avstånd, radier, skuggor, ikoner och texter är slutgiltiga. Återskapa pixelnära.

## Relation till Sipdeck
Flaskor är syskon till appen Sipdeck och ärver exakt: typsnitt, bakgrund, yta, bläck, sekundärt bläck, linje och skugga (se tokens). Accentfärgen är egen (vinröd). Om Sipdecks kod finns tillgänglig, återanvänd dess basstilar och byt accent.

## Design Tokens
Lägg som CSS custom properties på `:root` med prefixet `--fl-`.

```css
:root {
  /* färg */
  --fl-bg: #EFE8DB;            /* sidbakgrund */
  --fl-surface: #FBF7EF;       /* kort, yta, inmatningsfält */
  --fl-ink: #211B12;           /* primär text */
  --fl-ink-2: #6E6455;         /* sekundär text, etiketter */
  --fl-line: rgba(33,27,18,.14);
  --fl-accent: #85444F;        /* oklch(.47 .09 10), knappar, aktiv nav, länkar */
  --fl-accent-hover: #6F303C;  /* oklch(.40 .09 10) */
  --fl-accent-tint: #FBE0E3;   /* aktiv nav-bakgrund, markerad rad */
  --fl-ok: #2F6B3F;       --fl-ok-tint: #D8EFDC;    /* Drick */
  --fl-soon: #875800;     --fl-soon-tint: #FBE9C6;  /* Snart */
  --fl-past: #9A322A;     --fl-past-tint: #FFE0DB;  /* Förbi */
  --fl-wait: #6E6455;     --fl-wait-tint: rgba(33,27,18,.06); /* Vänta */

  /* typ */
  --fl-font-serif: 'Instrument Serif', Georgia, serif;   /* 400 + italic, bara vinnamn och rubriker */
  --fl-font-sans: 'Work Sans', system-ui, sans-serif;    /* 400, 500, 600, allt annat */
  --fl-display: 400 40px/1.05 var(--fl-font-serif);
  --fl-title: 400 24px/1.15 var(--fl-font-serif);
  --fl-name: 400 18px/1.2 var(--fl-font-serif);           /* italic på vinnamn */
  --fl-body: 400 15px/1.5 var(--fl-font-sans);
  --fl-label: 500 12px/1.2 var(--fl-font-sans);
  --fl-amount: 500 15px/1.2 var(--fl-font-sans);
  --fl-nums: lining-nums tabular-nums;                    /* alla belopp och antal */

  /* avstånd, radier, skugga */
  --fl-s1: 4px; --fl-s2: 8px; --fl-s3: 12px; --fl-s4: 16px;
  --fl-s5: 24px; --fl-s6: 32px; --fl-s7: 48px;
  --fl-r-pill: 999px; --fl-r-sm: 8px; --fl-r-md: 12px; --fl-r-lg: 20px;
  --fl-shadow: 0 1px 2px rgba(33,27,18,.06), 0 12px 32px -12px rgba(33,27,18,.25);
  --fl-touch: 44px;
}
```

Google Fonts: `Instrument+Serif:ital@0;1` och `Work+Sans:wght@400;500;600`.

Mörkt läge stryks.

### Kontrast (WCAG AA, alla klarar 4,5:1)
- Bläck på bg 14,01 · på kort 15,98
- Sekundärt bläck på bg 4,77 · på kort 5,43
- Accent på bg 5,87 · på kort 6,69 · kort-text på accent 6,69 · accent på accent-tint 5,74
- Grön på tint 5,25 · på kort 5,96
- Gul på tint 5,13 · på kort 5,74
- Röd på tint 5,91 · på kort 6,86
- Grå på tint 5,10 · på kort 5,43

### Formatering
- Belopp: mellanslag som tusentalsavgränsare, decimalkomma: `1 125 kr`, `12,5 %`.
- Årsintervall med tankstreck: `2025–2032`.
- Antal: `1 flaska`, `3 flaskor`; kompakt i mobil: `3 fl`.

## Komponenter

### Drickfönstrets piller (viktigaste statusen)
Fem tillstånd, alltid prick + ord (aldrig bara färg). Sprit har inget piller.

| state | villkor | text | färg | bakgrund |
|---|---|---|---|---|
| vanta | idag < fönstrets start | Vänta | --fl-wait | --fl-wait-tint |
| drick | inne i fönstret | Drick | --fl-ok | --fl-ok-tint |
| snart | inom fönstrets sista 12 månader | Snart | --fl-soon | --fl-soon-tint |
| forbi | efter fönstrets slut | Förbi | --fl-past | --fl-past-tint |
| okant | fönster saknas | Okänt | --fl-ink-2 | ingen, `1px dashed rgba(33,27,18,.4)`, ingen prick |

```css
.fl-pill { display:inline-flex; align-items:center; gap:6px; height:24px;
  padding:0 10px; border-radius:var(--fl-r-pill); font:var(--fl-label);
  font-variant-numeric:var(--fl-nums); }
.fl-pill i { width:6px; height:6px; border-radius:50%; background:currentColor; }
.fl-pill--lg { height:32px; padding:0 14px; font-size:14px; gap:8px; } /* detaljvy, "Drick · 2025–2032" */
.fl-pill--lg i { width:8px; height:8px; }
```
I listor står årsintervallet som 12px `--fl-ink-2` text 8px till höger om pillret. I detaljvyn står det inuti pillret.

### Knappar
- Primär: bakgrund `--fl-accent`, text `--fl-surface`, 500, höjd 44–48px (36px i desktoplistor), radie `--fl-r-sm`. Hover `--fl-accent-hover`.
- Sekundär: `1px solid --fl-line`, transparent eller `--fl-surface`, text `--fl-ink`, samma mått.
- Filterchip: höjd 36px, radie pill, padding 0 14px, 13px. Aktiv: fylld accent med krämtext. Inaktiv: `1px solid --fl-line`.
- Stegare (−/+): två 36×36 (desktoplista) eller 44×44 (mobil) rutor i en gemensam ram `1px solid --fl-line`, radie 8px, delade av en linje. Ikon 20px stroke 1.5.

### Listrad (Källaren)
Desktop grid: `36px 1fr 130px 120px 90px 110px`, gap 20px, padding 12px 20px, avdelare `--fl-line`. Kolumner: flaskfoto (36×56, radie 4) · namn (18px serif italic) + underrad (13px ink-2: region, land · druvor) · piller + årsintervall · pris (500, tabular) · antal · stegare högerjusterad.
Mobil grid: `32px 1fr auto`, gap 12px, padding 12px 14px. Namn 17px serif italic, ellipsis. Underrad: piller + årsintervall. Höger: pris (500) över antal (12px ink-2).
Rader grupperas på typ (Rött, Vitt, Mousserande), sektionrubrik 24px serif (22px mobil) + `3 viner · 5 flaskor` i 13px ink-2. Sorterade på pris fallande. Antal noll: rad grå, samlad i ihopfälld sektion "Slut · N viner" med länk "lägg på önskelistan igen".

### Ikoner
20px-rutnät, `fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round`. Paths finns i kodblocket i sektion 4 av HTML-filen: källaren, önskelistan, barskåpet, lägg till, sök, plus, minus, extern länk, fäll ut.

### Appikon och ordmärke
Kandidat **A** är vald tills annat sägs: tre Bordeaux-siluetter (mitten kräm `#FBF7EF`, sidorna rosé `#C9A9A9`) på vinröd platta `#85444F`, radie 112/512, tunn innerram kräm 16 %. Allt inom r=205 (maskable 80 %-zon). Favicon 16px är förenklad till staplar. Fullständig SVG i sektion 4. Ordmärke: "Flaskor" i Instrument Serif 400, märke och ord i lika höjd, avstånd 0,35 × höjd.

## Screens / Views

### Navigering
- Desktop: vänsterkolumn 232px, `border-right: 1px solid --fl-line`, padding 32px 20px. Logotyp (28px märke + 24px serif "Flaskor"). Fyra länkar, höjd 44px, radie 8px, ikon 20px + text 500. Aktiv: bakgrund `--fl-accent-tint`, text `--fl-accent`. Nederst: "Patrik & Julia · 23 flaskor" 12px ink-2.
- Mobil: bottennav, 4 kolumner, `border-top --fl-line`, bakgrund `--fl-surface`, padding 8px 0 20px (safe area), varje val 48px hög: ikon 20px över 11px 500 text. Aktiv `--fl-accent`, inaktiv `--fl-ink-2`. Val: Källaren, Önskelistan, Barskåpet, Lägg till.

### Källaren (desktop 1440×900, mobil 390×844)
Rubrik "Källaren" 40px (34px mobil) serif. Höger: piller Drick + "Dags att dricka: **4**" (antal viner i Drick/Snart). Sökfält 44px, bredd 320px desktop / full mobil, ikon sök, placeholder "Sök vin, producent, druva". Chips: Alla · Rött · Vitt · Mousserande | Frankrike · Italien | Drick nu (mobil: horisontellt scrollbar rad). Sedan grupperade listor enligt Listrad. Sist "Slut"-sektionen.

### Önskelistan (mobil)
Rubrik + "4 varor". Chips Alla · Vin · Sprit. Ett kort med rader: foto · namn + underrad `**480 kr** · Finns på Systembolaget · nr 22 34` (varianter: "Finns i butik", "Beställningsvara", "Slut på Systembolaget" med hela raden i ink-2 och sekundär knapp) · primärknapp "Köpt" 44px.

### Köpt-rutan (overlay på Önskelistan)
Bakgrund `rgba(33,27,18,.35)`. Bottenark `--fl-surface`, radie 20px 20px 0 0, padding 20px 20px 32px. Innehåll: etikett "Köpt" 12px · namn 22px serif italic · "Flyttas till Barskåpet" (eller "Källaren", beroende på typ). Två fält sida vid sida: Antal (stegare 48px, bakgrund `--fl-bg`) och Pris per flaska (48px, förifyllt Systembolagspris, suffix "kr"). Knappar: Avbryt (sekundär) + "Lägg i Barskåpet"/"Lägg i Källaren" (primär), 48px, lika breda. Vid bekräftelse flyttas raden.

### Barskåpet (mobil)
Rubrik + "3 sorter". Kort per sprit: foto · namn · `Single malt · 479 kr · 0 oöppnade`; knapp "Öppna en" (sekundär, 44px) när oöppnade > 0 och ingen öppnad. Under: "Öppnad flaska" med nivåindikator: fyra 22×10 block, gap 3, radie 2; fyllda `--fl-accent`, tomma `1px solid rgba(33,27,18,.3)`; text Full / 3/4 / Halv / 1/4. Stegare −/+ 44×44 till höger. Plus inaktiv (opacity .4) vid Full; minus vid 1/4 tömmer flaskan (nivå 0 tar bort öppnad; om oöppnade finns kan "Öppna en" starta ny).

### Vindetalj (desktop 1440×900)
Brödsmula "Källaren / Vitt" (accentlänk). Grid `260px 1fr 320px`, gap 48px.
- Vänster: flaskfoto 200×560 (Systembolagets frilagda bild, 200px bred).
- Mitten: producent 13px ink-2 · namn 40px serif · `Chablis, Bourgogne, Frankrike · Chardonnay 100 % · Vitt · 13 %` 15px ink-2. Piller lg "Drick · 2025–2032" + "Andra året av åtta". Tidslinje: spår 8px radie 4 `rgba(33,27,18,.08)`, fönstret som `--fl-ok-tint` med `--fl-ok` 35 % fyllning från start till idag, idag-markör 2×16px `--fl-ink`; årsetiketter 12px under. Faktarad (4 kolumner, border top/bottom `--fl-line`, padding 20px 0): Servering `10–12 °C` · Karaffering `Ingen` / `2 timmar` · Mat · Alkohol. "Smak enligt Systembolaget" (15px). "Egen kommentar" 20px serif italic i citattecken + signatur 13px ink-2.
- Höger: kort 1 "Antal hemma" + stort tal 32px serif; stegare med etiketter "− Drack en" / "+ Köpte fler" 44px. Kort 2: Inköpspris 350 kr · Dagens pris 369 kr · Köpt `14 mar 2025 · Patrik` · Artikelnummer; avdelare; länkar "Visa på Systembolaget" och "Betyg på Vivino" i accent 500 med extern-ikon.

### Lägg till (mobil, efter hämtning)
Rubrik. Fält 48px med inklistrat artikelnummer/länk. Hjälptext "Artikelnummer eller produktlänk. Hämtat 5 sep 2026." Förhandsvisningskort: foto 56×88 · namn 22px serif italic · producent, region · `Chardonnay · Vitt · 75 cl · 13 %` · pris 17px 500. Avdelare. "Drickfönster · förifyllt" med länk "Ändra" (accent) och piller lg. "Smak enligt Systembolaget". Nederst: primär "Lägg på önskelistan", sekundär "Direkt till källaren", 48px.

## Interactions & Behavior
- Rader räknas i antal flaskor, aldrig per fysisk flaska.
- "−" (Drack en) minskar antalet direkt, ingen dialog. "+" (Köpte fler) ökar direkt. Bara "Köpt" från önskelistan öppnar ruta (pris måste in).
- Antal 0 → raden flyttas grå till "Slut"-sektionen, ihopfälld som standard, med "lägg på önskelistan igen".
- Pillerstatus beräknas från dagens datum och fönstret (år, heltal). Snart = idag ≥ fönstrets slutår minus 12 månader och ≤ slut.
- Drickfönster förifylls vid hämtning (från Systembolagets data eller regel per typ), redigerbart.
- Lägg till: fält accepterar artikelnummer eller produkt-URL, hämtar namn, producent, årgång, ursprung, druvor, typ, volym, alkohol, pris, smak, lagerstatus, produktfoto.
- Källaren: sök filtrerar på namn, producent, druva. Chips är AND mellan grupper (typ, land, status), OR inom.
- Hover på knappar: accent → accent-hover; sekundär → bakgrund `--fl-accent-tint`-fri, bara `--fl-line` mörkare (`rgba(33,27,18,.28)`). Inga animationer utöver 120ms color-transition.
- Responsivt: desktop layout ≥ 1024px med sidonav; under det bottennav och mobilens listrad.

## State Management
- `items[]`: { id, kind: 'vin'|'sprit', name, producer, vintage, region, country, grapes[], type: 'rött'|'vitt'|'mousserande'|spritkategori, priceBought, priceNow, sbArticleNo, sbUrl, sbStock, photoUrl, window: {from, to} | null, serveTemp, decantHours, food, tasteSb, comment, commentBy, count, opened: {level: 4|3|2|1} | null, status: 'owned'|'wish', boughtAt, boughtBy }
- Härlett: pillState(item, today), "Dags att dricka" = antal owned vin med state drick|snart, grupper per typ sorterade på priceNow desc.
- Två användare delar samma data (enkel inloggning, ingen roll-skillnad).

## Regler att inte bryta
1. Accent aldrig i piller, status aldrig som knapp eller länk.
2. Färg utan ord: pillret bär alltid prick och ord.
3. Ingen dialog för "Drack en".
4. Inga samlarfält (källarplats, värdeutveckling, poäng, delning).
5. Instrument Serif bara för vinnamn och rubriker; allt numeriskt i Work Sans med tabular-nums.
Dessutom: inga emoji, inga gradienter, inga kort med rundad vänsterkant i accentfärg, inga illustrationer (flaskfoton är Systembolagets).

## Assets
- Flaskfoton: Systembolagets produktbilder, frilagda på transparent bakgrund, 200px breda, stående. Platshållare i designen är streckade rutor.
- Ikoner och appikon: inline-SVG i `Flaskor.dc.html`, sektion 4.
- Typsnitt: Google Fonts (Instrument Serif, Work Sans).

## Files
- `Flaskor.dc.html`: hela specifikationen (tokens, piller, artboards, ikon, regler, OG-bild). Öppna i webbläsare. Stilar är inline; CSS-variablerna i kodblocken är den avsedda implementationen.
- `artboards/Main.dc.html`: äldre skiss, underordnad denna leverans.
- Redan implementerat, ordagrant: `src/tokens.css` (alla `--fl-*`), `public/icon.svg`, `public/icon-maskable.svg`, `public/favicon.svg`, `public/wordmark.svg` (Kandidat A), `public/og-image.png`.
