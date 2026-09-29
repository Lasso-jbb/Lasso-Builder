# Bredde-måling med realistiske data (A13, Ø13)

Målt 2026-09-29 med `tools/gallery/measure/measure-realistic.mjs` (Playwright, Chromium, 1200-viewport, 12-kolonne-gitter). Data: `tools/gallery/measure/realistic.ts`. Rå tal: `tools/gallery/measure/widths-realistic.json`. Forslagene ændrer hverken GRID_RULES eller registeret; de er input til B8. Kør igen: 'npx tsx tools/gallery/measure-realistic-build.ts <mappe>', 'node tools/gallery/measure/measure-realistic.mjs <mappe>' (kræver 'PLAYWRIGHT_MODULE', hvis 'playwright' ikke kan importeres), 'npx tsx tools/gallery/measure/report-realistic.ts'.

## Sådan er der målt

- **Realistisk datasæt** (`realistic.ts`): selskabsnavne på 35–45 tegn (fx "Nordjysk Entreprenør- og Ejendomsselskab ApS"), personnavne på 25–35 tegn, PersonNetwork med 6 personer à 3 fælles selskaber (3 rækker pr. person) fra 2011 til 2026, 10 år på alle tidsakser og regnskaber, tal i mia./mio. (omsætning ca. 1,5 mia. kr.), 5–12 rækker i lister, 6 virksomheder i CompareTable og Ranking, 10 rækker i tabeller. Demodataens form er genbrugt (DemoProvider + resolveSpec), så komponenterne tager imod det uden ændrede props.
- **Bredder**: elementet står alene i sit bånd sammen med et skjult fyldelement (ellers bliver det fuld bredde, 23.1), i dashboard-layout, så cellen har samme container som på en rigtig side. Cellebredder i px: ¼ = 270, ⅓ = 368, ½ = 564, ⅔ = 760, ¾ = 858, 1/1 = 1152 (målt i båndet: ¼ = 282, ⅓ = 376, ½ = 564, ⅔ = 752, ¾ = 846, 1/1 = 1152; bånd har 20 px mellemrum, derfor er bredderne lidt over gitterets 24 px-mellemrum).
- **Højde (px)**: elementets højde i cellen.
- **Afkortninger**: antal elementer med aktiv `text-overflow: ellipsis` (scrollWidth > clientWidth) eller aktiv linje-klipning (line-clamp).
- **Overlap**: antal par af tekstbokse (fra hver tekstnodes linjerektangler) fra forskellige elementer, hvis overlap er over 8 px², fx årstal på en tidsakse.
- **Tom plads (%)**: indholdet (tekstbokse, figurer, fyldte bjælker og tabelceller) grupperes i rækker (10 px-bånd). Tre mål pr. bredde: (a0) **bredeste række** (opgavens definition): 100 % minus samlet indholdsbredde i den mest dækkede række / cellens bredde; (a) **de bredeste rækker**: det samme for 75-percentilen af rækkerne (en enkelt lang kapitaltekst i en nøgle/værdi-liste gør ellers en tom liste "fuld"); (b) **typisk række**: medianen over rækkerne af rækkens største sammenhængende tomme stykke (også til højre for det yderste indhold). (a) overvurderer tomhed i jævnt fordelte kort, (b) tæller tid før en tidsakses bjælke som tom; derfor er **tom plads = det mindste af (a) og (b)**, og det er tallet i tabellerne og det, reglerne bruger (smal: max ≤ ½ hvis > 40 % i ⅔+). Alle mål og **til højre** (andel til højre for det yderste indhold) står i de enkelte typers tabeller og i JSON'en.
- **Vandret rulning / klippet**: målt, men står kun i JSON'en og i tekstlinjerne, hvor det forekommer.

Tabellernes format pr. bredde er `højde / afkortninger / overlap / tom plads %`. *Kursiv* = bredde uden for typens nuværende min-max (målt for at se, hvad der sker; det inkluderer ét trin under min).

## Sammenfatning

