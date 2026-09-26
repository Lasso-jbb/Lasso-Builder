# Katalogtest: 10 kundespørgsmål mod komponentbeskrivelserne

Modellen, der vælger komponenter i produktion, ser kun teksten i
`packages/spec/src/catalog.ts` (indsat i tool-beskrivelserne af
`apps/server/src/mcp/server.ts`). Denne fil er facit for, hvilken komponent hvert
spørgsmål skal give, og bruges til at efterprøve beskrivelserne, når kataloget ændres.

Hver beskrivelse følger skabelonen *Brug til / Brug ikke når / Kræver / Eksempel*, og
"Brug ikke når" navngiver altid de nærmeste konkurrenter. Testen består, når kun én
komponents "Brug til" passer, og alle konkurrenters "Brug ikke når" peger væk.

| # | Type | Kundespørgsmål | Forventet valg | Afgørende regel i kataloget |
|---|---|---|---|---|
| 1 | Bredt | "Fortæl mig om Lasso X" | show_company, eller render_view grid-2: LassoCompanyHead, LassoKeyFigureCards, LassoBarChart ved siden af LassoKeyValueList, LassoRelations, LassoTimeline, LassoNews, LassoFollowUps | Kompositionsblok: bredt spørgsmål → overblik i fast rækkefølge, højst én graf; LassoRelations erstatter PersonList + OwnerList i smal kolonne |
| 2 | Snævert | "Hvor mange ansatte har Danfoss?" | LassoKeyFigureCards, metrics `["ansatte"]` | Kompositionsblok: snævert → ét lille element. KeyFigureCards "ét tal med udvikling"; KeyValueList afviser (tal skal have ændring), BarChart afviser (kun seneste år) |
| 3 | Regnskab, udvikling | "Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?" | LassoBarChart, metric `omsaetning`, years 10 | Ét nøgletal over år. GroupedBarChart kræver 2–3 nøgletal, LineChart kræver benchmark, MultiYearTable kræver ønske om tabel/4+ nøgletal |
| 4 | Regnskab, flere nøgletal | "Vis omsætning og resultat for Vestas over de seneste 5 år" | LassoGroupedBarChart, metrics `["omsaetning","resultat"]` | To nøgletal nævnt sammen → 2–3 nøgletal. BarChart afviser (>1 nøgletal); MultiYearTable afviser (2–3 nøgletal uden tabelønske) |
| 5 | Regnskab, tabel | "Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel" | LassoMultiYearTable | 4 nøgletal + ordet "tabel". GroupedBarChart afviser (4+), KeyValueList afviser (flere år) |
| 6 | Sammenligning, navngivne | "Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte" | LassoCompareTable | 3 navngivne, 3 nøgletal. Ranking afviser (flere nøgletal), LineChart afviser (3 virksomheder), CompanyTable afviser (kendte virksomheder, ikke kriterier) |
| 7 | Sammenligning, søgning | "Vis de 20 største revisionsfirmaer i Aarhus efter ansatte" | LassoCompanyTable (eller search_companies) med sort | Virksomhederne skal findes med kriterier. Ranking og CompareTable afviser (kræver navngivne virksomheder) |
| 8 | Ejerskab | "Hvem ejer Lasso X, og hvem er revisor?" | LassoOwnerList | "hvem ejer X" er standardvalget. BeneficialOwners kræver "reelle"/"i sidste ende"/"personerne bag"; OwnershipDiagram kræver "koncern"/"moderselskab"/"datterselskaber"/"ejerstruktur" |
| 8b | Ejerskab, reelle | "Hvem er de reelle ejere bag Lasso X?" | LassoBeneficialOwners | Ordet "reelle" udløser den; OwnerList afviser eksplicit ved det ord |
| 8c | Ejerskab, koncern | "Hvilke datterselskaber har X, og hvem er moderselskabet?" | LassoOwnershipDiagram | "datterselskaber"/"moderselskab" er kun nævnt i diagrammet; OwnerList og BeneficialOwners afviser begge ved de ord |
| 9 | Risiko | "Er der risikosignaler hos X, kan vi handle med dem?" | LassoRiskObservations (+ LassoCompanyHead) | ScoreGauge siger "KUN demo, vælg aldrig til kunde, vælg LassoRiskObservations". AuditorIndependence kræver revisor + uafhængighed |
| 9b | Risiko, revisor | "Er revisor for X uafhængig af ledelsen?" | LassoAuditorIndependence | "revisor" sammen med "uafhængig". OwnerList afviser ikke selv, men AuditorIndependence er den eneste, hvis "Brug til" nævner uafhængighed; RiskObservations peger eksplicit til den |
| 10 | Ejendomme | "Hvilke ejendomme ejer X, og hvor store er bygningerne?" | LassoProperties (med forbehold om tom tilstand) | "ejendomme"/"bygninger" nævnes kun her. ProductionUnits afviser (ejendomme → Properties); OwnershipDiagram gælder selskaber, ikke bygninger |

## Grænsetilfælde, der blev rettet under testen

- **OwnerList vs. OwnershipDiagram:** det gamle katalog sendte "hvem ejer X" til
  diagrammet. Nu er OwnerList standardvalget, og diagrammet kræver strukturord
  (koncern, moderselskab, datterselskaber, ejerstruktur).
- **BarChart vs. GroupedBarChart vs. MultiYearTable:** afgøres nu af antal nøgletal i
  spørgsmålet (1 / 2–3 / 4+ eller ordet "tabel"), ikke af smag.
- **LineChart vs. CompareTable vs. Ranking:** afgøres af antal virksomheder og nøgletal
  (2 virksomheder × 1 nøgletal over tid / 2–6 × flere nøgletal / 2–10 × 1 nøgletal).
- **KeyFigureCards vs. KeyValueList financials:** "tal med ændring" mod "alle tal for ét
  år med årsvælger".
- **ScoreGauge og Livestock:** siger nu eksplicit, at der ingen live data er, og peger
  på den komponent, der skal vælges i stedet.
- **Relations vs. PersonList + OwnerList:** Relations kun i smal kolonne på overblik, og
  den erstatter begge lister, ikke den ene.
