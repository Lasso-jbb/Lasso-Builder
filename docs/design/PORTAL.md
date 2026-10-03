# Portalens ramme

Rammen om modulerne på `/portal`: topbjælke, skinne, åbne faner, modulrække og spørgefelt. Modulerne i midten
er beskrevet under Moduler; her står kun rammen. Designet kommer fra prototypen `lasso-portal4.html`, og koden er
`apps/view/src/portal2/` (`Portal2App.tsx`, elementerne i `parts.tsx`, stilen i `portal2.css`). Designguidens side "Portalens ramme" viser den kørende
portal, så det, der står her, og det, man ser, er det samme. Den klassiske portal (tavle 06, AppShell)
står på `/portal/klassisk` og videreudvikles ikke.

## Opbygning

| Del | Desktop (over 760 px) | Telefon (760 px og derunder) |
|---|---|---|
| Topbjælke | 56 px, rammegrå (`--frame`), navnelogo 90 × 26, søgefeltet, tema, notifikationer, profil | Altid samlet: logo 59 × 17, de åbne faner, og tema, notifikationer og profil som små ikoner (18 px, 30 px brede knapper) |
| Søgefelt | Pille 36 px, højst 720 px; flugter med indholdets venstre kant, når en fane er åben | Søgning i fuld skærm fra bundbjælken |
| Skinne | 60 px, ikoner 20 px, tooltip til højre; det øverste ikon flugter med modulrækken | Skjult |
| Åbne faner | 44 px bjælke, fane 36 px, radius 10 foroven; flere faner har ens bredde, højst 170 px (en enkelt fane højst 280 px) | I topbjælken (ingen egen bjælke) |
| Modulrække | 52 px, står fast over indholdet (ruller og "bouncer" ikke med); Lasso-mærket først (altid slået til, ink med koral streg, navnet "Lasso"), modulerne, egne sider som moduler, "Flere", Følg og Gem | 48 px |
| Indhold | Kolonne på højst 1200 px med 40 px sideluft | 28 px sideluft til venstre (`--gut`), 18 px til højre |
| Spørgefelt | Pille 52 px, højst 720 px, centreret nederst med tre forslag (se `CHAT.md`) | Lasso-knappen (52 px) i bundbjælken åbner feltet; 48 px lige over bundlinjen, når Lasso-modulet er aktivt |
| Bundbjælke | – | Lasso-knap til venstre, kapsel 158 × 52 med Søg, Værktøjer, Lister |

## Topbjælke og søgning

- Søgningen er Lassos navnesøgning (`GET /api/portal/lookup`), ikke AI. Den søger mens man skriver (fra 2 tegn).
- Resultaterne har fanerne Firmaer og Personer med antal (portalen henter højst 20 pr. type; et CVR-nummer søger kun firmaer) og et statusfilter for
  firmaer (Aktive, Inaktive, Alle). Det søgte står med fed i navnet, et inaktivt firmas status står lige efter
  navnet, og under navnet by og CVR.
- Et firma har genveje, når rækken er valgt: åbn direkte i Økonomi, Ejerskab eller Historik.
- Tastatur: pil op/ned vælger, Enter åbner, Tab skifter mellem Firmaer og Personer, Esc lukker, `/` sætter fokus.
- Uden tekst viser feltet de seneste (gemt i browseren, højst 8, "Ryd"). Uden match står "Spørg Lasso om …",
  som sender teksten til chatten.
- "Se alle firmaer for …" åbner den fulde søgning som en fane.

## Skinnen

Værktøjer (forsiden) og Lister (gemte sider) virker. Handlinger, Profil, Abonnement, Integrationer, Firma,
Moduler og Brugere står dæmpet, til de findes.

## Åbne faner

- Hvert åbnet firma, person og resultat er en fane med navn og luk-kryds. Tooltippet viser by og CVR (åbnet fra
  søgningen) eller adresse, CVR, telefon og web (fra siden); for en person byen; et resultat har intet tooltip.
- Er der mere end én fane, har alle samme bredde: pladsen delt ligeligt, højst 170 px og mindst 120 px. Navnet bruger hele bredden;
  krydset står yderst til højre (på inaktive faner lægger det sig over navnets ende ved hover). Er der ikke plads til alle i 120 px, skjules de ældste inaktive bag "Flere ▾" (med luk pr. række og
  "Luk alle andre faner"). Står kun den aktive tilbage, bliver den selv en dropdown med alle åbne.