- **Målt**: 58 rækker (54 komponenttyper; regnskabslisten og PersonRoles' tre listevarianter har egne rækker), hver i alle seks bredder.
- **Top 10 med afkortning/overlap/klipning/vandret rulning i deres nuværende min** (rangeret efter merforbrug i forhold til fuld bredde, uden fastbredde-typerne): LassoPersonNetwork (min ½: 8 afkortet, 0 overlap); LassoNews (min ⅓: 5 afkortet, 0 overlap); LassoMultiYearTable (min ½: 0 afkortet, 0 overlap, vandret rulning); LassoProperties (min ⅓: 0 afkortet, 0 overlap, vandret rulning); LassoAnnouncements (min ½: 3 afkortet, 1 overlap); LassoOwnershipDiagram (min ½: 0 afkortet, 0 overlap, 3 klippet); LassoProductionUnits (min ⅔: 0 afkortet, 2 overlap); LassoShareBars (min ¼: 1 afkortet, 0 overlap). I alt 8 typer har mere af det i deres min end i fuld bredde. Afkortning, der også står i fuld bredde (dvs. designet, fx linje-klip af forklaringer og uddrag), findes hos: LassoKeyValueList (2), LassoKeyValueList (financials) (8), LassoSummary (1).
- **Over 40 % tom plads i deres max**: LassoKeyValueList (financials) (1/1: 85 %); LassoTimeline (1/1: 85 %); LassoCreditRating (1/1: 84 %); LassoPersonRisk (1/1: 79 %); LassoContact (½: 77 %); LassoKeyValueList (1/1: 76 %); LassoShareBars (½: 75 %); LassoMultiYearTable (1/1: 75 %); LassoRiskObservations (1/1: 68 %); LassoPersonRoles (1/1: 68 %); LassoChangeFeed (1/1: 68 %); LassoBalanceSheet (¾: 67 %); LassoPersonRoles (show: ended) (1/1: 66 %); LassoCashFlow (¾: 64 %); LassoPersonRoles (show: current) (1/1: 64 %); LassoPersonRoles (show: owner) (1/1: 64 %); LassoBeneficialOwners (½: 59 %); LassoPersonList (½: 58 %); LassoRelations (½: 58 %); LassoContactPersons (½: 56 %); LassoProductionUnits (1/1: 56 %); LassoMergers (1/1: 55 %); LassoKeyFigureGauge (½: 54 %); LassoIncomeStatement (¾: 54 %); LassoScoreGauge (½: 54 %); LassoHeatmap (1/1: 54 %); LassoLivestock (1/1: 53 %); LassoRegistration (1/1: 52 %); LassoPersonFacts (½: 51 %); LassoRanking (1/1: 49 %); LassoOwnerList (½: 47 %); LassoSummary (1/1: 46 %); LassoPersonNetwork (1/1: 45 %).
- **Profil bekræftet / foreslået ændret**: 32 bekræftet, 26 foreslået ændret: LassoTimeline bred → smal; LassoNews fleksibel → bred; LassoBarChart bred → fleksibel; LassoGroupedBarChart bred → fleksibel; LassoLineChart bred → fleksibel; LassoStackedBarChart bred → fleksibel; LassoWaterfallChart bred → fleksibel; LassoIncomeStatement bred → smal; LassoBalanceSheet bred → smal; LassoCashFlow bred → smal; LassoRiskObservations fleksibel → smal; LassoScoreHistory bred → fleksibel; LassoCreditRating fleksibel → smal; LassoAuditorIndependence bred → fleksibel; LassoProperties smal → fleksibel; LassoMap bred → fleksibel; LassoMergers bred → smal; LassoAnnouncements fleksibel → bred; LassoRanking bred → fleksibel; LassoPersonRoles bred → fleksibel; LassoPersonRoles (show: current) bred → smal; LassoPersonRoles (show: ended) bred → smal; LassoPersonRoles (show: owner) bred → smal; LassoPersonRisk fleksibel → smal; LassoChangeFeed bred → smal; LassoHeatmap bred → fleksibel.

### Fund uden for tabellerne

- **Antal år er uden betydning.** Målt med både 10 og 6 år i flerårstabeller, regnskaber og branchetal (`REAL_YEARS`): højder og afkortning er identiske, fordi grafer viser de seneste 5 år, og regnskabsopgørelserne som standard viser 2 år + ændring. Tidsakserne i graferne får derfor aldrig 10 etiketter; det er PersonNetwork og PersonRoles (tidsbånd fra år til år), der har tidsakse-problemet.
- **Sammenligningstabellen (CompareTable) med 6 virksomheder er ikke ren i nogen bredde.** Med 40–45 tegn lange selskabsnavne bliver hver kolonne 350–390 px, og tabellen kræver 2378 px og ruller vandret selv i fuld bredde (1150 px; navnekolonnen er 194 px, så kun 2 virksomheder passer uden rulning). Bredde alene løser det ikke: kolonnenavnene skal afkortes eller ombrydes, eller antallet af virksomheder begrænses. Min/max er derfor uændret, og typen er markeret "kræver komponentændring".
- **PersonRoles har fire udseender med to profiler.** `show: all` er et tidsbånd (bred, rent fra ½), mens `show: current|ended|owner` er en liste ("Aktive roller"), der er over 40 % tom fra ⅔ og op. Registeret har én profil pr. type (bred); målingen bakker ejerens iagttagelse op og foreslår, at listevarianterne behandles som smal (max ½), mens tidsbåndet er fleksibelt fra ½. Det kræver, at B8 kan slå profilen op pr. variant (`show`), ligesom regnskabslisten allerede har sin egen række (`gridRuleOf`).
- **Bekræftet fra ejerens eksempler (29.09):** "Sidder sammen med" (PersonNetwork) i ½: 8 afkortede selskabsnavne, tre rækker pr. person og overlap på årstallene i ⅓ og ¼; først i fuld bredde er den helt ren (i ¾ er stadig 4 navne afkortet). "Aktive roller" (PersonRoles current) er 64 % tom i fuld bredde og 26 % i ½. "Stamoplysninger" (PersonFacts) er 76 % tom i fuld bredde (max er ½, 51 %; min ¼ er ren).
- **Pakkeren hæver for smalle bredder.** Announcements bliver fuld bredde, hvis den lægges i ¼ eller ⅓ (min ½), og de to hoveder er altid fuld bredde; disse celler står som "hævet til 1/1" i tabellen.

### Forbehold ved målingen

- Afkortning/overlap/klipning/rulning vurderes **relativt til fuld bredde**: nogle typer afkorter selv i fuld bredde (fx linje-klip af uddrag og forklaringer); min er den smalleste bredde, hvor tallene ikke er værre end i fuld bredde, og hvor alle bredere også er rene.
- min sænkes kun under den nuværende, hvis højden i den smallere bredde er højst 25 % højere end ved den nuværende min (min er også sat af højden, se `GridRule`); ellers er den foreslåede min uændret, og årsagen står i typens tekst.
- Tom plads er en tilnærmelse (to mål, se ovenfor); den er brugbar til at finde lister og nøgle/værdi-blokke, der strækkes, men den kan overvurdere tomhed i kortgrid og undervurdere den i tabeller. Brug den som indikation og se billederne (`tools/gallery/shoot.mjs`) før en regel ændres.
- Fyldelementet (skjult `LassoFollowUps`) står ved siden af målelementet i båndet. Uden det lægger pakkeren et element, der står alene i sit bånd, i fuld bredde (23.1). Fyldelementet skjules (højde 0) og påvirker hverken målelementets bredde eller højde; målingen viser bredden, som render_view med eksplicit `width` giver, ikke pakkerens egne valg.

## Samlet tabel: type × bredde

| Type | std / min / max | profil | ¼ | ⅓ | ½ | ⅔ | ¾ | 1/1 |
|---|---|---|---|---|---|---|---|---|
| LassoCompanyHead | 1/1 / 1/1 / 1/1 | fleksibel | · | · | · | · | (hævet til 1/1 af pakkeren) | 34 / 0 / 0 / 43% |
| LassoKeyFigureCards | 1/1 / ½ / 1/1 | fleksibel | · | *188 / 0 / 0 / 40%* | 170 / 0 / 0 / 42% | 152 / 0 / 0 / 49% | 138 / 0 / 0 / 15% | 138 / 0 / 0 / 19% |
| LassoKeyValueList | ½ / ½ / 1/1 | smal | · | *884 / 2 / 0 / 55%* | 701 / 2 / 0 / 50% | 701 / 2 / 0 / 62% | 683 / 2 / 0 / 67% | 665 / 2 / 0 / 76% |
| LassoKeyValueList (financials) | ½ / ½ / 1/1 | smal | · | *535 / 8 / 0 / 55%* | 535 / 8 / 0 / 70% | 535 / 8 / 0 / 77% | 535 / 8 / 0 / 80% | 535 / 8 / 0 / 85% |
| LassoContact | ⅓ / ¼ / ½ | smal | 176 / 0 / 0 / 54% | 176 / 0 / 0 / 66% | 176 / 0 / 0 / 77% | · | · | · |
| LassoContactPersons | ⅓ / ¼ / ½ | smal | 294 / 0 / 0 / 30% | 236 / 0 / 0 / 34% | 236 / 0 / 0 / 56% | · | · | · |
| LassoShortcuts | ½ / ¼ / 1/1 | smal | 232 / 0 / 0 / 57% | 136 / 0 / 0 / 52% | 88 / 0 / 0 / 33% | 88 / 0 / 0 / 64% | 88 / 0 / 0 / 85% | 40 / 0 / 0 / 31% |
| LassoTextSections | ½ / ½ / 1/1 | fleksibel | · | *712 / 0 / 0 / 9%* | 544 / 0 / 0 / 12% | 544 / 0 / 0 / 9% | 481 / 0 / 0 / 9% | 439 / 0 / 0 / 16% |
| LassoSummary | 1/1 / ½ / 1/1 | fleksibel | · | *195 / 1 / 0 / 5%* | 195 / 1 / 0 / 14% | 195 / 1 / 0 / 18% | 195 / 1 / 0 / 27% | 195 / 1 / 0 / 46% |
| LassoTimeline | ½ / ⅓ / 1/1 | bred | *1035 / 0 / 0 / 39%* | 1035 / 0 / 0 / 54% | 1018 / 0 / 0 / 70% | 1018 / 0 / 0 / 77% | 1018 / 0 / 0 / 80% | 1018 / 0 / 0 / 85% |
| LassoNews | ½ / ⅓ / 1/1 | fleksibel | *845 / 5 / 0 / 7%* | 755 / 5 / 0 / 6% | 701 / 5 / 0 / 2% | 647 / 5 / 0 / 6% | 611 / 0 / 0 / 12% | 611 / 0 / 0 / 35% |
| LassoBarChart | ½ / ⅓ / 1/1 | bred | *336 / 0 / 0 / 0%* | 336 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% |
| LassoGroupedBarChart | ½ / ⅓ / 1/1 | bred | *324 / 0 / 0 / 0%* | 324 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% |
| LassoLineChart | ½ / ⅓ / 1/1 | bred | *356 / 0 / 0 / 0%* | 356 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% |
| LassoStackedBarChart | ½ / ⅓ / 1/1 | bred | *232 / 0 / 0 / 37%* | 212 / 0 / 0 / 47% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% |
| LassoWaterfallChart | ½ / ⅓ / 1/1 | bred | *348 / 0 / 0 / 45%* | 324 / 0 / 0 / 48% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% | 300 / 0 / 0 / 0% |
| LassoShareBars | ½ / ¼ / ½ | smal | 200 / 1 / 0 / 50% | 200 / 1 / 0 / 63% | 200 / 0 / 0 / 75% | · | · | · |
| LassoKeyFigureGauge | ⅓ / ¼ / ½ | smal | 185 / 0 / 0 / 10% | 185 / 0 / 0 / 32% | 185 / 0 / 0 / 54% | · | · | · |
| LassoMultiYearTable | ½ / ½ / 1/1 | bred | · | *320 / 2 / 0 / 0%* | 296 / 0 / 0 / 27% | 296 / 0 / 0 / 70% | 296 / 0 / 0 / 66% | 296 / 0 / 0 / 75% |
| LassoIncomeStatement | ½ / ½ / ¾ | bred | · | *631 / 3 / 0 / 57%* | 604 / 0 / 0 / 38% | 604 / 0 / 0 / 48% | 604 / 0 / 0 / 54% | · |
| LassoBalanceSheet | ½ / ½ / ¾ | bred | · | *861 / 0 / 0 / 38%* | 861 / 0 / 0 / 55% | 861 / 0 / 0 / 63% | 861 / 0 / 0 / 67% | · |
| LassoCashFlow | ½ / ½ / ¾ | bred | · | *564 / 0 / 0 / 41%* | 564 / 0 / 0 / 50% | 564 / 0 / 0 / 60% | 564 / 0 / 0 / 64% | · |
| LassoFinancialStatements | 1/1 / 1/1 / 1/1 | bred | · | · | · | · | *1519 / 1 / 0 / 51%* | 1519 / 0 / 0 / 51% |
| LassoPersonList | ⅓ / ¼ / ½ | smal | 620 / 0 / 0 / 57% | 505 / 0 / 0 / 51% | 409 / 0 / 0 / 58% | · | · | · |
| LassoOwnerList | ⅓ / ¼ / ½ | smal | 565 / 0 / 0 / 48% | 525 / 0 / 0 / 37% | 421 / 0 / 0 / 47% | · | · | · |
| LassoBeneficialOwners | ⅓ / ¼ / ½ | smal | 631 / 0 / 0 / 58% | 463 / 0 / 0 / 44% | 392 / 0 / 0 / 59% | · | · | · |
| LassoOwnershipDiagram | ⅔ / ½ / 1/1 | bred | · | *359 / 5 / 0 / 20%* | 569 / 0 / 0 / 0% | 569 / 0 / 0 / 0% | 553 / 0 / 0 / 0% | 740 / 0 / 0 / 0% |
| LassoRelations | ¼ / ¼ / ½ | smal | 428 / 0 / 0 / 18% | 370 / 0 / 0 / 37% | 370 / 0 / 0 / 58% | · | · | · |
| LassoRiskObservations | ½ / ⅓ / 1/1 | fleksibel | *2319 / 0 / 0 / 50%* | 1007 / 0 / 0 / 38% | 787 / 0 / 0 / 49% | 714 / 0 / 0 / 51% | 674 / 0 / 0 / 56% | 674 / 0 / 0 / 68% |
| LassoScoreGauge | ¼ / ¼ / ½ | smal | 276 / 0 / 0 / 39% | 276 / 0 / 0 / 55% | 208 / 0 / 0 / 54% | · | · | · |
| LassoScoreHistory | ½ / ⅓ / 1/1 | bred | *592 / 0 / 1 / 0%* | 574 / 0 / 0 / 0% | 417 / 0 / 0 / 0% | 417 / 0 / 0 / 0% | 417 / 0 / 0 / 0% | 417 / 0 / 0 / 0% |
| LassoCreditRating | ½ / ⅓ / 1/1 | fleksibel | *429 / 0 / 0 / 34%* | 412 / 0 / 0 / 52% | 395 / 0 / 0 / 68% | 395 / 0 / 0 / 80% | 378 / 0 / 0 / 79% | 378 / 0 / 0 / 84% |
| LassoAuditorIndependence | 1/1 / ½ / 1/1 | bred | · | *630 / 0 / 0 / 0%* | 564 / 0 / 0 / 0% | 441 / 0 / 0 / 0% | 423 / 0 / 0 / 0% | 317 / 0 / 0 / 0% |
| LassoProductionUnits | 1/1 / ⅔ / 1/1 | bred | · | · | *1538 / 0 / 2 / 68%* | 831 / 0 / 2 / 69% | 618 / 0 / 0 / 63% | 538 / 0 / 0 / 56% |
| LassoProperties | ½ / ⅓ / 1/1 | smal | *2354 / 0 / 0 / 0%* | 2285 / 0 / 0 / 0% | 2206 / 0 / 0 / 0% | 2206 / 0 / 0 / 0% | 2206 / 0 / 0 / 0% | 1287 / 0 / 0 / 2% |
| LassoMap | ½ / ⅓ / 1/1 | bred | *222 / 0 / 0 / 0%* | 222 / 0 / 0 / 0% | 370 / 0 / 0 / 0% | 370 / 0 / 0 / 0% | 370 / 0 / 0 / 0% | 370 / 0 / 0 / 0% |
| LassoRegistration | 1/1 / ⅔ / 1/1 | bred | · | · | *1423 / 0 / 0 / 54%* | 541 / 0 / 0 / 54% | 476 / 0 / 0 / 56% | 440 / 0 / 0 / 52% |
| LassoMergers | ½ / ½ / 1/1 | bred | · | *1119 / 0 / 0 / 49%* | 764 / 0 / 0 / 37% | 649 / 0 / 0 / 47% | 649 / 0 / 0 / 53% | 452 / 0 / 0 / 55% |
| LassoAnnouncements | 1/1 / ½ / 1/1 | fleksibel | · | *518 / 3 / 3 / 74%* | 500 / 3 / 1 / 58% | 404 / 3 / 0 / 43% | 356 / 2 / 0 / 38% | 356 / 0 / 0 / 40% |
| LassoPublications | ½ / ½ / 1/1 | fleksibel | · | *425 / 0 / 0 / 5%* | 405 / 0 / 0 / 3% | 405 / 0 / 0 / 2% | 405 / 0 / 0 / 2% | 405 / 0 / 0 / 1% |
| LassoLivestock | ½ / ½ / 1/1 | smal | · | *700 / 0 / 0 / 0%* | 653 / 0 / 0 / 0% | 653 / 0 / 0 / 0% | 430 / 0 / 0 / 36% | 430 / 0 / 0 / 53% |
| LassoCompareTable | 1/1 / ⅔ / 1/1 | bred | · | · | *311 / 0 / 0 / 0%* | 311 / 0 / 0 / 0% | 311 / 0 / 0 / 0% | 311 / 0 / 0 / 0% |
| LassoRanking | ½ / ⅓ / 1/1 | bred | *377 / 0 / 0 / 43%* | 353 / 0 / 0 / 49% | 353 / 0 / 0 / 47% | 353 / 0 / 0 / 48% | 353 / 0 / 0 / 48% | 353 / 0 / 0 / 49% |
| LassoCompanyTable | 1/1 / 1/1 / 1/1 | bred | · | · | · | · | *871 / 0 / 0 / 0%* | 904 / 0 / 0 / 0% |
| LassoPersonTable | 1/1 / 1/1 / 1/1 | bred | · | · | · | · | *730 / 0 / 0 / 0%* | 708 / 0 / 0 / 0% |
| LassoSavedPages | 1/1 / 1/1 / 1/1 | fleksibel | · | · | · | · | *541 / 0 / 0 / 46%* | 541 / 0 / 0 / 60% |
| LassoFollowUps | 1/1 / 1/1 / 1/1 | fleksibel | · | · | · | · | *80 / 0 / 0 / 57%* | 80 / 0 / 0 / 68% |
| LassoPersonHead | 1/1 / 1/1 / 1/1 | fleksibel | · | · | · | · | (hævet til 1/1 af pakkeren) | 34 / 0 / 0 / 59% |
| LassoPersonStats | 1/1 / ½ / 1/1 | fleksibel | · | *90 / 0 / 0 / 21%* | 90 / 0 / 0 / 25% | 90 / 0 / 0 / 27% | 90 / 0 / 0 / 28% | 90 / 0 / 0 / 29% |
| LassoPersonRoles | ⅔ / ½ / 1/1 | bred | · | *322 / 0 / 3 / 44%* | 298 / 0 / 0 / 59% | 298 / 0 / 0 / 60% | 298 / 0 / 0 / 58% | 298 / 0 / 0 / 68% |
| LassoPersonRoles (show: current) | ⅔ / ½ / 1/1 | bred | · | *436 / 0 / 0 / 40%* | 341 / 0 / 0 / 26% | 341 / 0 / 0 / 45% | 341 / 0 / 0 / 51% | 341 / 0 / 0 / 64% |
| LassoPersonRoles (show: ended) | ⅔ / ½ / 1/1 | bred | · | *199 / 0 / 0 / 51%* | 161 / 0 / 0 / 31% | 161 / 0 / 0 / 48% | 161 / 0 / 0 / 54% | 161 / 0 / 0 / 66% |
| LassoPersonRoles (show: owner) | ⅔ / ½ / 1/1 | bred | · | *199 / 0 / 0 / 59%* | 161 / 0 / 0 / 26% | 161 / 0 / 0 / 44% | 161 / 0 / 0 / 51% | 161 / 0 / 0 / 64% |
| LassoPersonNetwork | ⅔ / ½ / 1/1 | bred | · | *399 / 9 / 1 / 51%* | 375 / 8 / 0 / 46% | 375 / 6 / 0 / 45% | 375 / 4 / 0 / 48% | 375 / 0 / 0 / 45% |
| LassoPersonRisk | ½ / ⅓ / 1/1 | fleksibel | *678 / 0 / 0 / 41%* | 494 / 0 / 0 / 39% | 404 / 0 / 0 / 49% | 404 / 0 / 0 / 63% | 368 / 0 / 0 / 71% | 368 / 0 / 0 / 79% |
| LassoPersonFacts | ⅓ / ¼ / ½ | smal | 307 / 0 / 0 / 39% | 307 / 0 / 0 / 43% | 307 / 0 / 0 / 51% | · | · | · |
| LassoChangeFeed | 1/1 / ½ / 1/1 | bred | · | *1433 / 0 / 0 / 22%* | 1066 / 0 / 0 / 33% | 1030 / 0 / 0 / 51% | 1030 / 0 / 0 / 57% | 1030 / 0 / 0 / 68% |
| LassoHeatmap | ½ / ⅓ / 1/1 | bred | *170 / 0 / 0 / 20%* | 170 / 0 / 0 / 16% | 218 / 0 / 0 / 14% | 218 / 0 / 0 / 30% | 218 / 0 / 0 / 37% | 218 / 0 / 0 / 54% |

`·` = bredden ligger mere end ét trin under min og er ikke vist (målt i JSON'en).

## Forslag pr. type (samlet)

| Type | nu std / min / max | forslag std / min / max | profil nu | profil forslag | drivere (aflæst) |
|---|---|---|---|---|---|
| LassoCompanyHead | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | fleksibel | bekræftet | longestLabel 44 |
| LassoKeyFigureCards | 1/1 / ½ / 1/1 | 1/1 / **⅓** / 1/1 | fleksibel | bekræftet | – |
| LassoKeyValueList | ½ / ½ / 1/1 | ½ / ½ / **½** | smal | bekræftet | longestLabel 45 |
| LassoKeyValueList (financials) | ½ / ½ / 1/1 | ½ / ½ / **½** | smal | bekræftet | – |
| LassoContact | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | – |
| LassoContactPersons | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | rowsPerItem 3, longestLabel 44 |
| LassoShortcuts | ½ / ¼ / 1/1 | ½ / ¼ / **½** | smal | bekræftet | longestLabel 44 |
| LassoTextSections | ½ / ½ / 1/1 | ½ / ½ / 1/1 | fleksibel | bekræftet | – |
| LassoSummary | 1/1 / ½ / 1/1 | **¾** / **¼** / **¾** | fleksibel | bekræftet | – |
| LassoTimeline | ½ / ⅓ / 1/1 | **⅓** / **¼** / **½** | bred | **smal** | rowsPerItem 2 |
| LassoNews | ½ / ⅓ / 1/1 | **¾** / **¾** / 1/1 | fleksibel | **bred** | rowsPerItem 3 |
| LassoBarChart | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | timeAxis |
| LassoGroupedBarChart | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | timeAxis, series 3 |
| LassoLineChart | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | timeAxis, series 2 |
| LassoStackedBarChart | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | timeAxis, series 4 |
| LassoWaterfallChart | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | series 8 |
| LassoShareBars | ½ / ¼ / ½ | ½ / **½** / ½ | smal | bekræftet | series 4 |
| LassoKeyFigureGauge | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | series 3 |
| LassoMultiYearTable | ½ / ½ / 1/1 | **⅔** / **⅔** / **⅔** | bred | bekræftet | timeAxis, series 10 |
| LassoIncomeStatement | ½ / ½ / ¾ | ½ / ½ / **½** | bred | **smal** | timeAxis, series 5 |
| LassoBalanceSheet | ½ / ½ / ¾ | **⅓** / **⅓** / **½** | bred | **smal** | timeAxis, series 5 |
| LassoCashFlow | ½ / ½ / ¾ | **⅓** / **⅓** / **½** | bred | **smal** | timeAxis, series 5 |
| LassoFinancialStatements | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | bred | bekræftet | timeAxis, series 5 |
| LassoPersonList | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | rowsPerItem 2, longestLabel 34 |
| LassoOwnerList | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | rowsPerItem 2, longestLabel 45 |
| LassoBeneficialOwners | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | rowsPerItem 2, longestLabel 30 |
| LassoOwnershipDiagram | ⅔ / ½ / 1/1 | ⅔ / **⅔** / 1/1 | bred | bekræftet | longestLabel 45 |
| LassoRelations | ¼ / ¼ / ½ | ¼ / ¼ / ½ | smal | bekræftet | rowsPerItem 2, longestLabel 45 |
| LassoRiskObservations | ½ / ⅓ / 1/1 | **⅓** / ⅓ / **½** | fleksibel | **smal** | rowsPerItem 2 |
| LassoScoreGauge | ¼ / ¼ / ½ | ¼ / ¼ / ½ | smal | bekræftet | – |
| LassoScoreHistory | ½ / ⅓ / 1/1 | ½ / ⅓ / 1/1 | bred | **fleksibel** | timeAxis |
| LassoCreditRating | ½ / ⅓ / 1/1 | **⅓** / **¼** / **½** | fleksibel | **smal** | – |
| LassoAuditorIndependence | 1/1 / ½ / 1/1 | 1/1 / ½ / 1/1 | bred | **fleksibel** | longestLabel 44, series 4 |
| LassoProductionUnits | 1/1 / ⅔ / 1/1 | 1/1 / **¾** / 1/1 | bred | bekræftet | longestLabel 54, series 5 |
| LassoProperties | ½ / ⅓ / 1/1 | ½ / **½** / 1/1 | smal | **fleksibel** | rowsPerItem 2 |
| LassoMap | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | – |
| LassoRegistration | 1/1 / ⅔ / 1/1 | 1/1 / ⅔ / 1/1 | bred | bekræftet | longestLabel 45, series 4 |
| LassoMergers | ½ / ½ / 1/1 | ½ / ½ / **½** | bred | **smal** | rowsPerItem 3, longestLabel 44 |
| LassoAnnouncements | 1/1 / ½ / 1/1 | 1/1 / **1/1** / 1/1 | fleksibel | **bred** | rowsPerItem 3, longestLabel 44 |
| LassoPublications | ½ / ½ / 1/1 | ½ / ½ / 1/1 | fleksibel | bekræftet | timeAxis, series 4 |
| LassoLivestock | ½ / ½ / 1/1 | ½ / **⅓** / **½** | smal | bekræftet | series 3 |
| LassoCompareTable | 1/1 / ⅔ / 1/1 | 1/1 / ⅔ / 1/1 | bred | bekræftet | longestLabel 45, series 6 |
| LassoRanking | ½ / ⅓ / 1/1 | ½ / **¼** / 1/1 | bred | **fleksibel** | longestLabel 45, series 6 |
| LassoCompanyTable | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | bred | bekræftet | longestLabel 45, series 8 |
| LassoPersonTable | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | bred | bekræftet | series 6 |
| LassoSavedPages | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | fleksibel | bekræftet | longestLabel 45, series 5 |
| LassoFollowUps | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | fleksibel | bekræftet | – |
| LassoPersonHead | 1/1 / 1/1 / 1/1 | 1/1 / 1/1 / 1/1 | fleksibel | bekræftet | longestLabel 45 |
| LassoPersonStats | 1/1 / ½ / 1/1 | 1/1 / **⅓** / 1/1 | fleksibel | bekræftet | longestLabel 45 |
| LassoPersonRoles | ⅔ / ½ / 1/1 | ⅔ / ½ / 1/1 | bred | **fleksibel** | rowsPerItem 2, longestLabel 45, timeAxis |
| LassoPersonRoles (show: current) | ⅔ / ½ / 1/1 | **½** / ½ / **½** | bred | **smal** | rowsPerItem 2, longestLabel 45 |
| LassoPersonRoles (show: ended) | ⅔ / ½ / 1/1 | **½** / **⅓** / **½** | bred | **smal** | rowsPerItem 2, longestLabel 45 |
| LassoPersonRoles (show: owner) | ⅔ / ½ / 1/1 | **½** / **⅓** / **½** | bred | **smal** | rowsPerItem 2, longestLabel 45 |
| LassoPersonNetwork | ⅔ / ½ / 1/1 | **1/1** / **1/1** / 1/1 | bred | bekræftet | rowsPerItem 3, longestLabel 45, timeAxis |
| LassoPersonRisk | ½ / ⅓ / 1/1 | **⅓** / ⅓ / **½** | fleksibel | **smal** | rowsPerItem 2, longestLabel 45 |
| LassoPersonFacts | ⅓ / ¼ / ½ | ⅓ / ¼ / ½ | smal | bekræftet | longestLabel 45 |
| LassoChangeFeed | 1/1 / ½ / 1/1 | **½** / ½ / **½** | bred | **smal** | rowsPerItem 2, longestLabel 45 |
| LassoHeatmap | ½ / ⅓ / 1/1 | ½ / **¼** / **¾** | bred | **fleksibel** | timeAxis, series 12 |

## Pr. type

### LassoCompanyHead

- Nuværende: std 1/1, min 1/1, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 44. `contentMinWidth` med disse drivere giver 1/1.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |
| ⅓ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |
| ½ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |
| ⅔ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |
| ¾ (under min) | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |
| 1/1 | 1152 | 34 | 0 | 0 | 0 | 0 | 43 % | 43 % | 43 % | 43 % | 43 % |

### LassoKeyFigureCards

- Nuværende: std 1/1, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min ⅓, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ½.
- Ren helt ned til ¼, men højden er da 478 px mod 170 px i ½ (2.8×); min sænkes kun til ⅓.
- Fleksibel bekræftet: ren fra ⅓; tom plads i ⅔+ er 49 %.
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (fleksibel, nuværende drivere) giver ½, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 478 | 0 | 0 | 0 | 0 | 56 % | 46 % | 56 % | 59 % | 7 % |
| ⅓ (under min) | 376 | 188 | 0 | 0 | 0 | 0 | 40 % | 32 % | 52 % | 40 % | 0 % |
| ½ | 564 | 170 | 0 | 0 | 0 | 0 | 42 % | 54 % | 66 % | 42 % | 0 % |
| ⅔ | 752 | 152 | 0 | 0 | 0 | 0 | 49 % | 41 % | 49 % | 78 % | 3 % |
| ¾ | 846 | 138 | 0 | 0 | 0 | 0 | 15 % | 42 % | 48 % | 15 % | 3 % |
| 1/1 | 1152 | 138 | 0 | 0 | 0 | 0 | 19 % | 57 % | 62 % | 19 % | 2 % |

### LassoKeyValueList

- Nuværende: std ½, min ½, max 1/1; profil **smal**.
- Foreslået: std ½, min ½, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45. `contentMinWidth` med disse drivere giver ½.
- Også i fuld bredde er der 2 afkortede felter og 0 overlap (afkortning er en del af designet, fx linje-klip af uddrag); min måles derfor relativt til fuld bredde.
- Ren helt ned til ¼, men højden er da 1100 px mod 701 px i ½ (1.6×); min sænkes kun til ½.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 76 %.
- Smal profil: max ≤ ½ (tom plads 76 % i ⅔+).

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1100 | 2 | 0 | 0 | 0 | 60 % | 18 % | 60 % | 73 % | 0 % |
| ⅓ (under min) | 376 | 884 | 2 | 0 | 0 | 0 | 55 % | 38 % | 58 % | 55 % | 1 % |
| ½ | 564 | 701 | 2 | 0 | 0 | 0 | 50 % | 26 % | 54 % | 50 % | 2 % |
| ⅔ | 752 | 701 | 2 | 0 | 0 | 0 | 62 % | 24 % | 69 % | 62 % | 2 % |
| ¾ | 846 | 683 | 2 | 0 | 0 | 0 | 67 % | 18 % | 73 % | 67 % | 1 % |
| 1/1 | 1152 | 665 | 2 | 0 | 0 | 0 | 76 % | 36 % | 80 % | 76 % | 22 % |

Eksempler: afkortet i ¼: "Seneste revisorskiftDato for seneste skift af revi"; afkortet i ⅓: "Seneste revisorskiftDato for seneste skift af revi"; afkortet i ½: "Seneste revisorskiftDato for seneste skift af revi"; afkortet i ⅔: "Seneste revisorskiftDato for seneste skift af revi".

### LassoKeyValueList (financials)

- Nuværende: std ½, min ½, max 1/1; profil **smal**.
- Foreslået: std ½, min ½, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ½.
- Også i fuld bredde er der 8 afkortede felter og 0 overlap (afkortning er en del af designet, fx linje-klip af uddrag); min måles derfor relativt til fuld bredde.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 85 %.
- Smal profil: max ≤ ½ (tom plads 85 % i ⅔+).

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 535 | 14 | 0 | 1 | 0 | 46 % | 24 % | 46 % | 49 % | 0 % |
| ⅓ (under min) | 376 | 535 | 8 | 0 | 1 | 0 | 55 % | 34 % | 55 % | 60 % | 0 % |
| ½ | 564 | 535 | 8 | 0 | 0 | 0 | 70 % | 55 % | 70 % | 73 % | 0 % |
| ⅔ | 752 | 535 | 8 | 0 | 0 | 0 | 77 % | 67 % | 77 % | 80 % | 0 % |
| ¾ | 846 | 535 | 8 | 0 | 0 | 0 | 80 % | 70 % | 80 % | 82 % | 0 % |
| 1/1 | 1152 | 535 | 8 | 0 | 0 | 0 | 85 % | 78 % | 85 % | 87 % | 0 % |

Eksempler: afkortet i ¼: "RegnskabsperiodeDet tidsrum, regnskabet dækker. Of"; afkortet i ⅓: "RegnskabsperiodeDet tidsrum, regnskabet dækker. Of"; afkortet i ½: "RegnskabsperiodeDet tidsrum, regnskabet dækker. Of"; afkortet i ⅔: "RegnskabsperiodeDet tidsrum, regnskabet dækker. Of".

### LassoContact

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 89 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 176 | 0 | 0 | 0 | 0 | 54 % | 24 % | 54 % | 66 % | 0 % |
| ⅓ | 376 | 176 | 0 | 0 | 0 | 0 | 66 % | 43 % | 66 % | 75 % | 0 % |
| ½ | 564 | 176 | 0 | 0 | 0 | 0 | 77 % | 62 % | 77 % | 83 % | 0 % |
| ⅔ (uden for regel) | 752 | 176 | 0 | 0 | 0 | 0 | 83 % | 72 % | 83 % | 87 % | 0 % |
| ¾ (uden for regel) | 846 | 176 | 0 | 0 | 0 | 0 | 85 % | 75 % | 85 % | 89 % | 0 % |
| 1/1 (uden for regel) | 1152 | 176 | 0 | 0 | 0 | 0 | 89 % | 82 % | 89 % | 92 % | 0 % |

### LassoContactPersons

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 3, longestLabel 44. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 79 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 294 | 0 | 0 | 0 | 0 | 30 % | 12 % | 30 % | 44 % | 0 % |
| ⅓ | 376 | 236 | 0 | 0 | 0 | 0 | 34 % | 32 % | 34 % | 45 % | 0 % |
| ½ | 564 | 236 | 0 | 0 | 0 | 0 | 56 % | 54 % | 56 % | 63 % | 0 % |
| ⅔ (uden for regel) | 752 | 236 | 0 | 0 | 0 | 0 | 67 % | 66 % | 67 % | 72 % | 0 % |
| ¾ (uden for regel) | 846 | 236 | 0 | 0 | 0 | 0 | 71 % | 70 % | 71 % | 76 % | 0 % |
| 1/1 (uden for regel) | 1152 | 236 | 0 | 0 | 0 | 0 | 79 % | 78 % | 79 % | 82 % | 0 % |

### LassoShortcuts

- Nuværende: std ½, min ¼, max 1/1; profil **smal**.
- Foreslået: std ½, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 44. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 85 %.
- Smal profil: max ≤ ½ (tom plads 85 % i ⅔+).

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 232 | 0 | 0 | 0 | 0 | 57 % | 36 % | 63 % | 57 % | 12 % |
| ⅓ | 376 | 136 | 0 | 0 | 0 | 0 | 52 % | 31 % | 52 % | 52 % | 13 % |
| ½ | 564 | 88 | 0 | 0 | 0 | 0 | 33 % | 40 % | 46 % | 33 % | 20 % |
| ⅔ | 752 | 88 | 0 | 0 | 0 | 0 | 64 % | 42 % | 73 % | 64 % | 20 % |
| ¾ | 846 | 88 | 0 | 0 | 0 | 0 | 85 % | 37 % | 88 % | 85 % | 12 % |
| 1/1 | 1152 | 40 | 0 | 0 | 0 | 0 | 31 % | 44 % | 92 % | 31 % | 22 % |

### LassoTextSections

- Nuværende: std ½, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std ½, min ½, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ½.
- Ren helt ned til ¼, men højden er da 838 px mod 544 px i ½ (1.5×); min sænkes kun til ½.
- Fleksibel bekræftet: ren fra ½; tom plads i ⅔+ er 16 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 838 | 0 | 0 | 0 | 0 | 5 % | 2 % | 5 % | 17 % | 2 % |
| ⅓ (under min) | 376 | 712 | 0 | 0 | 0 | 0 | 9 % | 3 % | 9 % | 19 % | 3 % |
| ½ | 564 | 544 | 0 | 0 | 0 | 0 | 12 % | 0 % | 12 % | 15 % | 0 % |
| ⅔ | 752 | 544 | 0 | 0 | 0 | 0 | 9 % | 0 % | 9 % | 71 % | 0 % |
| ¾ | 846 | 481 | 0 | 0 | 0 | 0 | 9 % | 0 % | 9 % | 75 % | 0 % |
| 1/1 | 1152 | 439 | 0 | 0 | 0 | 0 | 16 % | 1 % | 16 % | 67 % | 1 % |

### LassoSummary

- Nuværende: std 1/1, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std ¾, min ¼, max ¾; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ½.
- Også i fuld bredde er der 1 afkortede felter og 0 overlap (afkortning er en del af designet, fx linje-klip af uddrag); min måles derfor relativt til fuld bredde.
- Fleksibel bekræftet: ren fra ¼; tom plads i ⅔+ er 46 %.
- 46 % tom plads  i 1/1; max sænkes til ¾ (27 %).
- Målt ren allerede i ¼; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (fleksibel, nuværende drivere) giver ½, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 195 | 1 | 0 | 0 | 0 | 11 % | 3 % | 11 % | 28 % | 3 % |
| ⅓ (under min) | 376 | 195 | 1 | 0 | 0 | 0 | 5 % | 0 % | 5 % | 18 % | 0 % |
| ½ | 564 | 195 | 1 | 0 | 0 | 0 | 14 % | 2 % | 14 % | 15 % | 2 % |
| ⅔ | 752 | 195 | 1 | 0 | 0 | 0 | 18 % | 14 % | 18 % | 18 % | 14 % |
| ¾ | 846 | 195 | 1 | 0 | 0 | 0 | 27 % | 24 % | 27 % | 28 % | 24 % |
| 1/1 | 1152 | 195 | 1 | 0 | 0 | 0 | 46 % | 44 % | 46 % | 47 % | 44 % |

Eksempler: afkortet i ¼: "Nordjysk Entreprenør- og Ejendomsselskab ApS er en"; afkortet i ⅓: "Nordjysk Entreprenør- og Ejendomsselskab ApS er en"; afkortet i ½: "Nordjysk Entreprenør- og Ejendomsselskab ApS er en"; afkortet i ⅔: "Nordjysk Entreprenør- og Ejendomsselskab ApS er en".

### LassoTimeline

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2. `contentMinWidth` med disse drivere giver ⅔.
- Bred-profil, men ren helt ned til ¼, og der er mindst 77 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 85 % i ⅔+).
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ⅔, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 1035 | 0 | 0 | 0 | 0 | 39 % | 17 % | 39 % | 44 % | 2 % |
| ⅓ | 376 | 1035 | 0 | 0 | 0 | 0 | 54 % | 38 % | 54 % | 56 % | 13 % |
| ½ | 564 | 1018 | 0 | 0 | 0 | 0 | 70 % | 35 % | 70 % | 72 % | 27 % |
| ⅔ | 752 | 1018 | 0 | 0 | 0 | 0 | 77 % | 51 % | 77 % | 79 % | 45 % |
| ¾ | 846 | 1018 | 0 | 0 | 0 | 0 | 80 % | 56 % | 80 % | 81 % | 51 % |
| 1/1 | 1152 | 1018 | 0 | 0 | 0 | 0 | 85 % | 68 % | 85 % | 86 % | 64 % |

### LassoNews

- Nuværende: std ½, min ⅓, max 1/1; profil **fleksibel**.
- Foreslået: std ¾, min ¾, max 1/1; profil **bred** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 3. `contentMinWidth` med disse drivere giver ½.
- Fleksibel, men afkortning/overlap i ½ (5 afkortet, 0 overlap); ren først fra ¾: bred.
- Nuværende min (⅓) har afkortning/overlap/klipning (5 afkortet, 0 overlap, 0 klippet); ren fra ¾.
- contentMinWidth (fleksibel, nuværende drivere) giver ½, målingen giver ¾.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 845 | 5 | 0 | 0 | 0 | 7 % | 0 % | 7 % | 34 % | 0 % |
| ⅓ | 376 | 755 | 5 | 0 | 0 | 0 | 6 % | 0 % | 6 % | 13 % | 0 % |
| ½ | 564 | 701 | 5 | 0 | 0 | 0 | 2 % | 0 % | 2 % | 37 % | 0 % |
| ⅔ | 752 | 647 | 5 | 0 | 0 | 0 | 6 % | 1 % | 6 % | 78 % | 1 % |
| ¾ | 846 | 611 | 0 | 0 | 0 | 0 | 12 % | 2 % | 12 % | 24 % | 2 % |
| 1/1 | 1152 | 611 | 0 | 0 | 0 | 0 | 35 % | 3 % | 35 % | 69 % | 3 % |

Eksempler: afkortet i ¼: "Selskabet har i dag offentliggjort en aftale med e"; afkortet i ⅓: "Selskabet har i dag offentliggjort en aftale med e"; afkortet i ½: "Selskabet har i dag offentliggjort en aftale med e"; afkortet i ⅔: "Selskabet har i dag offentliggjort en aftale med e".

### LassoBarChart

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 336 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ | 376 | 336 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ½ | 564 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoGroupedBarChart

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 3. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 324 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ | 376 | 324 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ½ | 564 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoLineChart

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 2. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 356 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ | 376 | 356 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ½ | 564 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoStackedBarChart

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 4. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 232 | 0 | 0 | 0 | 0 | 37 % | 24 % | 47 % | 37 % | 0 % |
| ⅓ | 376 | 212 | 0 | 0 | 0 | 0 | 47 % | 22 % | 53 % | 47 % | 0 % |
| ½ | 564 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoWaterfallChart

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: series 8. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med det realistiske indhold: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 348 | 0 | 0 | 0 | 0 | 45 % | 7 % | 52 % | 45 % | 0 % |
| ⅓ | 376 | 324 | 0 | 0 | 0 | 0 | 48 % | 22 % | 60 % | 48 % | 0 % |
| ½ | 564 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 300 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoShareBars

- Nuværende: std ½, min ¼, max ½; profil **smal**.
- Foreslået: std ½, min ½, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: series 4. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 88 %.
- Nuværende min (¼) har afkortning/overlap/klipning (1 afkortet, 0 overlap, 0 klippet); ren fra ½.
- contentMinWidth (smal, nuværende drivere) giver ¼, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 200 | 1 | 0 | 0 | 0 | 50 % | 14 % | 50 % | 50 % | 0 % |
| ⅓ | 376 | 200 | 1 | 0 | 0 | 0 | 63 % | 18 % | 63 % | 63 % | 0 % |
| ½ | 564 | 200 | 0 | 0 | 0 | 0 | 75 % | 23 % | 75 % | 75 % | 0 % |
| ⅔ (uden for regel) | 752 | 200 | 0 | 0 | 0 | 0 | 81 % | 29 % | 81 % | 81 % | 0 % |
| ¾ (uden for regel) | 846 | 200 | 0 | 0 | 0 | 0 | 83 % | 31 % | 83 % | 83 % | 0 % |
| 1/1 (uden for regel) | 1152 | 200 | 0 | 0 | 0 | 0 | 88 % | 35 % | 88 % | 88 % | 0 % |

Eksempler: afkortet i ¼: "Egenkapital"; afkortet i ⅓: "Egenkapital".

### LassoKeyFigureGauge

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: series 3. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 72 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 185 | 0 | 0 | 0 | 0 | 10 % | 7 % | 10 % | 21 % | 0 % |
| ⅓ | 376 | 185 | 0 | 0 | 0 | 0 | 32 % | 31 % | 32 % | 41 % | 0 % |
| ½ | 564 | 185 | 0 | 0 | 0 | 0 | 54 % | 44 % | 54 % | 56 % | 0 % |
| ⅔ (uden for regel) | 752 | 185 | 0 | 0 | 0 | 0 | 65 % | 44 % | 65 % | 66 % | 0 % |
| ¾ (uden for regel) | 846 | 185 | 0 | 0 | 0 | 0 | 69 % | 44 % | 69 % | 70 % | 0 % |
| 1/1 (uden for regel) | 1152 | 185 | 0 | 0 | 0 | 0 | 72 % | 44 % | 72 % | 78 % | 0 % |

### LassoMultiYearTable

- Nuværende: std ½, min ½, max 1/1; profil **bred**.
- Foreslået: std ⅔, min ⅔, max ⅔; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: timeAxis, series 10. `contentMinWidth` med disse drivere giver ¾.
- Bred bekræftet: afkortning/overlap i ½ (0 afkortet, 0 overlap, vandret rulning); ren først fra ⅔.
- 75 % tom plads  i 1/1; max sænkes til ½ (27 %).
- Nuværende min (½) har afkortning/overlap/klipning (0 afkortet, 0 overlap, 0 klippet); ren fra ⅔.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅔.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 320 | 2 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ (under min) | 376 | 320 | 2 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ½ | 564 | 296 | 0 | 0 | 0 | 1 | 27 % | 62 % | 69 % | 27 % | 4 % |
| ⅔ | 752 | 296 | 0 | 0 | 0 | 0 | 70 % | 62 % | 70 % | 90 % | 0 % |
| ¾ | 846 | 296 | 0 | 0 | 0 | 0 | 66 % | 61 % | 66 % | 87 % | 0 % |
| 1/1 | 1152 | 296 | 0 | 0 | 0 | 0 | 75 % | 72 % | 75 % | 90 % | 0 % |

Eksempler: afkortet i ¼: "Bruttofortjeneste"; afkortet i ⅓: "Bruttofortjeneste".

### LassoIncomeStatement

- Nuværende: std ½, min ½, max ¾; profil **bred**.
- Foreslået: std ½, min ½, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 5. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ½, og der er mindst 48 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 66 % i ⅔+).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 740 | 13 | 0 | 0 | 0 | 51 % | 24 % | 51 % | 77 % | 0 % |
| ⅓ (under min) | 376 | 631 | 3 | 0 | 0 | 0 | 57 % | 28 % | 57 % | 66 % | 0 % |
| ½ | 564 | 604 | 0 | 0 | 0 | 0 | 38 % | 25 % | 48 % | 38 % | 0 % |
| ⅔ | 752 | 604 | 0 | 0 | 0 | 0 | 48 % | 44 % | 61 % | 48 % | 0 % |
| ¾ | 846 | 604 | 0 | 0 | 0 | 0 | 54 % | 50 % | 65 % | 54 % | 0 % |
| 1/1 (uden for regel) | 1152 | 604 | 0 | 0 | 0 | 0 | 66 % | 63 % | 75 % | 66 % | 0 % |

