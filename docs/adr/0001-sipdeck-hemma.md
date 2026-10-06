# ADR 0001: Flaskor och Sipdeck, valfri koppling för Hemma

Datum: 2026-10-04. Status: accepterat av Patrik. Byggt och lokalt verifierat 2026-10-06 på grenarna
`feat/sipdeck-koppling` (Flaskor) och `feat/hemma-flaskor` (Sipdeck); inte i produktion. Hur det byggdes står i
§Genomförande sist, läget och utrullningsplanen i Flaskors HANDOFF.md.
Ersätter beslut 7 i GRILL-STATUS.md. Gemensam specifikation för båda projekten;
Sipdeck länkar hit. Arbetsstatus finns i respektive BACKLOG.md och HANDOFF.md.

## Beslut och bakgrund

Två självständiga appar med valfri koppling. Flaskor ansvarar för hushållets flaskor,
antal och öppnad mängd. Sipdeck ansvarar för recept och manuella ingredienser.
Behåll befintliga stackar. Duplicera inte hela funktioner och bygg inte en ny central
backend eller gemensam inloggningsmigrering som förutsättning.

Sipdeck förblir internationellt och fungerar utan Flaskor och utan konto. Flaskor
förblir Sverige-fokuserat. Klassificeringen är landsoberoende: Systembolagets id är
extern produktreferens, inte ingrediensidentitet. Engelska i Flaskor, fler valutor
och internationella butikskataloger ingår inte i denna leverans.

Analysen fann 95 recept och 152 ingrediensposter i lokal katalog. Körda kontroller
visade att dagens exakta id-matchning nekar Margarita med Cointreau i stället för
triple sec och Mojito med myntablad i stället för myntakvist, trots övriga ingredienser.
Separera inventering från receptens precisa formuleringar. Behåll receptens
mängder, beredningsformer, källor och valfria garneringar.

## Ingrediensmodell

- Produkt: faktisk namngiven flaska eller vara.
- Inventarieingrediens: det användaren har, exempelvis mynta eller hel lime.
- Receptkrav: ingrediens, beredningsform och eventuell specifik produkt.
- Uppfyller: granskad riktad relation, exempelvis Cointreau till triple sec.
- Kan beredas till: riktad relation, exempelvis hel lime till juice eller klyfta.
- Kan ersätta: separat receptberoende alternativ med synlig förklaring, som inte
  tyst räknas som originalreceptets ingrediens.
- Tillgänglighetskälla: manuell markering eller viss kopplad Flaskor-rad.

Limejuice ger inte skal. Generisk triple sec ger inte Cointreau. Söt/torr/blanc
vermouth, olika Chartreuse och romstilar slås inte ihop på namnlikhet. Granska
relationerna och testa skillnaderna. Bevara okända produkter och egna ingredienser
utan gissad matchning. Gemensamma begrepp och regler ska ha en ägare och ett
versionsstyrt kontrakt, inte två handredigerade kopior som driver isär.

## Gränssnitt

Sipdecks Skafferi blir Hemma (At home), med Barskåp och Övriga ingredienser. Visa
innehavet först; lägg till med sökning och grupperade val, behåll bläddring bland
alla ingredienser. Samla beredningsformer under råvaran. Sök på produktnamn och
svenska/engelska ingrediensnamn. Bevara gamla djuplänkar.

Anslut Flaskor är valfritt. Visa hushåll, kopplingsstatus, senaste lyckade uppdatering,
Uppdatera och Koppla från. Kända produkter får granskad klassificering; osäkra
produkter kräver användarens val. Klassificering kan rättas. Märk Från Flaskor och
förklara varför en produkt ger en ingrediens. Manuella markeringar hanteras separat.

Flaskor får Se drinkar med det här i Sipdeck med fungerande kontextlänk. Kortlek,
detaljvy, saknas-listor, Nästan klart och räknare använder samma matchningsregler;
egna drinkar fortsätter fungera. Du har ingredienserna lovar inte att mängden räcker
till ett visst antal portioner.

## Synk och ansvar

Enkelriktat: Flaskor till Sipdeck. Tillgängligt är `owned` och antingen `count > 0`
eller kvarvarande `open_level`. Önskelista och slut räknas inte. Relevanta flaskor
från Källaren omfattas också, exempelvis vin och bubbel; filtrera inte bara spirit.