- Lukker man en fane med krydset, holdes bredden, så længe musen er over fanebjælken: næste fanes kryds står
  samme sted, så man kan lukke flere i træk uden at flytte musen. Når musen forlader bjælken, fordeles pladsen igen.
- Midterklik lukker en fane. Lukkes den aktive, bliver naboen til venstre aktiv.
- Henter Lasso til en fane, står Lasso-mærket i fanen og bevæger sig.

### Fastgjorte faner (Jakob 03.10)

- En fane kan fastgøres og frigøres med nålen i fanen (står ved hover og tastaturfokus; `aria-pressed`) og med nålen ud
  for fanen i menuerne ("Flere" og telefonens fanemenu). Nålen er neutral (sekundær tekstfarve), ikke skabelon-
  modulernes røde nål, som er noget andet.
- Fastgjorte faner står først i bjælken (i den rækkefølge, de blev fastgjort), viser altid nålen og har intet kryds
  (heller ikke midterklik eller i menuen): man frigør først. "Luk alle andre faner" beholder dem. Mangler der plads,
  skjules de sidst.
- Fastgørelsen gemmes med fanerne i browseren (cachen v2, `OpenItem.pinned`) og overlever en genindlæsning.

## Modulrækken

- Først Lasso-mærket: modulet med samtalen (`docs/design/CHAT.md`). Det er altid slået til, også før der er et svar,
  og aktivt står det i ink med en koral streg under ("inset 0 -2px 0 primary"). Navnet er "Lasso", og mærket
  bevæger sig, mens der hentes. Klikker man over på et modul og tilbage, står samtalen som man forlod den.
- Derefter modulerne (fokus) i fast rækkefølge: Overblik, Økonomi, Regnskab, Ejerskab, Risiko, Historik, Kontakt
  for firmaer; Overblik, Roller, Netværk, Ejerskab, Risiko, Historik for personer. De hentes uden AI. En global
  fane (forside eller resultat) viser kun Lasso-modulet.