Eksempler: afkortet i ¼: "Omsætning"; afkortet i ⅓: "Bruttofortjeneste".

### LassoBalanceSheet

- Nuværende: std ½, min ½, max ¾; profil **bred**.
- Foreslået: std ⅓, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 5. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ⅓, og der er mindst 63 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 76 % i ⅔+).
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 889 | 10 | 0 | 0 | 0 | 63 % | 29 % | 64 % | 63 % | 0 % |
| ⅓ (under min) | 376 | 861 | 0 | 0 | 0 | 0 | 38 % | 20 % | 44 % | 38 % | 0 % |
| ½ | 564 | 861 | 0 | 0 | 0 | 0 | 55 % | 41 % | 56 % | 55 % | 0 % |
| ⅔ | 752 | 861 | 0 | 0 | 0 | 0 | 63 % | 56 % | 67 % | 63 % | 0 % |
| ¾ | 846 | 861 | 0 | 0 | 0 | 0 | 67 % | 61 % | 71 % | 67 % | 0 % |
| 1/1 (uden for regel) | 1152 | 861 | 0 | 0 | 0 | 0 | 76 % | 71 % | 79 % | 76 % | 0 % |

Eksempler: afkortet i ¼: "Immaterielle anlægsaktiver".

### LassoCashFlow

