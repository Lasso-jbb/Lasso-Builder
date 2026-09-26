# Katalogtest: kundespørgsmål mod komponentbeskrivelserne

Modellen, der vælger værktøj og komponenter i produktion, ser kun teksten i
`packages/spec/src/catalog.ts` (`COMPOSITION_RULES` + komponentkataloget, indsat i
tool-beskrivelserne af `apps/server/src/mcp/server.ts`). Denne fil er facit for, hvad
hvert spørgsmål skal give, og bruges til at efterprøve teksterne, når kataloget ændres.

Hver beskrivelse følger skabelonen *Brug til / Brug ikke når / Kræver / Eksempel*, og
"Brug ikke når" navngiver altid de nærmeste konkurrenter. Siden anden runde har hver
komponent, som `show_company` selv viser, en note "Dækkes af show_company focus X", og
personkomponenterne peger på `show_person`. Facit er derfor oftest et værktøjskald med
focus, ikke en komponentliste; `render_view` er kun rigtigt, når ingen focus dækker.

Testen består, når kompositionsreglerne peger på ét værktøj/én focus, eller (for
render_view) når kun én komponents "Brug til" passer, og konkurrenternes "Brug ikke når"
peger væk.

## Runde 2 (26.09.2026): alle spørgsmål mod de omskrevne tekster

| # | Type | Kundespørgsmål | Forventet valg | Afgørende regel i kataloget | Status |
|---|---|---|---|---|---|
| 1 | Bredt | "Fortæl mig om Lasso X" | show_company focus overblik | Routing: bredt → overblik; "Byg IKKE selv en virksomhedsside" | OK |
| 2 | Snævert | "Hvor mange ansatte har Danfoss?" | show_company focus overblik | Routing: snævre stamdataspørgsmål ("hvor mange ansatte") → overblik. KeyFigureCards-noten: "Dækkes af show_company focus oekonomi (og overblik)" | OK |
| 3 | Regnskab, udvikling | "Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?" | show_company focus oekonomi, chart_metric `omsaetning`, years 10 | Routing: omsætning → oekonomi; BarChart-eksemplet nævner chart_metric/years. Serveren vælger selv graftypen (grupperet ved ≥3 år med resultat) | OK |
| 4 | Regnskab, flere nøgletal | "Vis omsætning og resultat for Vestas over de seneste 5 år" | show_company focus oekonomi | GroupedBarChart: "Dækkes af show_company focus oekonomi"; grafreglen 2–3 nøgletal → grupperet | OK |
| 5 | Regnskab, tabel | "Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel" | show_company focus oekonomi (flerårstabel med standardnøgletal) eller render_view LassoMultiYearTable med præcis de 4 metrics | MultiYearTable: "Dækkes af focus oekonomi", men focus vælger standardnøgletal (omsætning/bruttofortjeneste, resultat, egenkapital, ansatte), ikke brugerens fire. Reglen "elementer, ingen focus dækker" afgør ikke, om et bestemt metric-valg tæller | Delvist |
| 6 | Sammenligning, navngivne | "Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte" | render_view LassoCompareTable | Flere virksomheder → render_view; 3 navngivne × 3 nøgletal. Ranking afviser (flere nøgletal), LineChart afviser (3 virksomheder) | OK |
| 7 | Sammenligning, søgning | "Vis de 20 største revisionsfirmaer i Aarhus efter ansatte" | search_companies med sort | Routing: mange fundet med kriterier → search_companies; CompanyTable siger selv "står søgningen alene, så brug search_companies" | OK |
| 8 | Ejerskab + revisor | "Hvem ejer Lasso X, og hvem er revisor?" | render_view: LassoCompanyHead, LassoOwnerList, LassoKeyValueList variant 'company' | Kombination på tværs af focus (ejere + revisor) → render_view med alt i én spec. OwnerList afviser nu "hvem er revisor" og peger på KeyValueList | OK |
| 8b | Ejerskab, reelle | "Hvem er de reelle ejere bag Lasso X?" | show_company focus ejerskab | Routing: reelle ejere → ejerskab; BeneficialOwners "Dækkes af focus ejerskab" | OK |
| 8c | Ejerskab, koncern | "Hvilke datterselskaber har X, og hvem er moderselskabet?" | show_company focus ejerskab | Routing: koncern → ejerskab; OwnershipDiagram "vises, når der er selskabsejere". Har virksomheden kun personejere, viser serveren intet diagram, og render_view LassoOwnershipDiagram er alternativet | OK |
| 9 | Risiko | "Er der risikosignaler hos X, kan vi handle med dem?" | show_company focus risiko | Routing: "kan vi handle med dem" → risiko. ScoreGauge: "vælg aldrig til en kunde" | OK |
| 9b | Risiko, revisor | "Er revisor for X uafhængig af ledelsen?" | show_company focus risiko | Routing: revisors uafhængighed → risiko; AuditorIndependence "Dækkes af focus risiko" | OK |
| 10 | Ejendomme | "Hvilke ejendomme ejer X, og hvor store er bygningerne?" | render_view: LassoCompanyHead + LassoProperties | Properties: "Dækkes ikke af show_company" og nævnt i reglen som eksempel på render_view til én virksomhed | OK |
| 11 | Kontakt | "Hvad er telefonnummer og e-mail på Lasso X?" | show_company focus kontakt | Routing: kontaktoplysninger, telefon, e-mail → kontakt; Contact-eksemplet peger samme sted | OK |
| 12 | Kontaktpersoner | "Hvem kan jeg kontakte hos Lasso X?" | show_company focus kontakt | Routing: kontaktpersoner → kontakt; ContactPersons afviser ledelse (PersonList) og hovednumre (Contact) | OK |
| 13 | Fuldt regnskab | "Vis hele resultatopgørelsen for X" | show_company focus regnskab | Routing: resultatopgørelse, "alle posterne" → regnskab; IncomeStatement "Dækkes af focus regnskab", KeyValueList financials afviser (alle regnskabslinjer → IncomeStatement) | OK |
| 14 | Nøgletal, nyt | "Hvad er soliditetsgraden hos X?" | show_company focus oekonomi (alternativt render_view LassoKeyFigureCards metrics `["soliditetsgrad"]`) | Routing nævner soliditetsgrad → oekonomi; KeyFigureCards-eksemplet nævner "hvad er soliditetsgraden" med ét metric; ShareBars afviser (soliditetsgrad som tal → KeyFigureCards) | OK |
| 15 | Person | "Hvor sidder Mette Holm i bestyrelser?" | show_person | Routing: én person → show_person, "Byg ikke personsider med render_view"; alle fire LassoPerson* siger "Dækkes af show_person" | OK |