Manuella och importerade bidrag hålls isär. Två ginflaskor ger gin tills båda är slut.
En manuell ginmarkering överlever att Flaskors bidrag försvinner. Radering,
omklassificering och frånkoppling påverkar bara berörda bidrag. En generell union
får inte återuppliva borttagna importerade bidrag.

Hämta vid öppning av Hemma och med knapp, med rimlig cache, utan pollningsloop eller
nytt cronjobb. Nätfel är inte tomt inventarium: visa senaste godkända snapshot som
inaktuellt vid tillfälliga nätfel. Bekräftat återkallad behörighet tar bort bidrag och
känslig cache. Försenade svar får inte återställa en gammal koppling efter byte.

Ingen automatisk förbrukning vid receptöppning, portionsval eller avbockning. Ingen
överföring av priser, avsmakningar eller privata anteckningar behövs. Flaskor får
inte skriva över hela Sipdecks state-blob.

## Kontokoppling och kompatibilitet

Projekten har separata Firebase-projekt. Kräv verifierad inloggning på båda sidor
och uttrycklig koppling av Sipdeck-konto till Flaskor-hushåll. Samma e-post eller uid
är inte tillräckligt. Kontrollera issuer/audience och aktuell hushållsbehörighet
server-side; klientens hushålls-id är ingen behörighet.

Utgångspunkt: högst ett aktivt hushåll per Sipdeck-konto. Flera medlemmar kan koppla
sina egna Sipdeck-konton till samma hushåll. Favoriter, inställningar och manuella
ingredienser förblir personliga. Hushållsbyte, utträde, kontoradering, frånkoppling
och byte av inloggad användare hanteras utan läckor. Välj minsta säkra protokoll;
engångskoder, om de används, kräver utgångstid och skydd mot återanvändning.
Använd inte tjänstenyckeln som användarkoppling.

Migrera lokalt och synkat skafferi utan förlust av markeringar, egna ingredienser,
favoriter eller inställningar. Versionsstyrd, idempotent migrering. Testa utloggad
redigering följd av inloggning och två enheter med samtidiga ändringar/borttagningar.
Gamla klienters whole-state PUT får inte radera ny data: välj kompatibelt separat
lagringskontrakt eller neka osäkra gamla skrivningar med begriplig uppdateringsväg.

## Leveransordning och acceptans

1. Ingrediensmodell, matchning och migrering.
2. Hemma-gränssnitt.
3. Valfri koppling med produktgranskning, källspårning och kontextlänk.
4. Inköpshjälp: vilka saknade ingredienser öppnar fler favoritdrinkar, med svensk
   Systembolagsväg när användaren valt Sverige. Språk och inköpsland är separata.
   Generisk ingrediens blir inte en bestämd produkt på önskelistan utan produktval.

Verifiera särskilt Cointreau/triple sec i båda riktningar, mynta blad/kvist, hel
lime kontra juice, verkliga skillnader och valfri garnering; två flaskor/sista slut,
vin, önskelista och omklassificering; manuella bidrag efter frånkoppling; nätfel,
återkallad behörighet, gamla svar, hushålls-/kontobyte och kontoradering; två hushåll
utan dataläckor, fel projekt-token; migrering två gånger, gamla klienter och
tvåenhetskonflikter; egna drinkar; inköpshjälp med samma matchningsregler.

Kör aktuella tester, typkontroller, byggkommandon och browserflöden på mobil/desktop,
SV/EN, gästläge och kopplat läge. Bevisa migreringar lokalt med testdata. Ingen
produktionsdump, massklassificering eller sortimentsimport krävs för utvecklingen.
Redovisa riktig inloggning och annan kvarvarande ägar-QA separat från verifierat.

## Mandat och publicering

Detta är godkänt produktbeslut och underlag till en ny byggsession, ingen genomförd
kodändring. Den nya sessionens användarprompt ger mandat för nödvändiga ändringar,
tester och lokala migreringar i båda repona. Säkerhetsgrindar för hemligheter,
destruktiva operationer, kvotförbrukning och produktion gäller fortfarande.
Sipdeck har riktiga användare: ingen merge till main eller produktionsdeploy utan
separat godkännande. Leverera granskbar gren/PR, verifiering och konkret
migrations-/utrullningsplan före godkännandet.

## Genomförande (2026-10-06)

Teknikvalen som inte är självklara. Varje val är det minsta som håller kraven ovan.