- Nuværende: std ½, min ½, max ¾; profil **bred**.
- Foreslået: std ⅓, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 5. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ⅓, og der er mindst 60 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 74 % i ⅔+).
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 618 | 2 | 0 | 0 | 0 | 58 % | 23 % | 58 % | 67 % | 0 % |
| ⅓ (under min) | 376 | 564 | 0 | 0 | 0 | 0 | 41 % | 25 % | 41 % | 41 % | 0 % |
| ½ | 564 | 564 | 0 | 0 | 0 | 0 | 50 % | 45 % | 53 % | 50 % | 0 % |
| ⅔ | 752 | 564 | 0 | 0 | 0 | 0 | 60 % | 59 % | 65 % | 60 % | 0 % |
| ¾ | 846 | 564 | 0 | 0 | 0 | 0 | 64 % | 63 % | 69 % | 64 % | 0 % |
| 1/1 (uden for regel) | 1152 | 564 | 0 | 0 | 0 | 0 | 74 % | 73 % | 77 % | 74 % | 0 % |

Eksempler: afkortet i ¼: "Af- og nedskrivninger".

### LassoFinancialStatements

- Nuværende: std 1/1, min 1/1, max 1/1; profil **bred**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: timeAxis, series 5. `contentMinWidth` med disse drivere giver 1/1.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1757 | 45 | 1 | 1 | 0 | 60 % | 24 % | 80 % | 60 % | 0 % |
| ⅓ (uden for regel) | 376 | 1648 | 35 | 1 | 1 | 0 | 57 % | 28 % | 76 % | 57 % | 0 % |
| ½ (uden for regel) | 564 | 1547 | 22 | 0 | 1 | 0 | 52 % | 25 % | 73 % | 52 % | 0 % |
| ⅔ (uden for regel) | 752 | 1530 | 1 | 0 | 1 | 0 | 52 % | 44 % | 64 % | 52 % | 0 % |
| ¾ (under min) | 846 | 1519 | 1 | 0 | 1 | 0 | 51 % | 50 % | 68 % | 51 % | 0 % |
| 1/1 | 1152 | 1519 | 0 | 0 | 1 | 0 | 51 % | 50 % | 76 % | 51 % | 0 % |