## Fund fra første audit, rettet i runde 2

- **grid-2 fjernet:** kompositionsreglerne nævnte layout 'grid-2' som virksomhedssidens
  form. Virksomhedssider bygges nu af serveren; render_view bruger 'dashboard', og
  LassoRelations beskriver bredden som ¼ ved siden af ¾.
- **LassoSummary under én-visnings-reglen:** før inviterede beskrivelsen til et ekstra
  kald. Nu står det, at den altid indgår som sidste komponent i én render_view-spec sammen
  med datakomponenterne, aldrig alene og aldrig efter show_company.
- **"Dækkes af show_company focus X":** alle komponenter, som en focus viser, siger det nu
  (overblik, oekonomi, regnskab, ejerskab, ledelse, risiko, historik, kontakt); de øvrige
  siger "Dækkes ikke af show_company". Personkomponenter: "Dækkes af show_person".
- **"Ubekræftet" fjernet** for ejergraf, reelle ejere, observationer, BBR og
  XBRL-regnskabet (metode og sti bekræftet af Lasso 26.09.2026, se
  `docs/lasso-endpoints.md`). Teksterne beskriver nu kun den tomme tilstand.
- **"Hvem er revisor":** OwnerList hed før "Legale ejere og revisor" og var facit for
  revisorspørgsmål. Nu er den "Legale ejere", afviser eksplicit revisorspørgsmål og peger
  på LassoKeyValueList variant 'company' (eller show_company focus overblik).
- **KeyValueList financials:** påstanden "ALLE regnskabstal for ét år" passede ikke til
  koden. Komponenten viser de 11 nøgletal (`FINANCIALS_ROW_METRICS` + omsætning/
  bruttofortjeneste) plus regnskabsperiode og udgivelsesdato, med årsvælger for de
  seneste 5 år; alle regnskabslinjer er LassoIncomeStatement/LassoBalanceSheet.
- **Nye nøgletal:** Metric-listen i props kommer fra `METRICS` og omfatter nu ebitda,
  balancesum, gaeld, soliditetsgrad, overskudsgrad og likviditetsgrad; KeyFigureCards,
  ShareBars og StackedBarChart nævner soliditetsgrad/gaeld som alternativer.
- **Ny routing i COMPOSITION_RULES:** kontakt → focus kontakt, fuldt regnskab → focus
  regnskab, person → show_person, kombination på tværs af focus → render_view med alt i én
  spec.
- **LassoFollowUps:** påstanden om, at show_company selv sætter knapper, blev fjernet
  (compose.ts tilføjer ingen); noten siger nu blot, at knapper ikke kan lægges på en
  show_company-visning.

## Stadig åbent

- **#5 (bestemte nøgletal i tabel):** reglen skelner ikke mellem "focus dækker
  komponenten" og "focus dækker brugerens præcise valg af nøgletal". Skal focus oekonomi
  altid vinde, bør show_company få en `metrics`-parameter til flerårstabellen; ellers bør
  reglen sige, at et navngivet nøgletalssæt uden for standardsættet giver render_view.
- **#2 og andre snævre spørgsmål:** facit er nu en hel overbliksside for "hvor mange
  ansatte". Det er en bevidst afvejning (serveren bygger siden, én visning pr. svar), men
  hvis overblikket føles for stort til ét tal, skal enten focus overblik have en
  "kort"-variant, eller reglen sende snævre talspørgsmål til render_view med ét
  LassoKeyFigureCards.

## Grænsetilfælde fra første runde (fortsat gældende)

- **OwnerList vs. OwnershipDiagram:** OwnerList er standardvalget; diagrammet kræver
  strukturord (koncern, moderselskab, datterselskaber, ejerstruktur).
- **BarChart vs. GroupedBarChart vs. MultiYearTable:** afgøres af antal nøgletal i
  spørgsmålet (1 / 2–3 / 4+ eller ordet "tabel").
- **LineChart vs. CompareTable vs. Ranking:** afgøres af antal virksomheder og nøgletal
  (2 × 1 over tid / 2–6 × flere / 2–10 × 1).
- **KeyFigureCards vs. KeyValueList financials:** "tal med ændring" mod "nøgletal for ét
  år med årsvælger".
- **ScoreGauge og Livestock:** siger eksplicit, at der ingen live data er, og peger på det,
  der skal vælges i stedet.
- **Relations vs. PersonList + OwnerList:** Relations kun i smal kolonne, og den erstatter
  begge lister, ikke den ene.