**En ägare per begrepp.** Sipdeck äger ingredienserna, relationerna och vad en produkt räknas som
(`drinks.json`: fälten `form`, `madeFrom`, `metBy`, `swap` och `shelf` på ingrediensen, listan `products` med
produktreglerna). Flaskor äger flaskorna och ett versionsmärkt läskontrakt (`SIPDECK_CONTRACT` i
`shared/types.ts`, version 1). Flaskor klassificerar ingenting: det hade gett två kopior av samma regler.

**Relationerna sitter på kravet och pekar en väg.** `form`: kravet är bara en beredning (myntablad av mynta)
och ägs aldrig för sig. `madeFrom`: kan ägas (köpt juice) och beredas ur råvaran, aldrig tvärtom. `metBy`: en
mer specifik produkt uppfyller kravet (Cointreau för triple sec). `swap`: ersättning med förklaring på båda
språken, visas men räknas aldrig som att ingrediensen finns. Just nu finns en enda `metBy`. En funktion
(`coverage` i Sipdecks `app.js`) svarar för kortlek, detaljvy, saknas-märken, Nästan klart, räknare, egna
drinkar och inköpshjälp.

**Migreringen är en bro, inte en engångskörning.** Den gamla listan `pantry` lämnas orörd i state-bloben.
Nya nyckeln `home` bär manuellt innehav (`have`) och den senast inlästa pantrylistan (`seen`). `bridgeHome`
för in skillnaden mellan `pantry` och `seen`: två körningar ger samma resultat, och en gammal klient som
fortfarande ändrar `pantry` följs. Den befintliga trevägsmergen används för `have`, `seen` och valen.

**Gamla klienter.** En klient från före `home` tappar nyckeln och skriver tillbaka bloben utan den. Sipdecks
Worker bär då vidare den lagrade `home` (`PUT /state`). Därför ska Sipdecks Worker ut före Sipdecks frontend.

**Ingen ny backend och ingen gemensam inloggning.** Sipdeck-klienten anropar Flaskors Worker direkt med sitt
eget Sipdeck-ID-token. Flaskor verifierar det mot Firebase-projektet `sipdeck` (issuer och audience) på
`/api/sipdeck/link` och `/api/sipdeck/bottles` och ingen annanstans. Ett Flaskor-token duger inte där, ett
Sipdeck-token duger inte någon annanstans, och tjänstenyckeln ger varken eller.

**Kopplingen.** En inloggad medlem skapar en engångskod (128 bitar, bara SHA-256-hashen sparas, tio minuter,
raderas i samma SQL-fråga som läser den). Koden reser i adressens fragment och bekräftas av den inloggade i
Sipdeck. `sipdeck_link` har Sipdeck-uid som unik nyckel (högst ett hushåll per konto) och minns medlemmen som
gav kopplingen. Vid varje läsning kontrolleras att den medlemmen fortfarande hör till hushållet, annars
raderas kopplingen och svaret är `revoked`. Hushållsbyte, utträde och raderat konto tar medlemmens kopplingar
och koder med sig. Sipdeck-token behöver inte bekräftad e-post: adressen ger ingen behörighet, koden gör det.

**Importerade bidrag lagras aldrig som markeringar.** Flaskorna är en cachad ögonblicksbild per inloggat
konto i webbläsaren (`sipdeck-flaskor`), aldrig i den synkade bloben. Innehavet räknas fram ur manuella
markeringar plus ögonblicksbilden, så ingen union kan återuppliva en flaska. Användarens egna val per produkt
(`home.picks`, nyckel `sb:<artikelnummer>` eller `fl:<rad-id>`) och flaggan `home.flaskor` synkas.

**Nätfel, återkallelse och sena svar.** Bara svarskoderna `revoked` och `not_linked` tar bort cachen. Allt
annat (nätfel, 5xx, 429, 401) behåller senaste bilden och märker den som inaktuell. En epokräknare höjs vid
frånkoppling och kontobyte; ett svar från en äldre epok kastas. Hämtning sker när Hemma öppnas och på knapp,
annars högst var femte minut, utan pollning.

**Kontextlänk och inköpsväg.** `#/med/<fält>` i Sipdeck klassificerar flaskan med samma regler och fungerar
utloggad. Inköpshjälpen länkar till Flaskors sök (`#/lagg-till?q=`), där produkten väljs före önskelistan.
Inköpsland (`home.country`) är skilt från språket.
