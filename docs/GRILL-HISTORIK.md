# Grillhistorik

> **Historisk.** Grillningens frågeomgångar 2026-09-05, frusna. Besluten står i
> [GRILL-STATUS.md](../GRILL-STATUS.md) med samma nummer.

## Utgångsläget

Patriks vin-Excel: 21 rader, 25 flaskor, 8 345 kr, kolumnerna CAV-nummer, namn, årgång, antal kvar, pris, summa, typ, mat, land, drickes (årsintervall), temp, karafferas (h), länk. Alla rader från Caviste. Ett andra blad summerade antal kvar per Caviste-paket. Utöver det sparade listor på Systembolaget med både vin och sprit.

Önskemål: lägg in en flaska på önskelistan med Systembolagets artikelnummer eller länk, flytta den till källaren när den är köpt, samma för sprit i barskåpet, senare synk till Sipdecks skafferi. Ska se riktigt bra ut.

Research före grillen: [RESEARCH.md](RESEARCH.md).

## Omgång 1

- **Q1 Namn och adress.** Rek: `cellar`. Svar: föreslog `flaskkoll`, bad om lediga alternativ. Kontroll av .se (DNS) och .com (Verisign RDAP): `flaskkoll` och `vinrum` lediga på båda, `tappen` bara .se, `vinhyllan` och `barskapet` bara .com. Patrik landade i `buildapp.se/flaskor` eller `/bottles`; rek `flaskor`.
- **Q2 Vem använder den.** Rek: Patrik och Julia, Firebase som Beefcake. Svar: Firebase på sikt, enkel kod i webbläsaren nu; repot kan vara publikt.
- **Q3 Fyra hyllor eller två.** Rek: en modell, två flaggor. Svar: ja.
- **Q4 Vad är en rad.** Rek: vin + antal + drucken-logg. Svar: vin + antal räcker, kommentar är bra, inköpspris och dagspris på sikt.
- **Q5 Drickfönster.** Rek: eget fält plus tumregel. Svar: absolut, med gröna, gula och röda piller.
- **Q6 Importvägar.** Rek: Systembolaget nu, Excel en gång, Caviste senare. Svar: precis.
- **Q7 Sipdeck-synk.** Rek: knapp som skriver eget skafferi. Svar: senare, backlog.
- **Q8 Utseende.** Rek: mobil först, mörk. Svar: ljust och luftigt, desktop och mobil båda.
- **Q9 Källarplats.** Rek: ingen. Svar: nej.

Patrik la till: en sväng med Claude Design innan bygget.

## Omgång 2

- **Q10 Stack.** Rek: Preact + Vite + TS strict, Worker + D1. Svar: kör det som blir bäst och snyggast, TypeScript ska användas, Next.js?
- **Q11 Offline.** Rek: server sanning, klient cachar. Svar: ja.
- **Q12 Pillerlogik.** Rek: grå, grön, gul 12 månader, röd, streckad. Svar: ja.
- **Q13 Tumregeltabell.** Rek: kategori gånger prisband. Svar: ja.
- **Q14 Sprit.** Rek: oöppnade plus öppnad i fjärdedelar. Svar: (b), med enkel plus/minus-knapp.
- **Q15 Etikettskanning.** Rek: skippa, skriv numret. Svar: backlog.
- **Q16 Drack en.** Rek: ruta med datum, betyg, kommentar. Svar: nej, bara minska; backlog som påminnelse.
- **Q17 Fälten från Excel.** Rek: behåll alla, stryk blad 2. Svar: ja.
- **Q18 Språk.** Rek: bara svenska. Svar: svenska nu, engelska sen.
- **Q19 Designrundan.** Rek: fyra artboards. Svar: bra.

## Omgång 3

Namnfrågan: rek `flaskor` framför `bottles` eftersom gränssnittet är svenskt.

- **Q20 Stack igen.** Rek: Rotello-stacken (React + Vite + Tailwind), med påståendet att Rotello är det snyggaste projektet. Svar: vad baseras det på, Sipdeck är snyggast.
- **Q21 Adress.** Rek: Worker-route på `buildapp.se/flaskor`. Svar: gör som Sipdeck och alla andra (GitHub Pages user-site-tricket).
- **Q22 Hushåll från dag ett.** Rek: ja. Svar: ja.
- **Q23 Uppdatering från Systembolaget.** Rek: nattligt cron plus knapp. Svar: ja om det funkar med många användare. Villkor: dedupe per artikelnummer, tak, byt till sortimentsdumpen vid tillväxt.
- **Q24 Startsida.** Rek: Källaren med piller. Svar: håller med.
- **Q25 Startdata.** Rek: bilder från Caviste. Svar: okej.

## Omgång 4

Påståendet om Rotello drogs tillbaka: inget belägg, Sipdeck är byggt utan ramverk och dess snygghet kom ur en designsession med skriven brief. Slutsats: kopiera Sipdecks process, inte kodstil.

- **Q20 igen Ramverk.** Rek: React + Vite + TS strict, handskriven CSS, ingen Tailwind; Next.js och vanilla avråds. Svar: okej.
- **Q26 Designbriefens grund.** Rek: syskon till Sipdeck i typografi och bakgrund, egen accent, inga illustrationer. Svar: låter bra, låt Claude Design avgöra.
- **Q27 PWA.** Rek: ja. Svar: ja.
- **Q28 Källarens ordning.** Rek: kategori, pris, sök, chips. Svar: ja.
- **Q29 Köpt.** Rek: ruta med antal och pris. Svar: ja.
- **Q30 Antal noll.** Rek: grå i ihopfälld sektion. Svar: okej.

Frontier tom. Repot skapades direkt efter.