Eksempler: afkortet i ¼: "Omsætning"; overlap i ¼: Pengestrøm fra finansier | Årets ændring i likvider; afkortet i ⅓: "Bruttofortjeneste"; overlap i ⅓: Pengestrøm fra finansier | Årets ændring i likvider.

### LassoPersonList

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 34. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 79 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 620 | 0 | 0 | 0 | 0 | 57 % | 9 % | 57 % | 62 % | 0 % |
| ⅓ | 376 | 505 | 0 | 0 | 0 | 0 | 51 % | 34 % | 51 % | 65 % | 0 % |
| ½ | 564 | 409 | 0 | 0 | 0 | 0 | 58 % | 45 % | 58 % | 74 % | 0 % |
| ⅔ (uden for regel) | 752 | 409 | 0 | 0 | 0 | 0 | 68 % | 59 % | 68 % | 80 % | 0 % |
| ¾ (uden for regel) | 846 | 409 | 0 | 0 | 0 | 0 | 72 % | 63 % | 72 % | 83 % | 0 % |
| 1/1 (uden for regel) | 1152 | 409 | 0 | 0 | 0 | 0 | 79 % | 73 % | 79 % | 87 % | 0 % |

### LassoOwnerList

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 68 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 565 | 0 | 0 | 0 | 0 | 48 % | 10 % | 48 % | 63 % | 0 % |
| ⅓ | 376 | 525 | 0 | 0 | 0 | 0 | 37 % | 8 % | 37 % | 80 % | 0 % |
| ½ | 564 | 421 | 0 | 0 | 0 | 0 | 47 % | 29 % | 47 % | 58 % | 0 % |
| ⅔ (uden for regel) | 752 | 401 | 0 | 0 | 0 | 0 | 51 % | 43 % | 51 % | 65 % | 0 % |
| ¾ (uden for regel) | 846 | 401 | 0 | 0 | 0 | 0 | 56 % | 49 % | 56 % | 69 % | 0 % |
| 1/1 (uden for regel) | 1152 | 401 | 0 | 0 | 0 | 0 | 68 % | 62 % | 68 % | 77 % | 0 % |

### LassoBeneficialOwners

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 30. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 64 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 631 | 0 | 0 | 0 | 0 | 58 % | 26 % | 58 % | 61 % | 0 % |
| ⅓ | 376 | 463 | 0 | 0 | 0 | 0 | 44 % | 9 % | 44 % | 52 % | 0 % |
| ½ | 564 | 392 | 0 | 0 | 0 | 0 | 59 % | 4 % | 59 % | 68 % | 0 % |
| ⅔ (uden for regel) | 752 | 341 | 0 | 0 | 0 | 0 | 44 % | 36 % | 44 % | 59 % | 0 % |
| ¾ (uden for regel) | 846 | 341 | 0 | 0 | 0 | 0 | 50 % | 43 % | 50 % | 63 % | 0 % |
| 1/1 (uden for regel) | 1152 | 341 | 0 | 0 | 0 | 0 | 64 % | 58 % | 64 % | 73 % | 0 % |

### LassoOwnershipDiagram

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std ⅔, min ⅔, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45. `contentMinWidth` med disse drivere giver ¾.
- Bred bekræftet: afkortning/overlap i ½ (0 afkortet, 0 overlap); ren først fra ⅔.
- Nuværende min (½) har afkortning/overlap/klipning (0 afkortet, 0 overlap, 3 klippet); ren fra ⅔.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅔.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 359 | 5 | 1 | 0 | 0 | 20 % | 0 % | 26 % | 20 % | 0 % |
| ⅓ (under min) | 376 | 359 | 5 | 0 | 0 | 0 | 20 % | 11 % | 20 % | 20 % | 0 % |
| ½ | 564 | 569 | 0 | 0 | 3 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 569 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 553 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 740 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

Eksempler: afkortet i ¼: "Vestjysk Maskin- og Anlægsservice Holding ApS"; overlap i ¼: Ejerstruktur | Underniveauer er eksempe; afkortet i ⅓: "Vestjysk Maskin- og Anlægsservice Holding ApS".

### LassoRelations

- Nuværende: std ¼, min ¼, max ½; profil **smal**.
- Foreslået: std ¼, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 80 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 428 | 0 | 0 | 0 | 0 | 18 % | 13 % | 18 % | 66 % | 13 % |
| ⅓ | 376 | 370 | 0 | 0 | 0 | 0 | 37 % | 12 % | 37 % | 40 % | 13 % |
| ½ | 564 | 370 | 0 | 0 | 0 | 0 | 58 % | 42 % | 58 % | 60 % | 42 % |
| ⅔ (uden for regel) | 752 | 370 | 0 | 0 | 0 | 0 | 69 % | 56 % | 69 % | 70 % | 56 % |
| ¾ (uden for regel) | 846 | 370 | 0 | 0 | 0 | 0 | 72 % | 61 % | 72 % | 73 % | 61 % |
| 1/1 (uden for regel) | 1152 | 370 | 0 | 0 | 0 | 0 | 80 % | 71 % | 80 % | 80 % | 71 % |

### LassoRiskObservations

- Nuværende: std ½, min ⅓, max 1/1; profil **fleksibel**.
- Foreslået: std ⅓, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2. `contentMinWidth` med disse drivere giver ⅓.
- Ren helt ned til ¼, men højden er da 2319 px mod 1007 px i ⅓ (2.3×); min sænkes kun til ⅓.
- Fleksibel, men mindst 51 % tom plads i alle bredder fra ⅔ og op, og ren i ½: smal.
- Smal profil: max ≤ ½ (tom plads 68 % i ⅔+).

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 2319 | 0 | 0 | 0 | 0 | 50 % | 13 % | 65 % | 50 % | 0 % |
| ⅓ | 376 | 1007 | 0 | 0 | 0 | 0 | 38 % | 11 % | 38 % | 51 % | 0 % |
| ½ | 564 | 787 | 0 | 0 | 0 | 0 | 49 % | 8 % | 49 % | 55 % | 0 % |
| ⅔ | 752 | 714 | 0 | 0 | 0 | 0 | 51 % | 9 % | 51 % | 73 % | 0 % |
| ¾ | 846 | 674 | 0 | 0 | 0 | 0 | 56 % | 11 % | 56 % | 70 % | 0 % |
| 1/1 | 1152 | 674 | 0 | 0 | 0 | 0 | 68 % | 34 % | 68 % | 78 % | 0 % |

### LassoScoreGauge

- Nuværende: std ¼, min ¼, max ½; profil **smal**.
- Foreslået: std ¼, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 73 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 276 | 0 | 0 | 0 | 0 | 39 % | 17 % | 51 % | 39 % | 7 % |
| ⅓ | 376 | 276 | 0 | 0 | 0 | 0 | 55 % | 13 % | 63 % | 55 % | 6 % |
| ½ | 564 | 208 | 0 | 0 | 0 | 0 | 54 % | 20 % | 73 % | 54 % | 9 % |
| ⅔ (uden for regel) | 752 | 208 | 0 | 0 | 0 | 0 | 58 % | 40 % | 80 % | 58 % | 32 % |
| ¾ (uden for regel) | 846 | 208 | 0 | 0 | 0 | 0 | 63 % | 46 % | 82 % | 63 % | 39 % |
| 1/1 (uden for regel) | 1152 | 208 | 0 | 0 | 0 | 0 | 73 % | 61 % | 87 % | 73 % | 56 % |

### LassoScoreHistory

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ⅓, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ⅓ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 592 | 0 | 1 | 2 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ | 376 | 574 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ½ | 564 | 417 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 417 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 417 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 417 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

Eksempler: overlap i ¼: af 100 | −2, mindre risiko.

### LassoCreditRating

- Nuværende: std ½, min ⅓, max 1/1; profil **fleksibel**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ⅓.
- Fleksibel, men mindst 79 % tom plads i alle bredder fra ⅔ og op, og ren i ½: smal.
- Smal profil: max ≤ ½ (tom plads 84 % i ⅔+).
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (fleksibel, nuværende drivere) giver ⅓, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 429 | 0 | 0 | 0 | 0 | 34 % | 5 % | 34 % | 48 % | 0 % |
| ⅓ | 376 | 412 | 0 | 0 | 0 | 0 | 52 % | 3 % | 52 % | 54 % | 0 % |
| ½ | 564 | 395 | 0 | 0 | 0 | 0 | 68 % | 1 % | 68 % | 69 % | 0 % |
| ⅔ | 752 | 395 | 0 | 0 | 0 | 0 | 80 % | 3 % | 80 % | 80 % | 0 % |
| ¾ | 846 | 378 | 0 | 0 | 0 | 0 | 79 % | 6 % | 79 % | 79 % | 0 % |
| 1/1 | 1152 | 378 | 0 | 0 | 0 | 0 | 84 % | 31 % | 84 % | 85 % | 0 % |

### LassoAuditorIndependence

