# Grillstatus

## Beslutsregister

Status per 2026-09-05, före första kodraden. **beslutad** betyder att beslutet gäller och ska byggas; **byggd** sätts först när koden finns och är verifierad. Numren följer frågorna i [docs/GRILL-HISTORIK.md](docs/GRILL-HISTORIK.md). Modellen och flödena som besluten ger står i [CONTEXT.md](CONTEXT.md).

| Nr | Titel | Beslut | Status |
|---|---|---|---|
| 1 | Namn och adress | `buildapp-se/flaskor`, live på `buildapp.se/flaskor`. `flaskkoll` och `vinrum` var lediga på .se och .com men valdes bort; `flaskor` valdes framför `bottles` för att gränssnittet är svenskt | beslutad |
| 2 | Användare och inloggning | Patrik och Julia, delad data. Grindkod i webbläsaren nu (kontrollerad i Workern), Firebase Auth senare. Repot publikt: innehållet är vilka viner som finns hemma | beslutad |
| 3 | En modell, två flaggor | En tabell för vin och sprit, `kind` och `owned`. Fyra vyer ur samma data | beslutad |
| 4 | Vad en rad är | Vin plus antal, som i Excel, plus fritextkommentar. Ingen per-flaska-modell. Inköpspris per rad; dagspris från källor är beslut 23 | beslutad |
| 5 | Drickfönster | Finns, som egna fält med årsintervall, förifyllda av tumregel, visade som piller | beslutad |
| 6 | Importvägar | Systembolagets artikelnummer och produktlänk. Excel-raderna läses in en gång som startdata. Caviste-import senare (backlog) | beslutad |
| 7 | Sipdeck-synk | Senare. Barskåpet mappas till Sipdecks ingrediens-id och skriver skafferiet via en knapp. Backlog | uppskjuten |
| 8 | Utseende | Ljust och luftigt, desktop och mobil lika viktiga. Designrunda i Claude Design före kod | beslutad |
| 9 | Källarplats | Ingen | beslutad |
| 10 | Stack | React + Vite + TypeScript strict, handskriven CSS med designtokens, ingen Tailwind. Next.js avvisat: serverrendering utan nytta och en Cloudflare-adapter. Vanilla som Sipdeck avvisat: CRUD-formulär växer otrevligt utan ramverk | beslutad |
| 11 | Offline | Servern är sanningen, klienten cachar senaste hämtning, skrivningar kräver nät | beslutad |
| 12 | Pillerlogik | grå vänta, grön drick, gul sista 12 månaderna, röd förbi, streckad okänt | beslutad |
| 13 | Tumregeltabell | Kategori gånger prisband, från årgången, konstant i koden (tabellen i CONTEXT.md) | beslutad |
| 14 | Sprit i barskåpet | Antal oöppnade plus en öppnad med nivå i fjärdedelar, plus/minus-knapp | beslutad |
| 15 | Etikettskanning | Inte i v1: Systembolagets data saknar EAN, fotoskanning kräver AI-anrop. Hyllkantens nummer skrivs in. Backlog | uppskjuten |
| 16 | "Drack en" | Bara minska antalet, ingen ruta, inget betyg. Drucken-logg med betyg i backlog som påminnelse | beslutad |
| 17 | Fälten från Excel | Källa (Systembolaget- eller CAV-nummer med länk), temp, karaffering, mat, inköpspris behålls. Blad 2 stryks | beslutad |
| 18 | Språk | Svenska nu, engelska senare; alla strängar i en ordbok från dag ett | beslutad |
| 19 | Designrundan | Fyra artboards: Källaren desktop, Önskelistan mobil, Vindetalj, Lägg till på mobil | beslutad |
| 20 | Ramverk, omtag | Se 10. Påståendet att Rotello är det snyggaste projektet saknade belägg och drogs tillbaka; Sipdeck är referensen, och dess snygghet kom ur designprocessen, inte ramverket | beslutad |
| 21 | Adress och hosting | Som Sipdeck: publikt repo, GitHub Pages på `buildapp.se/flaskor`, Worker `flaskor-api.buildapp.se` med D1 | beslutad |
| 22 | Hushåll från dag ett | `household_id` på all data, ett hushåll nu | beslutad |
| 23 | Uppdatering från Systembolaget | Nattligt cron plus knapp per rad. Dedupe per artikelnummer över hushåll och ett tak; vid många användare byts sidläsning mot sortimentsdumpen | beslutad |
| 24 | Startsida | Källaren med pillerfilter och "Dags att dricka: N"; mobil har Önskelistan ett tryck bort | beslutad |
| 25 | Startdata | 21 Excel-rader läses in från den inklistrade texten, bilder från Caviste-sidornas og:image | beslutad |
| 26 | Designbriefens grund | Syskon till Sipdeck i typografi och bakgrund, egen accent, inga illustrationer; Claude Design avgör detaljerna | beslutad |
| 27 | PWA | Installerbar, cachar skalet och senaste listan | beslutad |
| 28 | Källarens ordning | Grupperad på kategori, sorterad på pris, bytbar sortering, sök och chips | beslutad |
| 29 | Köpt från önskelistan | Ruta med antal och pris, raden flyttas | beslutad |
| 30 | Antal noll | Stannar grå i ihopfälld sektion med "lägg på önskelistan igen" | beslutad |
