---
schemaVersion: 1
status: active
currentGoal: v1 byggd 2026-09-05 och live på buildapp.se/flaskor med Worker, secret och seedad D1.
nextAction: Patrik öppnar https://buildapp.se/flaskor, skriver grindkoden, ser 21 viner, lägger till ett Systembolagsvin och installerar appen på telefonen. Sedan ja eller nej på §Val tagna åt Patrik.
blockers: []
reviewedAt: 2026-09-05
---

# Handoff: Flaskor

Senast uppdaterad: 2026-09-05 kl. 21:40, v1 helt i molnet.

## Läge

Hela v1 finns i `main` (commits `ca195ed` till `c1de427`), en commit per backlogpunkt. Verifierat lokalt: `tsc -b`, 23 enhetstester (piller, tumregel, format, Systembolaget-parsern mot två sparade produktsidor i `worker/test/fixtures/`), 11 Worker-tester i riktig workerd med lokal D1, `wrangler deploy --dry-run`, `vite build`, och alla fem vyer i Chromium på 1 280 och 390 px mot `vite dev` (port 5180) och `wrangler dev` (8787).

Molnet, 2026-09-05 kl. 21:25: D1 `flaskor` skapad (region EEUR, id i `wrangler.jsonc`), migrering 0001 körd, Workern deployad som version `b251db85` med routen `flaskor-api.buildapp.se` (DNS skapad av wrangler, `/health` svarar 200) och cron `0 2 * * *`, GitHub Pages aktiverat med Actions och workflowkörningen grön, https://buildapp.se/flaskor svarar 200 och bundeln bär API-adressen, `npm run seed -- --remote` la 21 rader med bild i molnets D1. Secreten `GATE_CODE` satt kl. 21:38 med `wrangler secret bulk .dev.vars`; grinden svarar 401 på fel och saknad kod. Inloggning i appen är inte kontrollerad av mig, koden finns bara hos Patrik.

Layout: `src/` (React, en CSS-fil `app.css` ovanpå `tokens.css`), `shared/` (typer, fel, piller- och tumregellogik, delas av klient och Worker), `worker/` (routes i `src/index.ts`, D1 i `src/db.ts`, Systembolaget i `src/systembolaget.ts`, migreringar, tester, fixturer), `scripts/seed.ts`, `design/` (facit).

## Nästa steg

1. **Verifiera live:** öppna https://buildapp.se/flaskor, skriv grindkoden (samma som i `.dev.vars`), se 21 viner i Källaren. Lägg till ett Systembolagsvin via nummer. Installera som app på telefonen (Dela, Lägg till på hemskärmen). Ge Julia koden.
2. **Cron:** morgonen efter, `npx wrangler tail flaskor-api` runt 04:00 eller kolla "Kollat" i detaljvyn för ett Systembolagsvin.

Byta grindkod: ändra raden i `.dev.vars` och kör `npx wrangler secret bulk .dev.vars` själv i terminalen. Inte `secret put` via Claude Codes `!`-prefix: den läser tom stdin och sparar en tom sträng (hände 2026-09-05).

Sedan: punkterna under "Efter första molndeployen" i `BACKLOG.md`, främst Caviste-bilden, och ja eller nej på §Val tagna åt Patrik.

## Val tagna åt Patrik

Chunk-läge 2026-09-05. Säg till om något ska ändras.

**Designleveransen saknade:**
- Grindvyn: ett kort med tokens ur §1 (ordmärke, etikett, fält, knapp), `src/views/Gate.tsx`.
- Desktop för Önskelistan, Barskåpet och Lägg till: samma innehåll som mobilen i en kolumn (720 respektive 560 px) bredvid sidnavigeringen.
- Vindetalj på mobil: samma block i en kolumn, fotot 120 px högt, faktarutan i två kolumner. Under 1 400 px får fotokolumnen 200 px i stället för 260 så texten får plats.
- Redigering (beslut 17): "Ändra" uppe till höger byter mittkolumnen mot ett formulär med alla fält, Spara/Avbryt.
- Bytbar sortering (beslut 28): en `select` i chip-form sist i chip-raden, Pris (fallande), Årgång, Fönsterslut.
- Slut-sektionen utfälld: grå rader med "Lägg på önskelistan igen" plus stegaren, i Barskåpet grå kort med samma knapp.
- "Hämta"-knappen i Lägg till visas bara när fältet har text och inget hämtats; Enter fungerar alltid.