- Nuværende: std 1/1, min ½, max 1/1; profil **bred**.
- Foreslået: std 1/1, min ½, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: longestLabel 44, series 4. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ½ med det realistiske indhold: målingen bærer ikke min ≥ ⅔; fleksibel.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 748 | 0 | 1 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ (under min) | 376 | 630 | 0 | 0 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ | 564 | 564 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 441 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 423 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 317 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

Eksempler: overlap i ¼: Uafhængighedstjek, Nordj | Eksportér PDF.

### LassoProductionUnits

- Nuværende: std 1/1, min ⅔, max 1/1; profil **bred**.
- Foreslået: std 1/1, min ¾, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 54, series 5. `contentMinWidth` med disse drivere giver ¾.
- Bred bekræftet: afkortning/overlap i ½ (0 afkortet, 2 overlap); ren først fra ¾.
- 56 % tom plads i 1/1, men ingen smallere bredde er under 40 %; max beholdes.
- Nuværende min (⅔) har afkortning/overlap/klipning (0 afkortet, 2 overlap, 0 klippet); ren fra ¾.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1538 | 0 | 3 | 7 | 0 | 54 % | 27 % | 60 % | 54 % | 0 % |
| ⅓ (uden for regel) | 376 | 1538 | 0 | 2 | 0 | 0 | 55 % | 29 % | 70 % | 55 % | 0 % |
| ½ (under min) | 564 | 1538 | 0 | 2 | 2 | 0 | 68 % | 51 % | 79 % | 68 % | 0 % |
| ⅔ | 752 | 831 | 0 | 2 | 0 | 0 | 69 % | 46 % | 79 % | 69 % | 0 % |
| ¾ | 846 | 618 | 0 | 0 | 0 | 0 | 63 % | 41 % | 78 % | 63 % | 0 % |
| 1/1 | 1152 | 538 | 0 | 0 | 0 | 0 | 56 % | 42 % | 67 % | 56 % | 0 % |

Eksempler: overlap i ¼: Produktionsenheder | 5 aktive, 1 ophørt; overlap i ⅓: Enhed, adresse og kontak | Branche; overlap i ½: Enhed, adresse og kontak | Branche; overlap i ⅔: Midtjysk Tømrer- og Sned | Opførelse af bygninger.

### LassoProperties

- Nuværende: std ½, min ⅓, max 1/1; profil **smal**.
- Foreslået: std ½, min ½, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2. `contentMinWidth` med disse drivere giver ⅓.
- Smal-profil, men kun 2 % tom plads i ⅔+: kan strækkes; fleksibel.
- Nuværende min (⅓) har afkortning/overlap/klipning (0 afkortet, 0 overlap, 0 klippet); ren fra ½.
- contentMinWidth (smal, nuværende drivere) giver ⅓, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 2354 | 0 | 0 | 0 | 3 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ | 376 | 2285 | 0 | 0 | 0 | 3 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ | 564 | 2206 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 2206 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 2206 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 1287 | 0 | 0 | 0 | 0 | 2 % | 2 % | 2 % | 14 % | 0 % |

### LassoMap

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver ⅔.
- Bred-profil, men ren helt ned til ¼ med det realistiske indhold: målingen bærer ikke min ≥ ⅔; fleksibel.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ⅔, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 222 | 0 | 0 | 0 | 0 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ | 376 | 222 | 0 | 0 | 0 | 0 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ | 564 | 370 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 370 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 370 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 370 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoRegistration

- Nuværende: std 1/1, min ⅔, max 1/1; profil **bred**.
- Foreslået: std 1/1, min ⅔, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45, series 4. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ⅓, men højden er da 3169 px mod 541 px i ⅔ (5.9×); min sænkes kun til ⅔.
- Bred bekræftet: afkortning/overlap i ½ (0 afkortet, 0 overlap); ren først fra ⅔.
- 52 % tom plads i 1/1, men ingen smallere bredde er under 40 %; max beholdes.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅔.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 3169 | 0 | 1 | 0 | 0 | 67 % | 18 % | 67 % | 100 % | 0 % |
| ⅓ (uden for regel) | 376 | 3169 | 0 | 0 | 0 | 0 | 76 % | 29 % | 76 % | 100 % | 0 % |
| ½ (under min) | 564 | 1423 | 0 | 0 | 0 | 0 | 54 % | 36 % | 93 % | 54 % | 3 % |
| ⅔ | 752 | 541 | 0 | 0 | 0 | 0 | 54 % | 52 % | 76 % | 54 % | 3 % |
| ¾ | 846 | 476 | 0 | 0 | 0 | 0 | 56 % | 33 % | 70 % | 56 % | 2 % |
| 1/1 | 1152 | 440 | 0 | 0 | 0 | 0 | 52 % | 52 % | 73 % | 52 % | 3 % |

Eksempler: overlap i ¼: Regnskabsoplysninger | Kapital og vedtægter.

### LassoMergers

- Nuværende: std ½, min ½, max 1/1; profil **bred**.
- Foreslået: std ½, min ½, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 3, longestLabel 44. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ¼, men højden er da 1750 px mod 764 px i ½ (2.3×); min sænkes kun til ½.
- Bred-profil, men ren helt ned til ½, og der er mindst 47 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 55 % i ⅔+).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1750 | 0 | 0 | 0 | 0 | 66 % | 29 % | 77 % | 66 % | 0 % |
| ⅓ (under min) | 376 | 1119 | 0 | 0 | 0 | 0 | 49 % | 20 % | 60 % | 49 % | 8 % |
| ½ | 564 | 764 | 0 | 0 | 0 | 0 | 37 % | 42 % | 46 % | 37 % | 8 % |
| ⅔ | 752 | 649 | 0 | 0 | 0 | 0 | 47 % | 51 % | 56 % | 47 % | 24 % |
| ¾ | 846 | 649 | 0 | 0 | 0 | 0 | 53 % | 56 % | 61 % | 53 % | 32 % |
| 1/1 | 1152 | 452 | 0 | 0 | 0 | 0 | 55 % | 38 % | 71 % | 55 % | 20 % |

### LassoAnnouncements

- Nuværende: std 1/1, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **bred** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 3, longestLabel 44. `contentMinWidth` med disse drivere giver ⅔.
- Fleksibel, men afkortning/overlap i ½ (3 afkortet, 1 overlap); ren først fra 1/1: bred.
- Nuværende min (½) har afkortning/overlap/klipning (3 afkortet, 1 overlap, 0 klippet); ren fra 1/1.
- contentMinWidth (fleksibel, nuværende drivere) giver ⅔, målingen giver 1/1.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 518 | 3 | 3 | 0 | 0 | 62 % | 12 % | 62 % | 100 % | 0 % |
| ⅓ (under min) | 376 | 518 | 3 | 3 | 0 | 0 | 74 % | 16 % | 74 % | 86 % | 0 % |
| ½ | 564 | 500 | 3 | 1 | 0 | 0 | 58 % | 22 % | 76 % | 58 % | 3 % |
| ⅔ | 752 | 404 | 3 | 0 | 0 | 0 | 43 % | 20 % | 65 % | 43 % | 2 % |
| ¾ | 846 | 356 | 2 | 0 | 0 | 0 | 38 % | 18 % | 57 % | 38 % | 2 % |
| 1/1 | 1152 | 356 | 0 | 0 | 0 | 0 | 40 % | 18 % | 50 % | 40 % | 1 % |

Eksempler: afkortet i ¼: "Skifteretten i København har afsagt konkursdekret "; overlap i ¼: Skifteretten i København | Åbn i Statstidende; afkortet i ⅓: "Skifteretten i København har afsagt konkursdekret "; overlap i ⅓: Skifteretten i København | Åbn i Statstidende.

### LassoPublications

- Nuværende: std ½, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std ½, min ½, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: timeAxis, series 4. `contentMinWidth` med disse drivere giver ⅔.
- Fleksibel bekræftet: ren fra ½; tom plads i ⅔+ er 2 %.
- contentMinWidth (fleksibel, nuværende drivere) giver ⅔, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 425 | 0 | 0 | 0 | 1 | 6 % | 12 % | 12 % | 6 % | 6 % |
| ⅓ (under min) | 376 | 425 | 0 | 0 | 0 | 1 | 5 % | 9 % | 9 % | 5 % | 5 % |
| ½ | 564 | 405 | 0 | 0 | 0 | 0 | 3 % | 6 % | 6 % | 3 % | 3 % |
| ⅔ | 752 | 405 | 0 | 0 | 0 | 0 | 2 % | 5 % | 5 % | 2 % | 2 % |
| ¾ | 846 | 405 | 0 | 0 | 0 | 0 | 2 % | 4 % | 4 % | 2 % | 2 % |
| 1/1 | 1152 | 405 | 0 | 0 | 0 | 0 | 1 % | 3 % | 3 % | 1 % | 1 % |

### LassoLivestock

- Nuværende: std ½, min ½, max 1/1; profil **smal**.
- Foreslået: std ½, min ⅓, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: series 3. `contentMinWidth` med disse drivere giver ½.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 53 %.
- Smal profil: max ≤ ½ (tom plads 53 % i ⅔+).
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (smal, nuværende drivere) giver ½, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 742 | 0 | 0 | 8 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅓ (under min) | 376 | 700 | 0 | 0 | 0 | 0 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ | 564 | 653 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 653 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 430 | 0 | 0 | 0 | 0 | 36 % | 8 % | 36 % | 36 % | 2 % |
| 1/1 | 1152 | 430 | 0 | 0 | 0 | 0 | 53 % | 29 % | 53 % | 53 % | 0 % |

### LassoCompareTable

- Nuværende: std 1/1, min ⅔, max 1/1; profil **bred**.
- Foreslået: std 1/1, min ⅔, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45, series 6. `contentMinWidth` med disse drivere giver ¾.
- KRÆVER KOMPONENTÆNDRING: indholdet kræver 2378 px og ruller vandret selv i fuld bredde (1152 px); bredde alene løser det ikke (færre/smallere kolonner, afkortede kolonnenavne eller færre poster).
- Bred: kan ikke gøres ren i nogen bredde; min og max fastholdes indtil komponenten er ændret.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅔.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 311 | 0 | 0 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ (uden for regel) | 376 | 311 | 0 | 0 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ (under min) | 564 | 311 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ | 752 | 311 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ | 846 | 311 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 311 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoRanking

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: longestLabel 45, series 6. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med det realistiske indhold: målingen bærer ikke min ≥ ⅔; fleksibel.
- 49 % tom plads i 1/1, men ingen smallere bredde er under 40 %; max beholdes.
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 377 | 0 | 0 | 0 | 0 | 43 % | 20 % | 46 % | 43 % | 6 % |
| ⅓ | 376 | 353 | 0 | 0 | 0 | 0 | 49 % | 17 % | 49 % | 52 % | 15 % |
| ½ | 564 | 353 | 0 | 0 | 0 | 0 | 47 % | 26 % | 47 % | 48 % | 10 % |
| ⅔ | 752 | 353 | 0 | 0 | 0 | 0 | 48 % | 20 % | 48 % | 58 % | 7 % |
| ¾ | 846 | 353 | 0 | 0 | 0 | 0 | 48 % | 17 % | 48 % | 63 % | 7 % |
| 1/1 | 1152 | 353 | 0 | 0 | 0 | 0 | 49 % | 13 % | 49 % | 70 % | 5 % |

### LassoCompanyTable

- Nuværende: std 1/1, min 1/1, max 1/1; profil **bred**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45, series 8. `contentMinWidth` med disse drivere giver 1/1.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 904 | 0 | 0 | 1 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ (uden for regel) | 376 | 904 | 0 | 0 | 1 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ (uden for regel) | 564 | 871 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ (uden for regel) | 752 | 871 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ (under min) | 846 | 871 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 904 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoPersonTable

- Nuværende: std 1/1, min 1/1, max 1/1; profil **bred**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: series 6. `contentMinWidth` med disse drivere giver 1/1.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 730 | 0 | 0 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ⅓ (uden for regel) | 376 | 730 | 0 | 0 | 0 | 1 | 0 % | 1 % | 1 % | 0 % | 0 % |
| ½ (uden for regel) | 564 | 730 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ⅔ (uden for regel) | 752 | 730 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| ¾ (under min) | 846 | 730 | 0 | 0 | 0 | 1 | 0 % | 0 % | 0 % | 0 % | 0 % |
| 1/1 | 1152 | 708 | 0 | 0 | 0 | 0 | 0 % | 0 % | 0 % | 0 % | 0 % |

### LassoSavedPages

- Nuværende: std 1/1, min 1/1, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45, series 5. `contentMinWidth` med disse drivere giver 1/1.
- Ren helt ned til ⅓, men højden er da 693 px mod 541 px i 1/1 (1.3×); min sænkes kun til ½.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1157 | 0 | 1 | 0 | 0 | 60 % | 6 % | 60 % | 64 % | 0 % |
| ⅓ (uden for regel) | 376 | 693 | 0 | 0 | 0 | 0 | 51 % | 11 % | 51 % | 52 % | 0 % |
| ½ (uden for regel) | 564 | 541 | 0 | 0 | 0 | 0 | 19 % | 13 % | 19 % | 68 % | 0 % |
| ⅔ (uden for regel) | 752 | 541 | 0 | 0 | 0 | 0 | 39 % | 35 % | 39 % | 76 % | 0 % |
| ¾ (under min) | 846 | 541 | 0 | 0 | 0 | 0 | 46 % | 42 % | 46 % | 79 % | 0 % |
| 1/1 | 1152 | 541 | 0 | 0 | 0 | 0 | 60 % | 58 % | 60 % | 84 % | 0 % |