- Til sidst brugerens sideskabeloner for slagen: "Tilføj som fane" på en side, chatten har sat sammen om én
  virksomhed eller person, gemmer siden som et ekstra modul, der står på alle virksomheder (eller personer) og
  vises med den enheds data (nøgle `tpl:<id>`, `moduleTabs` i `model.ts`). På et skabelonmodul står en rød pin
  ("tilføjet på alle virksomheder/personer"); et klik giver bekræftelsen "Fjern modulet?" ("KYC-overblik fjernes fra
  alle virksomheder. Det kan ikke fortrydes.", Annuller / Fjern) og fjerner skabelonen overalt. De indbyggede moduler
  har ingen pin. Se `CHAT.md`, "Sideskabeloner og den røde pin".
- Mangler der plads, skjules moduler fra højre bag "Flere ▾"; er der plads til færre end to, bliver rækken en
  vælger med det aktive modul.
- Til højre Følg (kommer senere) og Gem (gemmer siden på brugerens liste).
- Navnet står i fanen, ikke over modulrækken; modulernes eget hoved udelades i portalen.
- Ingen koral fokusramme på faner og modulfaner; tastaturfokus vises som en svag baggrund.

## Spørgefeltet (chatten)

- Feltet sender til `/api/chat` (Claude med samme værktøjer som MCP). Pladsholderen er altid "Spørg Lasso", og
  feltet har enter-ikonet; mens et svar hentes, er det slået fra (ingen Stop, Jakob 03.10).
- De tre forslag under feltet følger siden: forsiden, et resultat, eller firmaets/personens modul (fx Ejerskab giver
  spørgsmål om ejere og datterselskaber). De står i `suggestions()` i `model.ts`.
- Samtalen (tråden, svarformerne, placeringen af svaret, afklaringspanelet, tilstandene og mobilen) er beskrevet i
  `docs/design/CHAT.md`; hvordan serveren og klientens tråde virker (`place_answer`, frisk historik, Fortryd,
  cache) i `docs/chat.md`. Samtalen gemmes kun i browseren.

## Telefon

- Skinne, søgefelt og spørgefelt skjules; bundbjælken tager over.
- Topbjælken står altid i den samlede form: det lille logo, de åbne faner (den aktive, med "Flere" eller som
  dropdown, når der ikke er plads) og tema, notifikationer og profil som små ikoner tæt sammen, altid til højre (også uden åbne faner). Der er ingen
  fanebjælke under topbjælken, og den klapper ikke sammen ved rulning.
- Topbjælkens bund flugter: bunden af logoet, tekstens grundlinje og ikonernes bund står på samme linje, og der er
  lige langt (20 px) fra logo til navn som fra pilen til det første ikon. Målt i browseren; justeres med
  `--text-dy`, `--icon-dy` og `--icon-dx` i `portal2.css`, hvis skrift eller ikoner skiftes.
- Siden selv ruller ikke (ingen bounce bag portalen); kun indholdet ruller, og topbjælke og modulrække står fast.
- Modulrækken bliver en vælger, når modulerne ikke kan stå ved siden af hinanden.

## Rulning og bounce (alle bredder)

- Kun indholdet ruller; topbjælke, fanebjælke og modulrække står fast. På desktop får modulrækken en skygge, når
  indholdet er rullet (sat direkte på roden, så rulning ikke gentegner portalen).
- Safari og alle browsere på iPhone og iPad (WebKit) bouncer selv. I andre browsere på computer (Chrome, Edge,
  Firefox) laver portalen bouncen (`elastic.ts`) ud fra hjul- og trackpad-hændelser, med én elastik: rulning ud
  over toppen eller bunden strækker den med stigende modstand (højst 72 px), og hvert billede trækker den tilbage
  mod 0 (tidskonstant 55 ms, på plads på ca. 0,3 s). Den bliver stivere, jo længere en bevægelse trykker på kanten,
  så trackpaddens efterløb ikke holder den ude. Ruller man den anden vej, mens den er strakt, tager elastikken
  rulningen først.

## Tema

Lys og mørk med samme tokens som prototypen (står øverst i `portal2.css` og vises på designguidens side).
Valget huskes i browseren. `?tema=dark` i adressen sætter temaet uden at gemme det.

## Adresser

- `/portal?aaben=CVR-1-…,CVR-3-…&fane=oekonomi` åbner fanerne (den sidste er aktiv) på et modul.
- `?soeg=Eksempel` åbner søgningen med teksten (på telefon i fuld skærm).
- `?spoerg=1` åbner spørgefeltet på telefon.
- `?tema=dark|light` sætter temaet uden at gemme det.
- `?aabn=<Lasso-ID>&fokus=<fokus>&fastgoer=1` (MCP-appens "Åben i Lasso", Jakob 03.10) åbner eller aktiverer fanen
  for virksomheden eller personen på modulet (ukendt fokus: Overblik) og fastgør den med `fastgoer=1`. Er fanen
  allerede åben (også fra cachen), bruges den; der kommer aldrig to. Bagefter fjernes parametrene fra adressen
  (`history.replaceState`), så en genindlæsning ikke åbner igen; uden login bliver de stående, til man er logget ind.

Designguiden bruger adresserne til sine rammer.

## I designguiden

Siden "Portalens ramme" har fire dele, og alle læser fra portalens egen kode:

1. **Den kørende portal** i 1440, 1000 og 390 px.
2. **Elementer og knapper** i alle tilstande (`parts.tsx`; telefonens topfane `TopTab` vises i de live udsnit). Det dækker topbjælke, søgefelt, søgeresultater (med
   status efter navnet), åbne faner (også mange med ens bredde), modulrække og modulvælger, menuer, ikonknapper og
   skinne, spørgefelt, forslag pr. side (læst fra `suggestions()`), forside, Lasso-fanen i modulrækken (også med skabelonmodul og rød pin),
   besked, bundbjælke og alle ikoner.
3. **Telefon og søgning, live:** udsnit af den kørende portal. Det er topbjælken med og uden faner,
   modulrækken, bundbjælken, det åbne spørgefelt, søgningen i fuld skærm og søgningen på desktop.
4. **Farver og mål** læst fra `portal2.css`.

Chatten har sin egen side, "Chatten" (`pages/Chat.tsx`): de rigtige trådkomponenter med eksempeldata i fire bredder,
de femten regler fra `CHAT.md`, `--chat-*`-tokens og Paper-eksporten i en ramme.

Et nyt element i portalen bygges i `parts.tsx` og tilføjes som eksempel i `designguide/pages/PortalParts.tsx`.