**Logik:**
- "Dags att dricka: N" räknar viner (rader), inte flaskor, med piller Drick eller Snart. Chippet "Drick nu" filtrerar på samma två.
- Kategoriordning i Källaren: Rött, Vitt, Rosé, Mousserande, sedan övriga i bokstavsordning.
- Kolumnen `taste` tillagd i `drink` (designen visar "Smak enligt Systembolaget", byggprompten listar fältet). Enda tillägget till modellen i CONTEXT.md.
- Nattlig uppdatering och uppdatera-knappen rör årgången bara på önskelisterader; ägda flaskor behåller sin årgång (Systembolaget säljer den nya, källaren har den gamla). 404 från Systembolaget sätter `availability = discontinued`; nätfel lämnar raden orörd.
- "Direkt till källaren" sparar antal 1 och inköpspris = dagens pris; ändras i detaljvyn.
- Tillgänglighetstext i Önskelistan: "Finns på Systembolaget · nr 75624 01", "Tillfälligt slut på Systembolaget", "Utgått hos Systembolaget" (grå rad, tom Köpt-knapp), "Caviste" för Caviste-rader, inget för manuella.
- "Öppna en" i Barskåpet visas så länge oöppnade finns, även med en öppnad flaska; den sätter nivån till Full. Under en fjärdedel blir öppnad flaska `null`.
- Systembolagets `usage` delas: temperaturen ("16-18") till `serve_temp`, texten efter "till" till `food`, annars hela texten till `food`.
- Ingen route för att ta bort en rad; ligger i backlog.

**Teknik:**
- Hash-routing (`#/onskelistan`, `#/flaska/12`) i 30 egna rader i stället för ett routerbibliotek: GitHub Pages kan inte skriva om djupa sökvägar till `index.html`.
- Listan cachas i `localStorage` och hämtas om vid start och varje gång fliken får fokus (två användare delar den). Service workern cachar skalet, typsnitten och flaskbilderna, inte API-svaren.
- PWA `registerType: 'autoUpdate'` utan omladdningsbanner (inget pågående arbete att förlora, till skillnad från Beefcakes pass).
- `compatibility_date` 2026-08-08: vitest-poolens workerd stödjer inte senare.
- Lokal utvecklingsport 5180 (5173 och 5174 hålls av Familjehubbens vite från en annan terminal). Båda 5173 och 5180 står i `FRONTEND_ORIGINS`.
- Seed-skriptet raderar alla `caviste`-rader före omkörning, så det går att köra om utan dubbletter. WordPress tumnagelsuffix (`-100x100`) tas bort från bildlänken.
- Fixturer: 7562401 (Domaine Georges d'Ibry, ordervara utan druvor och usage) och 1101 (Vanlig Vodka, sprit med usage och taste). Testsviten släpper ingen trafik ut; Systembolaget svarar ur fixturerna via `outboundService`.
- `.gitattributes` med `eol=lf` så Windows-checkouten slutar varna om CRLF.

## Fällor

- **`wrangler dev` under Claude Code svarar 401 på allt.** Starta med agentvariablerna avstängda, metoden står i vaultnoten `Browser Automation`.
- **Caviste-bilden är en liggande banner**, inte en flaska (första `CAV<nr>`-bilden på sidan). Ser konstig ut i 32×50-rutan. Backlog P2.
- **Skärmbilder av utvecklingsservern visar cachad lista** tills sidan laddas om; `location.hash`-byten hämtar inte om.