Eksempler: overlap i ¼: Midtjysk Tømrer- og Sned | gemt.

### LassoFollowUps

- Nuværende: std 1/1, min 1/1, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: –. `contentMinWidth` med disse drivere giver 1/1.
- Ren helt ned til ¼, men højden er da 124 px mod 80 px i 1/1 (1.6×); min sænkes kun til ⅔.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 124 | 0 | 0 | 0 | 0 | 5 % | 5 % | 5 % | 5 % | 0 % |
| ⅓ (uden for regel) | 376 | 124 | 0 | 0 | 0 | 0 | 4 % | 4 % | 7 % | 4 % | 0 % |
| ½ (uden for regel) | 564 | 124 | 0 | 0 | 0 | 0 | 36 % | 19 % | 38 % | 36 % | 16 % |
| ⅔ (uden for regel) | 752 | 80 | 0 | 0 | 0 | 0 | 37 % | 18 % | 39 % | 37 % | 11 % |
| ¾ (under min) | 846 | 80 | 0 | 0 | 0 | 0 | 57 % | 14 % | 59 % | 57 % | 8 % |
| 1/1 | 1152 | 80 | 0 | 0 | 0 | 0 | 68 % | 37 % | 70 % | 68 % | 32 % |

### LassoPersonHead

- Nuværende: std 1/1, min 1/1, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45. `contentMinWidth` med disse drivere giver 1/1.
- Fast bredde (min = max = 1/1); ingen forslag.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |
| ⅓ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |
| ½ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |
| ⅔ (uden for regel) | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |
| ¾ (under min) | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |
| 1/1 | 1152 | 34 | 0 | 0 | 0 | 0 | 59 % | 59 % | 59 % | 59 % | 59 % |

### LassoPersonStats

- Nuværende: std 1/1, min ½, max 1/1; profil **fleksibel**.
- Foreslået: std 1/1, min ⅓, max 1/1; profil **fleksibel** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45. `contentMinWidth` med disse drivere giver ⅔.
- Fleksibel bekræftet: ren fra ⅓; tom plads i ⅔+ er 29 %.
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (fleksibel, nuværende drivere) giver ⅔, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 90 | 1 | 0 | 0 | 0 | 17 % | 12 % | 38 % | 17 % | 0 % |
| ⅓ (under min) | 376 | 90 | 0 | 0 | 0 | 0 | 21 % | 28 % | 53 % | 21 % | 3 % |
| ½ | 564 | 90 | 0 | 0 | 0 | 0 | 25 % | 52 % | 69 % | 25 % | 13 % |
| ⅔ | 752 | 90 | 0 | 0 | 0 | 0 | 27 % | 64 % | 76 % | 27 % | 18 % |
| ¾ | 846 | 90 | 0 | 0 | 0 | 0 | 28 % | 68 % | 79 % | 28 % | 20 % |
| 1/1 | 1152 | 90 | 0 | 0 | 0 | 0 | 29 % | 77 % | 85 % | 29 % | 23 % |

Eksempler: afkortet i ¼: "Tvangsopl.".

### LassoPersonRoles

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std ⅔, min ½, max 1/1; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45, timeAxis. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ½ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- 68 % tom plads i 1/1, men ingen smallere bredde er under 40 %; max beholdes.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 322 | 0 | 15 | 0 | 0 | 42 % | 24 % | 42 % | 51 % | 0 % |
| ⅓ (under min) | 376 | 322 | 0 | 3 | 0 | 0 | 44 % | 18 % | 44 % | 56 % | 0 % |
| ½ | 564 | 298 | 0 | 0 | 0 | 0 | 59 % | 12 % | 59 % | 64 % | 0 % |
| ⅔ | 752 | 298 | 0 | 0 | 0 | 0 | 60 % | 9 % | 67 % | 60 % | 0 % |
| ¾ | 846 | 298 | 0 | 0 | 0 | 0 | 58 % | 8 % | 71 % | 58 % | 0 % |
| 1/1 | 1152 | 298 | 0 | 0 | 0 | 0 | 68 % | 6 % | 78 % | 68 % | 0 % |

Eksempler: overlap i ¼: 2005 | 2009; overlap i ⅓: 2005 | 2009.

### LassoPersonRoles (show: current)

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std ½, min ½, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ¼, men højden er da 496 px mod 341 px i ½ (1.5×); min sænkes kun til ½.
- Bred-profil, men ren helt ned til ½, og der er mindst 45 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 64 % i ⅔+).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 496 | 0 | 0 | 0 | 0 | 40 % | 15 % | 40 % | 53 % | 0 % |
| ⅓ (under min) | 376 | 436 | 0 | 0 | 0 | 0 | 40 % | 22 % | 40 % | 65 % | 0 % |
| ½ | 564 | 341 | 0 | 0 | 0 | 0 | 26 % | 25 % | 26 % | 77 % | 0 % |
| ⅔ | 752 | 341 | 0 | 0 | 0 | 0 | 45 % | 44 % | 45 % | 82 % | 0 % |
| ¾ | 846 | 341 | 0 | 0 | 0 | 0 | 51 % | 50 % | 51 % | 84 % | 0 % |
| 1/1 | 1152 | 341 | 0 | 0 | 0 | 0 | 64 % | 63 % | 64 % | 89 % | 0 % |

### LassoPersonRoles (show: ended)

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std ½, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ¼, men højden er da 217 px mod 161 px i ½ (1.3×); min sænkes kun til ⅓.
- Bred-profil, men ren helt ned til ⅓, og der er mindst 48 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 66 % i ⅔+).
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 217 | 0 | 0 | 0 | 0 | 34 % | 21 % | 34 % | 53 % | 0 % |
| ⅓ (under min) | 376 | 199 | 0 | 0 | 0 | 0 | 51 % | 29 % | 51 % | 64 % | 0 % |
| ½ | 564 | 161 | 0 | 0 | 0 | 0 | 31 % | 27 % | 31 % | 53 % | 0 % |
| ⅔ | 752 | 161 | 0 | 0 | 0 | 0 | 48 % | 45 % | 48 % | 64 % | 0 % |
| ¾ | 846 | 161 | 0 | 0 | 0 | 0 | 54 % | 51 % | 54 % | 68 % | 0 % |
| 1/1 | 1152 | 161 | 0 | 0 | 0 | 0 | 66 % | 64 % | 66 % | 77 % | 0 % |

### LassoPersonRoles (show: owner)

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std ½, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ¼, men højden er da 239 px mod 161 px i ½ (1.5×); min sænkes kun til ⅓.
- Bred-profil, men ren helt ned til ⅓, og der er mindst 44 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 64 % i ⅔+).
- Målt ren allerede i ⅓; nuværende min (½) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 239 | 0 | 0 | 0 | 0 | 48 % | 15 % | 48 % | 66 % | 0 % |
| ⅓ (under min) | 376 | 199 | 0 | 0 | 0 | 0 | 59 % | 31 % | 59 % | 74 % | 0 % |
| ½ | 564 | 161 | 0 | 0 | 0 | 0 | 26 % | 25 % | 26 % | 82 % | 0 % |
| ⅔ | 752 | 161 | 0 | 0 | 0 | 0 | 44 % | 44 % | 44 % | 86 % | 0 % |
| ¾ | 846 | 161 | 0 | 0 | 0 | 0 | 51 % | 50 % | 51 % | 88 % | 0 % |
| 1/1 | 1152 | 161 | 0 | 0 | 0 | 0 | 64 % | 63 % | 64 % | 91 % | 0 % |

### LassoPersonNetwork

- Nuværende: std ⅔, min ½, max 1/1; profil **bred**.
- Foreslået: std 1/1, min 1/1, max 1/1; profil **bred** (bekræftet).
- Drivere fra det realistiske datasæt: rowsPerItem 3, longestLabel 45, timeAxis. `contentMinWidth` med disse drivere giver ¾.
- Bred bekræftet: afkortning/overlap i ½ (8 afkortet, 0 overlap); ren først fra 1/1.
- 45 % tom plads i 1/1, men ingen smallere bredde er under 40 %; max beholdes.
- Nuværende min (½) har afkortning/overlap/klipning (8 afkortet, 0 overlap, 0 klippet); ren fra 1/1.
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver 1/1.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 399 | 9 | 2 | 0 | 0 | 50 % | 31 % | 50 % | 63 % | 0 % |
| ⅓ (under min) | 376 | 399 | 9 | 1 | 0 | 0 | 51 % | 25 % | 51 % | 57 % | 0 % |
| ½ | 564 | 375 | 8 | 0 | 0 | 0 | 46 % | 17 % | 46 % | 46 % | 0 % |
| ⅔ | 752 | 375 | 6 | 0 | 0 | 0 | 45 % | 18 % | 45 % | 51 % | 0 % |
| ¾ | 846 | 375 | 4 | 0 | 0 | 0 | 48 % | 16 % | 49 % | 48 % | 0 % |
| 1/1 | 1152 | 375 | 0 | 0 | 0 | 0 | 45 % | 12 % | 57 % | 45 % | 0 % |

Eksempler: afkortet i ¼: "Nordjysk Entreprenør- og Ejendomsselskab ApS, dire"; overlap i ¼: 2017 | 2026; afkortet i ⅓: "Nordjysk Entreprenør- og Ejendomsselskab ApS, dire"; overlap i ⅓: 2023 | 2026.

### LassoPersonRisk

- Nuværende: std ½, min ⅓, max 1/1; profil **fleksibel**.
- Foreslået: std ⅓, min ⅓, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ½.
- Ren helt ned til ¼, men højden er da 678 px mod 494 px i ⅓ (1.4×); min sænkes kun til ⅓.
- Fleksibel, men mindst 63 % tom plads i alle bredder fra ⅔ og op, og ren i ½: smal.
- Smal profil: max ≤ ½ (tom plads 79 % i ⅔+).
- contentMinWidth (fleksibel, nuværende drivere) giver ½, målingen giver ⅓.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 678 | 0 | 0 | 0 | 0 | 41 % | 22 % | 52 % | 41 % | 6 % |
| ⅓ | 376 | 494 | 0 | 0 | 0 | 0 | 39 % | 30 % | 39 % | 40 % | 5 % |
| ½ | 564 | 404 | 0 | 0 | 0 | 0 | 49 % | 23 % | 53 % | 49 % | 3 % |
| ⅔ | 752 | 404 | 0 | 0 | 0 | 0 | 63 % | 20 % | 65 % | 63 % | 2 % |
| ¾ | 846 | 368 | 0 | 0 | 0 | 0 | 71 % | 23 % | 71 % | 72 % | 2 % |
| 1/1 | 1152 | 368 | 0 | 0 | 0 | 0 | 79 % | 43 % | 79 % | 79 % | 1 % |

### LassoPersonFacts

- Nuværende: std ⅓, min ¼, max ½; profil **smal**.
- Foreslået: std ⅓, min ¼, max ½; profil **smal** (bekræftet).
- Drivere fra det realistiske datasæt: longestLabel 45. `contentMinWidth` med disse drivere giver ¼.
- Smal bekræftet: ren i ½; tom plads i ⅔+ er 76 %.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ | 282 | 307 | 0 | 0 | 0 | 0 | 39 % | 31 % | 39 % | 40 % | 8 % |
| ⅓ | 376 | 307 | 0 | 0 | 0 | 0 | 43 % | 48 % | 54 % | 43 % | 19 % |
| ½ | 564 | 307 | 0 | 0 | 0 | 0 | 51 % | 66 % | 69 % | 51 % | 45 % |
| ⅔ (uden for regel) | 752 | 307 | 0 | 0 | 0 | 0 | 63 % | 74 % | 77 % | 63 % | 59 % |
| ¾ (uden for regel) | 846 | 307 | 0 | 0 | 0 | 0 | 67 % | 77 % | 80 % | 67 % | 64 % |
| 1/1 (uden for regel) | 1152 | 307 | 0 | 0 | 0 | 0 | 76 % | 83 % | 85 % | 76 % | 73 % |

### LassoChangeFeed

