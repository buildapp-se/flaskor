# Backlog

Öppet arbete, prioriterat `[P0]` till `[P3]`. Besluten bakom står i [GRILL-STATUS.md](GRILL-STATUS.md), modellen i [CONTEXT.md](CONTEXT.md). En punkt bockas när koden är verifierad, inte när den tros klar.

## Byggt

v1 byggd 2026-09-05 i chunk-läge (commits `ca195ed` till `1359ed6`): tsc, 23 enhetstester, 11 Worker-tester i workerd, `vite build`, Chromium 1 280 och 390 px mot `vite dev` och `wrangler dev`. Ingen molndeploy än, se `HANDOFF.md` §Nästa steg.

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

## Efter första molndeployen

- [ ] `[P1]` Verifiera live: grinden mot `flaskor-api.buildapp.se`, seed mot molnets D1, cron-körningen morgonen efter, PWA-installation på Patriks och Julias telefoner.
- [ ] `[P2]` Caviste-bilden: sidans första `CAV<nr>`-bild är paketets liggande banner, inte en flaska (upptäckt vid seed 2026-09-05). Antingen `object-fit: cover`, en annan bild från sidan, eller ingen bild för Caviste-rader.
- [ ] `[P2]` Grindkoden ligger i localStorage i klartext på delad dator; räcker tills Firebase Auth (beslut 2).
- [ ] `[P2]` Ta bort en rad (finns inte i v1: en felinlagd rad kan bara flyttas mellan önskelista och källare).

## Senare, beslutat uppskjutet

- [ ] `[P2]` Firebase Auth som Beefcake, användare kopplade till `household_id` (beslut 2).
- [ ] `[P2]` Sipdeck-synk: mappa barskåpsrad till Sipdecks ingrediens-id, knapp som skriver eget skafferi via Sipdecks Worker (beslut 7).
- [ ] `[P2]` Caviste-import via produktlänk (beslut 6).
- [ ] `[P2]` Dagspris från fler källor än Systembolaget, inköpspris mot dagspris (beslut 4).
- [ ] `[P3]` Etikettskanning med foto och AI i Workern (beslut 15).
- [ ] `[P3]` Drucken-logg per rad: datum, betyg 1 till 5, kommentar (beslut 16).
- [ ] `[P3]` Engelska som andra språk (beslut 18).
- [ ] `[P3]` Byt sidläsning mot Systembolagets sortimentsdump om användarantalet växer (beslut 23).
- [ ] `[P3]` Namnsökning hos Systembolaget om nyckeln i deras JS-bundle går att återanvända.
