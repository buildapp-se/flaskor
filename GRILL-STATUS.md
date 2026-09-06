# Grillstatus

## Beslutsregister

Status per 2026-09-05 kl. 21:20, efter v1-bygget. **beslutad** betyder att beslutet gäller och ska byggas; **byggd** sätts först när koden finns och är verifierad. Numren följer frågorna i [docs/GRILL-HISTORIK.md](docs/GRILL-HISTORIK.md). Modellen och flödena som besluten ger står i [CONTEXT.md](CONTEXT.md).

| Nr | Titel | Beslut | Status |
|---|---|---|---|
| 1 | Namn och adress | `buildapp-se/flaskor`, live på `buildapp.se/flaskor`. `flaskkoll` och `vinrum` var lediga på .se och .com men valdes bort; `flaskor` valdes framför `bottles` för att gränssnittet är svenskt | beslutad |
| 2 | Användare och inloggning | Patrik och Julia, delad data. Grindkod i webbläsaren nu (kontrollerad i Workern), Firebase Auth senare. Repot publikt: innehållet är vilka viner som finns hemma | byggd (grindkoden; Firebase senare) |
| 3 | En modell, två flaggor | En tabell för vin och sprit, `kind` och `owned`. Fyra vyer ur samma data | byggd |
| 4 | Vad en rad är | Vin plus antal, som i Excel, plus fritextkommentar. Ingen per-flaska-modell. Inköpspris per rad; dagspris från källor är beslut 23 | byggd |
| 5 | Drickfönster | Finns, som egna fält med årsintervall, förifyllda av tumregel, visade som piller | byggd |
| 6 | Importvägar | Systembolagets artikelnummer och produktlänk. Excel-raderna läses in en gång som startdata. Caviste-import senare (backlog) | byggd (Systembolaget; Caviste-import senare) |
| 7 | Sipdeck-synk | Senare. Barskåpet mappas till Sipdecks ingrediens-id och skriver skafferiet via en knapp. Backlog | uppskjuten |
| 8 | Utseende | Ljust och luftigt, desktop och mobil lika viktiga. Designrunda i Claude Design före kod | byggd |
| 9 | Källarplats | Ingen | byggd |
| 10 | Stack | React + Vite + TypeScript strict, handskriven CSS med designtokens, ingen Tailwind. Next.js avvisat: serverrendering utan nytta och en Cloudflare-adapter. Vanilla som Sipdeck avvisat: CRUD-formulär växer otrevligt utan ramverk | byggd |
| 11 | Offline | Servern är sanningen, klienten cachar senaste hämtning, skrivningar kräver nät | byggd |
| 12 | Pillerlogik | grå vänta, grön drick, gul sista 12 månaderna, röd förbi, streckad okänt | byggd |
| 13 | Tumregeltabell | Kategori gånger prisband, från årgången, konstant i koden (tabellen i CONTEXT.md) | byggd |
| 14 | Sprit i barskåpet | Antal oöppnade plus en öppnad med nivå i fjärdedelar, plus/minus-knapp | byggd |
| 15 | Etikettskanning | Inte i v1: Systembolagets data saknar EAN, fotoskanning kräver AI-anrop. Hyllkantens nummer skrivs in. Backlog | uppskjuten |
| 16 | "Drack en" | Bara minska antalet, ingen ruta, inget betyg. Drucken-logg med betyg i backlog som påminnelse | byggd |
| 17 | Fälten från Excel | Källa (Systembolaget- eller CAV-nummer med länk), temp, karaffering, mat, inköpspris behålls. Blad 2 stryks | byggd |
| 18 | Språk | Svenska nu, engelska senare; alla strängar i en ordbok från dag ett | byggd |
| 19 | Designrundan | Alla vyer skissas i Claude Design från `docs/DESIGN-BRIEF.md`: Källaren desktop och mobil, Önskelistan, Barskåpet, Vindetalj, Lägg till, Köpt-rutan. Ändrat från fyra artboards 2026-09-05 på Patriks ord "skissa på allt" | byggd |
| 20 | Ramverk, omtag | Se 10. Påståendet att Rotello är det snyggaste projektet saknade belägg och drogs tillbaka; Sipdeck är referensen, och dess snygghet kom ur designprocessen, inte ramverket | byggd |
| 21 | Adress och hosting | Som Sipdeck: publikt repo, GitHub Pages på `buildapp.se/flaskor`, Worker `flaskor-api.buildapp.se` med D1 | byggd, live 2026-09-05 |
| 22 | Hushåll från dag ett | `household_id` på all data, ett hushåll nu | byggd |
| 23 | Uppdatering från Systembolaget | Nattligt cron plus knapp per rad. Dedupe per artikelnummer över hushåll och ett tak; vid många användare byts sidläsning mot sortimentsdumpen | byggd, cron overifierat i molnet |
| 24 | Startsida | Källaren med pillerfilter och "Dags att dricka: N"; mobil har Önskelistan ett tryck bort | byggd |
| 25 | Startdata | 21 Excel-rader läses in från den inklistrade texten, bilder från Caviste-sidornas og:image | byggd, seedat i molnet |
| 26 | Designbriefens grund | Syskon till Sipdeck i typografi och bakgrund, egen accent, inga illustrationer; Claude Design avgör detaljerna | byggd |
| 27 | PWA | Installerbar, cachar skalet och senaste listan | byggd, installation overifierad |
| 28 | Källarens ordning | Grupperad på kategori, sorterad på pris, bytbar sortering, sök och chips | byggd |
| 29 | Köpt från önskelistan | Ruta med antal och pris, raden flyttas | byggd |
| 30 | Antal noll | Stannar grå i ihopfälld sektion med "lägg på önskelistan igen" | byggd |

## Ändringar efter grillen

Begärda av Patrik i klartext 2026-09-06, inte grillade. Numren fortsätter serien.

| Nr | Titel | Beslut | Status |
|---|---|---|---|
| 31 | Filter och sortering | Chipraden får rubriken "Visa", sorteringen är select plus riktningspil, alla val sparas i `localStorage` | byggd |
| 32 | Totalpris | Antal gånger inköpspris (annars dagspris) i Källarens huvud, per kategori, i tabellens summarad och i sidofoten | byggd |
| 33 | Tabellvy | Excel-läget: platt lista över alla ägda viner, sorterbara kolumnrubriker, valbara kolumner, sidscroll. Listvyn är kvar som standard | byggd |
| 34 | Sök på mat | Sökningen träffar mat, kommentar och smak; träffen visas markerad under vinet | byggd |
| 35 | Vivino-betyg | Hämtas ur Vivinos söksida vid tillägg, via uppdatera-knappen och nattligt (30 dagar, tak 20). Första träffen om namnet stämmer till hälften. Länk till vinets sida | byggd, live |
| 36 | Barskåpet från Sipdeck | Skafferiet i Sipdecks D1 (`users.state.pantry`) seedas som sprit: spirits, liqueurs och bitters, antal 1 oöppnad. Patrik dumpade D1 själv och pekade ut sitt konto (id 1) | byggd, 18 rader i molnet |
| 37 | Streckkod och etikett | Uppskjutet: Systembolagets data saknar EAN, etikett kräver AI (beslut 15). Lager per butik kräver frontendnyckeln, backlog P3 | uppskjuten |