- Nuværende: std 1/1, min ½, max 1/1; profil **bred**.
- Foreslået: std ½, min ½, max ½; profil **smal** (foreslået ændret).
- Drivere fra det realistiske datasæt: rowsPerItem 2, longestLabel 45. `contentMinWidth` med disse drivere giver ¾.
- Ren helt ned til ¼, men højden er da 1645 px mod 1066 px i ½ (1.5×); min sænkes kun til ½.
- Bred-profil, men ren helt ned til ½, og der er mindst 51 % tom plads i alle bredder fra ⅔ og op: smal.
- Smal profil: max ≤ ½ (tom plads 68 % i ⅔+).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ½.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (uden for regel) | 282 | 1645 | 0 | 0 | 0 | 0 | 37 % | 20 % | 37 % | 42 % | 4 % |
| ⅓ (under min) | 376 | 1433 | 0 | 0 | 0 | 0 | 22 % | 13 % | 22 % | 65 % | 3 % |
| ½ | 564 | 1066 | 0 | 0 | 0 | 0 | 33 % | 21 % | 33 % | 59 % | 2 % |
| ⅔ | 752 | 1030 | 0 | 0 | 0 | 0 | 51 % | 37 % | 51 % | 68 % | 2 % |
| ¾ | 846 | 1030 | 0 | 0 | 0 | 0 | 57 % | 44 % | 57 % | 71 % | 1 % |
| 1/1 | 1152 | 1030 | 0 | 0 | 0 | 0 | 68 % | 59 % | 68 % | 79 % | 1 % |

### LassoHeatmap

- Nuværende: std ½, min ⅓, max 1/1; profil **bred**.
- Foreslået: std ½, min ¼, max ¾; profil **fleksibel** (foreslået ændret).
- Drivere fra det realistiske datasæt: timeAxis, series 12. `contentMinWidth` med disse drivere giver ¾.
- Bred-profil, men ren helt ned til ¼ med 10 år på tidsaksen: målingen bærer ikke min ≥ ⅔; fleksibel.
- 54 % tom plads  i 1/1; max sænkes til ¾ (37 %).
- Målt ren allerede i ¼; nuværende min (⅓) er strammere end nødvendigt (min ændres kun, hvis B8 vil bruge det).
- contentMinWidth (bred, nuværende drivere) giver ¾, målingen giver ¼.

| Bredde | px | højde | afkortet | overlap | klippet | v.rulning | tom plads (min af a og b) | (a0) bredeste række | (a) 75-pct. række | (b) typisk hul | til højre for indhold |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ¼ (under min) | 282 | 170 | 0 | 0 | 0 | 0 | 20 % | 13 % | 20 % | 27 % | 1 % |
| ⅓ | 376 | 170 | 0 | 0 | 0 | 0 | 16 % | 11 % | 16 % | 20 % | 0 % |
| ½ | 564 | 218 | 0 | 0 | 0 | 0 | 14 % | 16 % | 21 % | 14 % | 6 % |
| ⅔ | 752 | 218 | 0 | 0 | 0 | 0 | 30 % | 37 % | 40 % | 30 % | 30 % |
| ¾ | 846 | 218 | 0 | 0 | 0 | 0 | 37 % | 44 % | 47 % | 37 % | 37 % |
| 1/1 | 1152 | 218 | 0 | 0 | 0 | 0 | 54 % | 59 % | 61 % | 54 % | 54 % |


## Efter B8 (29.09.2026)

B8 har ført forslagene ind i `GRID_RULES` og registeret (`packages/spec/src/catalog.ts`) og i pakkeren (`grid.ts`, `packPage` i `compose.ts`). Målingen er kørt igen med samme kommandoer (`PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs`); måleren sætter selv bredden (eksplicit width), så kun komponentændringer flytter tallene. Eneste ændrede type er LassoCompareTable (kolonnenavnene ombrydes). `widths-realistic.json` er A13's rå tal; B8-tallene står herunder.

### Acceptkriterier, målt efter B8

| Type | ny std / min / max | målt i | afkortet | overlap | vandret rulning | tom plads | krav | opfyldt |
|---|---|---|---|---|---|---|---|---|
| LassoPersonNetwork | 1/1 / 1/1 / 1/1 | 1/1 (ny min) | 0 | 0 | 0 | 45 % | 0 afkortede navne | ja |
| LassoPersonRoles (show: current) | ½ / ½ / ½ | ½ (ny max) | 0 | 0 | 0 | 26 % | ≤ 30 % tom | ja |
| LassoPersonRoles (show: ended) | ½ / ⅓ / ½ | ½ (ny max) | 0 | 0 | 0 | 31 % | ≤ 30 % tom | nej (1 point over; ⅓ giver 51 %) |
| LassoPersonRoles (show: owner) | ½ / ⅓ / ½ | ½ (ny max) | 0 | 0 | 0 | 26 % | ≤ 30 % tom | ja |
| LassoPersonFacts | ⅓ / ¼ / ½ (uændret) | ½ (max) | 0 | 0 | 0 | 51 % | ≤ 30 % tom | nej: ingen bredde giver ≤ 30 % (¼ 39 %, ⅓ 43 %); kræver en komponentændring |
| LassoCompareTable (6 × 40–45 tegn) | 1/1 / ⅔ / 1/1 | 1/1 | 0 | 0 | 0 (før: 2378 px, rullede) | 0 % | ingen vandret rulning i fuld bredde | ja; ren fra ⅔ (højde 471 px i ⅔, 371 px i 1/1); i ½ og smallere ruller den stadig (598 px) |

### GRID_RULES og profiler, før og efter (kun ændrede)

| Type | før std / min / max | efter std / min / max | profil før | profil efter |
|---|---|---|---|---|
| LassoKeyValueList | ½ / ½ / 1/1 | ½ / ½ / ½ | smal | smal |
| LassoShortcuts | ½ / ¼ / 1/1 | ½ / ¼ / ½ | smal | smal |
| LassoSummary | 1/1 / ½ / 1/1 | ¾ / ¼ / ¾ | fleksibel | fleksibel |
| LassoTimeline | ½ / ⅓ / 1/1 | ⅓ / ¼ / ½ | bred | smal |
| LassoNews | ½ / ⅓ / 1/1 | ¾ / ¾ / 1/1 | fleksibel | bred |
| LassoKeyFigureCards | 1/1 / ½ / 1/1 | 1/1 / ⅓ / 1/1 | fleksibel | fleksibel |
| LassoBarChart | ½ / ⅓ / 1/1 | ½ / ⅓ / 1/1 | bred | fleksibel |
| LassoGroupedBarChart | ½ / ⅓ / 1/1 | ½ / ¼ / 1/1 | bred | fleksibel |
| LassoLineChart | ½ / ⅓ / 1/1 | ½ / ¼ / 1/1 | bred | fleksibel |
| LassoStackedBarChart | ½ / ⅓ / 1/1 | ½ / ¼ / 1/1 | bred | fleksibel |
| LassoShareBars | ½ / ¼ / ½ | ½ / ½ / ½ | smal | smal |
| LassoWaterfallChart | ½ / ⅓ / 1/1 | ½ / ¼ / 1/1 | bred | fleksibel |
| LassoMultiYearTable | ½ / ½ / 1/1 | ⅔ / ⅔ / ⅔ | bred | bred |
| LassoIncomeStatement | ½ / ½ / ¾ | ½ / ½ / ½ | bred | smal |
| LassoBalanceSheet | ½ / ½ / ¾ | ⅓ / ⅓ / ½ | bred | smal |
| LassoCashFlow | ½ / ½ / ¾ | ⅓ / ⅓ / ½ | bred | smal |
| LassoMergers | ½ / ½ / 1/1 | ½ / ½ / ½ | bred | smal |
| LassoAnnouncements | 1/1 / ½ / 1/1 | 1/1 / 1/1 / 1/1 | fleksibel | bred |
| LassoOwnershipDiagram | ⅔ / ½ / 1/1 | ⅔ / ⅔ / 1/1 | bred | bred |
| LassoRanking | ½ / ⅓ / 1/1 | ½ / ¼ / 1/1 | bred | fleksibel |
| LassoCreditRating | ½ / ⅓ / 1/1 | ⅓ / ¼ / ½ | fleksibel | smal |
| LassoRiskObservations | ½ / ⅓ / 1/1 | ⅓ / ⅓ / ½ | fleksibel | smal |
| LassoAuditorIndependence | 1/1 / ½ / 1/1 | 1/1 / ½ / 1/1 | bred | fleksibel |
| LassoScoreHistory | ½ / ⅓ / 1/1 | ½ / ⅓ / 1/1 | bred | fleksibel |
| LassoProductionUnits | 1/1 / ⅔ / 1/1 | 1/1 / ¾ / 1/1 | bred | bred |
| LassoProperties | ½ / ⅓ / 1/1 | ½ / ½ / 1/1 | smal | fleksibel |
| LassoMap | ½ / ⅓ / 1/1 | ½ / ⅓ / 1/1 | bred | fleksibel |
| LassoLivestock | ½ / ½ / 1/1 | ½ / ⅓ / ½ | smal | smal |
| LassoPersonRoles | ⅔ / ½ / 1/1 | ⅔ / ½ / 1/1 | bred | fleksibel |
| LassoPersonNetwork | ⅔ / ½ / 1/1 | 1/1 / 1/1 / 1/1 | bred | bred |
| LassoPersonRisk | ½ / ⅓ / 1/1 | ⅓ / ⅓ / ½ | fleksibel | smal |
| LassoPersonStats | 1/1 / ½ / 1/1 | 1/1 / ⅓ / 1/1 | fleksibel | fleksibel |
| LassoChangeFeed | 1/1 / ½ / 1/1 | ½ / ½ / ½ | bred | smal |
| LassoHeatmap | ½ / ⅓ / 1/1 | ½ / ¼ / ¾ | bred | fleksibel |
| LassoKeyValueList variant:financials | ½ / ½ / 1/1 | ½ / ½ / ½ | smal | smal |
| LassoPersonRoles show:current | ⅔ / ½ / 1/1 | ½ / ½ / ½ | bred | smal |
| LassoPersonRoles show:ended | ⅔ / ½ / 1/1 | ½ / ⅓ / ½ | bred | smal |
| LassoPersonRoles show:owner | ⅔ / ½ / 1/1 | ½ / ⅓ / ½ | bred | smal |

Afvigelser fra forslagstabellen (eskaleret): **LassoBarChart og LassoMap beholder min ⅓** (forslaget var ¼). Med min ¼ ændrer Papers default-side (23.3) elementer for demovirksomhederne: grafen i ¼ giver plads til historikken (Eksempel Revision Nord, Tømrer, Energi, Landbrug: + LassoTimeline), og kortet i ¼ kommer med ved siden af relationerne (Eksempel Transport, Rådgivning, Maskinfabrik, Ejendomme: + LassoMap). Profilen (fleksibel) er ført ind.

### Pakkeren

- **Mindstebredde efter indhold:** `packPage` (og dashboardet i LassoView) giver pakkeren `contentWidthOf(c, ds)` = `contentMinWidth(profil, typens min, driversOf(c, ds))` inden for typens min–max. `driversOf` regner driverne ud fra Dataset: netværk (selskaber pr. person, længste selskab + rolle, år fra første fælles selskab), roller (roller pr. selskab, selskabsnavne, tidsakse kun for tidsbåndet), ejerdiagram (længste knudenavn), grafer og flerårstabel (år > 5 = tidsakse, serier), sammenligning og rangering (antal virksomheder, længste navn), nyheder (uddrag = 3 rækker), P-enheder og revisoruafhængighed (længste navn). Uden data bruges profilen alene (`defaultMinWidth`). Et element med mindstebredde 1/1 står i eget bånd; hæver contentMinWidth over typens max (flerårstabellen), er max grænsen.
- **Smal ved siden af andre:** højst `sharedMaxWidth` (½) i et delt bånd; alene i et bånd står den i fuld bredde som hidtil (23.1).
- **Bred under mindstebredden:** aldrig; elementet får eget bånd eller udelades af højdebudgettet (LOW_RELEVANCE og budgetlogikken er uændret).
- **Tablet og mobil (26.1):** `tabletSpans` giver aldrig en stak færre kolonner end på desktop, og en stak over ½ står alene i sin række (test i `layout.test.ts`); mobil er altid fuld bredde.

### Følger for siderne (demodata, før → efter)

- Default-siden (overblik med budget) har de samme elementer for alle 14 demovirksomheder; kun placeringen af graf/relationer/historik er ændret for Eksempel Revision Midt, Software og Café.
- **Økonomi:** flerårstabellen (10 år, kun ⅔) står ikke længere inden for budgettet ved siden af regnskabslisten og udelades; andelsbjælkerne (og branchemåleren) tager pladsen. "Vis alt" viser den.
- **Risiko:** oplysningerne står ikke længere i ⅔ ved siden af kreditvurderingen (smal højst ½); revisoruafhængigheden (nederst) udelades af budgettet, og observationer/score/scorehistorik (B4-ekstra) kommer med.
- **Historik:** nyhederne står i eget bånd (bred, min ¾); ændringsfeedet (smal ½, meget højt) viger inden for budgettet hos Eksempel Byg for fusionerne; publiceringerne udelades hos 8 af 14, og Statstidende hos Eksempel Energi (alle står på "vis alt").
- **Ejerskab:** ejerdiagrammet står i ¾ ved lange knudenavne (≥ 24 tegn), fx Eksempel Maskinfabrik.
- **Personsiderne** er uændrede: `composePerson` lægger selv ¾ + ¼ og ½ + ½ og bruger ikke pakkeren (se rapporten til Fable).
