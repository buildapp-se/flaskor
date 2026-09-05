# Backlog

Öppet arbete, prioriterat `[P0]` till `[P3]`. Besluten bakom står i [GRILL-STATUS.md](GRILL-STATUS.md), modellen i [CONTEXT.md](CONTEXT.md). En punkt bockas när koden är verifierad, inte när den tros klar.

## Byggt

Inget än. Repot skapades 2026-09-05 efter grillen.

## Designrunda (före kod)

- [x] `[P0]` Designbrief skriven: `docs/DESIGN-BRIEF.md` (beslut 19, 26).
- [x] `[P0]` Claude Design körd 2026-09-05, leveransen ligger i `design/Flaskor.dc.html`.

## v1

- [ ] `[P0]` Repo-skelett: React + Vite + TS strict, handskriven CSS, Worker + D1, Pages-workflow, `base: '/flaskor/'` (beslut 10, 21).
- [ ] `[P0]` D1-schema `drink` och `household` enligt CONTEXT.md (beslut 3, 22).
- [ ] `[P0]` Grindkod: klient sparar i localStorage, Worker jämför Bearer mot secret (beslut 2).
- [ ] `[P0]` Lägg till via Systembolagets artikelnummer eller länk: Worker läser `__NEXT_DATA__`, tumregeln fyller fönstret (beslut 6, 13).
- [ ] `[P0]` Källaren: gruppering, sortering, sök, chips, piller, "Dags att dricka: N" (beslut 12, 24, 28).
- [ ] `[P0]` Önskelistan med Köpt-rutan (beslut 29).
- [ ] `[P0]` Barskåpet med fjärdedelar och plus/minus (beslut 14).
- [ ] `[P0]` Drack en, Slut-sektionen och "lägg på önskelistan igen" (beslut 16, 30).
- [ ] `[P1]` Vindetalj med alla fält redigerbara, temp, karaffering, mat, kommentar (beslut 17).
- [ ] `[P1]` Startdata: 21 Excel-rader inlästa, Caviste-bilder hämtade (beslut 25).
- [ ] `[P1]` Nattligt cron och uppdatera-knapp: pris, årgång, tillgänglighet (beslut 23).
- [ ] `[P1]` PWA: manifest, service worker, cache av senaste listan (beslut 11, 27).
- [ ] `[P1]` Ordbok för alla strängar, svenska (beslut 18).
- [ ] `[P1]` Cockpit: `gh repo edit --homepage https://buildapp.se/flaskor`, HANDOFF parsear, GitHub App ser repot.

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
