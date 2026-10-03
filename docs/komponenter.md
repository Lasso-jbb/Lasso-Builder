# Komponenter

Denne fil er genereret fra komponentregisteret (`packages/spec/src/catalog.ts`) og må ikke redigeres i hånden; ret registeret og kør `npm run docs:komponenter -w @lasso/spec`.
En test fejler, hvis filen ikke er ajour.

## Indhold

- [Virksomhedshoved (`LassoCompanyHead`)](#LassoCompanyHead)
- [Nøgle-værdi-liste (`LassoKeyValueList`)](#LassoKeyValueList)
- [Kontaktblok (`LassoContact`)](#LassoContact)
- [Kontaktpersoner (`LassoContactPersons`)](#LassoContactPersons)
- [Genveje (`LassoShortcuts`)](#LassoShortcuts)
- [Tekstsektioner (`LassoTextSections`)](#LassoTextSections)
- [Resumé (`LassoSummary`)](#LassoSummary)
- [Tidslinje (`LassoTimeline`)](#LassoTimeline)
- [Nyheder (`LassoNews`)](#LassoNews)
- [Nøgletalskort (`LassoKeyFigureCards`)](#LassoKeyFigureCards)
- [Søjlegraf, ét nøgletal (`LassoBarChart`)](#LassoBarChart)
- [Grupperede søjler, 2–3 nøgletal (`LassoGroupedBarChart`)](#LassoGroupedBarChart)
- [Linjegraf med benchmark (`LassoLineChart`)](#LassoLineChart)
- [Stablede søjler, balance (`LassoStackedBarChart`)](#LassoStackedBarChart)
- [Andelsbjælker, balance seneste år (`LassoShareBars`)](#LassoShareBars)
- [Vandfald, omsætning til resultat (`LassoWaterfallChart`)](#LassoWaterfallChart)
- [Nøgletalsmåler, mod branchen (`LassoKeyFigureGauge`)](#LassoKeyFigureGauge)
- [Flerårstabel (`LassoMultiYearTable`)](#LassoMultiYearTable)
- [Resultatopgørelse, fuld (`LassoIncomeStatement`)](#LassoIncomeStatement)
- [Balance, fuld (`LassoBalanceSheet`)](#LassoBalanceSheet)
- [Pengestrømsopgørelse (`LassoCashFlow`)](#LassoCashFlow)
- [Regnskabsdetaljer med værktøjslinje (`LassoFinancialStatements`)](#LassoFinancialStatements)
- [Fusioner og spaltninger (`LassoMergers`)](#LassoMergers)
- [Regnskabsoplysninger og kapital (`LassoRegistration`)](#LassoRegistration)
- [Statstidende (`LassoAnnouncements`)](#LassoAnnouncements)
- [Relationer over tid (`LassoRelationsTable`)](#LassoRelationsTable)
- [Stamdata historik (`LassoCompanyHistory`)](#LassoCompanyHistory)
- [Regnskabspublicering (`LassoPublications`)](#LassoPublications)
- [Ledelse og bestyrelse (`LassoPersonList`)](#LassoPersonList)
- [Legale ejere (`LassoOwnerList`)](#LassoOwnerList)
- [Reelle ejere (`LassoBeneficialOwners`)](#LassoBeneficialOwners)
- [Ejerdiagram, koncern (`LassoOwnershipDiagram`)](#LassoOwnershipDiagram)
- [Rolleliste, kompakt (`LassoRelations`)](#LassoRelations)
- [Sammenligning, navngivne virksomheder (`LassoCompareTable`)](#LassoCompareTable)
- [Rangliste, ét nøgletal (`LassoRanking`)](#LassoRanking)
- [Virksomhedstabel, søgning (`LassoCompanyTable`)](#LassoCompanyTable)
- [Persontabel, navnesøgning (`LassoPersonTable`)](#LassoPersonTable)
- [Kreditvurdering, Creditsafe (`LassoCreditRating`)](#LassoCreditRating)
- [Risikoobservationer (`LassoRiskObservations`)](#LassoRiskObservations)
- [Risikoscore (`LassoScoreGauge`)](#LassoScoreGauge)
- [Produktionsenheder, P-numre (`LassoProductionUnits`)](#LassoProductionUnits)
- [Ejendomme, BBR (`LassoProperties`)](#LassoProperties)
- [Kort, adresser og P-enheder (`LassoMap`)](#LassoMap)
- [CHR, husdyr (`LassoLivestock`)](#LassoLivestock)
- [Personhoved (`LassoPersonHead`)](#LassoPersonHead)
- [Roller over tid (`LassoPersonRoles`)](#LassoPersonRoles)
- [Personnetværk (`LassoPersonNetwork`)](#LassoPersonNetwork)
- [Personrisiko (`LassoPersonRisk`)](#LassoPersonRisk)
- [Netværkstal, person (`LassoPersonStats`)](#LassoPersonStats)
- [Stamoplysninger, person (`LassoPersonFacts`)](#LassoPersonFacts)
- [Ændringsfeed, overvågede virksomheder (`LassoChangeFeed`)](#LassoChangeFeed)
- [Heatmap, aktivitet pr. måned (`LassoHeatmap`)](#LassoHeatmap)
- [Gemte sider (`LassoSavedPages`)](#LassoSavedPages)
- [Opfølgningsknapper (`LassoFollowUps`)](#LassoFollowUps)
- [Oversigt](#oversigt)

<a id="LassoCompanyHead"></a>
## Virksomhedshoved (`LassoCompanyHead`)

**Formål.** Virksomhedens navn og handlinger øverst i en visning; status kun ved afvigelse.

**Bedst til**
- identitet
- overskrift på enhver virksomhedsvisning

**Undgå når**
- kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company')
- flere virksomheder (LassoCompareTable/LassoCompanyTable)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `companies`

**Live-tilgængelighed.** altid

**Bredde.** profil fleksibel; std 1/1, min 1/1, maks 1/1; drivere: længste etiket 44 tegn

**Props.** `company, variant? (full | compact | line), risk? (udgået, vises ikke)`

<a id="LassoKeyValueList"></a>
## Nøgle-værdi-liste (`LassoKeyValueList`)

**Formål.** Stamdata eller nøgletal for ét år som nøgle/værdi-liste.

**Bedst til**
- revisor
- stiftet
- status
- branche
- kommune
- telefon
- email
- web
- hvem er revisor
- hvilken kommune ligger X i

**Undgå når**
- tallet skal have ændring mod året før (LassoKeyFigureCards)
- flere år side om side (LassoMultiYearTable)
- alle regnskabslinjer (LassoIncomeStatement/LassoBalanceSheet)
- formål/tegningsregler (LassoTextSections)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `companies`, `ownership`, `financials`

**Live-tilgængelighed.** altid

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: længste etiket 45 tegn

**Bredde pr. variant.**
- `variant:financials`: profil smal; std ½, min ½, maks ½; drivere: ingen

**Props.** `company, variant? (company | financials), title?, exclude? (kun financials), only? (kun financials: nøgletal), year? (kun financials: regnskabsår), fields? (kun financials: udgivet | periode | erklaering | fremhaevelser | goingconcern | nøgletal | resultatfoerskat | afkastningsgrad | pdf), rows? (kun company: revisor | revisorskift | regnskabsperiode | stiftet | form | branche | ansatte | adresse | branchekode | kommune | region | telefon | email | web | firmanavn | cvr | binavne | status | reklamebeskyttet | vedtaegtsaendring | regnskabsaar | senesteregnskab | selskabskapital | boersnoteret | underskriverrevisor | formaal | tegningsregel | brancher | valuation), look? (kun company: list | card), years? (2–5, kun financials), maxRows? (1–20), view? (short | full)`

<a id="LassoContact"></a>
## Kontaktblok (`LassoContact`)

**Formål.** Telefon, e-mail, web og adresse som klikbare kontaktoplysninger.

**Bedst til**
- telefon
- email
- web
- adresse
- telefonnummer på X
- hvordan kontakter jeg X

**Undgå når**
- stamdata som stiftet/form/revisor (LassoKeyValueList variant 'company')
- navngivne personer (LassoContactPersons)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `contact`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ¼, maks ½; drivere: ingen

**Props.** `company, title?`

<a id="LassoContactPersons"></a>
## Kontaktpersoner (`LassoContactPersons`)

**Formål.** Navngivne kontaktpersoner fra virksomhedens hjemmeside med rolle, telefon og e-mail.

**Bedst til**
- kontaktpersoner
- hvem kan jeg kontakte hos X

**Undgå når**
- direktion/bestyrelse i CVR (LassoPersonList)
- virksomhedens hovednumre (LassoContact)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `contactPersons`, `companies`, `contact`

**Live-tilgængelighed.** når data findes — Virksomheden har ingen hjemmeside, Lasso kan hente kontaktpersoner fra.

**Bredde.** profil smal; std ⅓, min ¼, maks ½; drivere: 3 rækker pr. post, længste etiket 44 tegn

**Props.** `company, title?`

<a id="LassoShortcuts"></a>
## Genveje (`LassoShortcuts`)

**Formål.** Knapper, der åbner et Lasso-modul på virksomheden.

**Bedst til**
- hvad kan jeg ellers se om X
- genveje til ejerdiagram, nøgletal og ejendomme

**Undgå når**
- svaret er selve dataene (vis elementet direkte, fx LassoOwnershipDiagram)
- værten ikke kan åbne sektioner

**Veje ind.** focus, render_view

**Kræver data (Dataset).** `companies`

**Live-tilgængelighed.** altid

**Bredde.** profil smal; std ½, min ¼, maks ½; drivere: længste etiket 44 tegn

**Props.** `company, tools? (ejerdiagram | regnskabsanalyse | noegletal | ejendomme | tinglysning | firmaindsigt | ledelse | kontakt | historik | risiko | overblik | stamoplysninger | nyheder), title?`

<a id="LassoTextSections"></a>
## Tekstsektioner (`LassoTextSections`)

**Formål.** Formål, tegningsregler og regnskabsanalysens afsnit som korte tekstsektioner.

**Bedst til**
- formaal
- hvad laver X
- hvem kan tegne selskabet
- regnskabsanalyse

**Undgå når**
- feltet er en kort værdi som stiftet/form/revisor (LassoKeyValueList variant 'company')
- du selv skriver en vurdering (LassoSummary)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `textSections`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ½, maks ⅔; drivere: ingen

**Props.** `company, variant? (profil | analyse | cvr | resume; cvr og resume bruges af portalens Lasso-side), title?, folded? (kun analyse), limit? (kun profil)`

<a id="LassoSummary"></a>
## Resumé (`LassoSummary`)

**Formål.** Kort skrevet vurdering eller opsummering: modellens egen tekst eller Lassos erhvervsresumé.

**Bedst til**
- egen vurdering
- opsummering som sidste sektion
- fortælling ved siden af nøgletal

**Undgå når**
- tallene selv skal vises (LassoKeyFigureCards, LassoMultiYearTable)
- der findes en færdig komponent til emnet

**Veje ind.** focus, show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `resumes`

**Live-tilgængelighed.** altid

**Bredde.** profil fleksibel; std ½, min ¼, maks ⅔; drivere: ingen

**Props.** `text | resume (Lasso-ID), title?, source? og updated? (vises ikke)`

<a id="LassoTimeline"></a>
## Tidslinje (`LassoTimeline`)

**Formål.** Begivenheder over tid, nyeste øverst, for virksomhed eller person.

**Bedst til**
- historik
- hvad er der sket
- hvornår skiftede de direktør
- hvornår blev X stiftet

**Undgå når**
- tal over år (LassoBarChart)
- nuværende personer (LassoPersonList)
- medieomtale (LassoNews)

**Veje ind.** focus, show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `timeline`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ¼, maks ⅔; drivere: 2 rækker pr. post

**Props.** `company | person, title?, limit?, filter? ('risiko', kun person), kinds? (kun company: stamdata | ledelse | regnskab | status | ejerskab), filterColumn? (true = mønster 6: filtre ¼ + strøm ¾, fuld bredde)`

<a id="LassoNews"></a>
## Nyheder (`LassoNews`)

**Formål.** Medieomtale om virksomhed eller person med kilde, tidspunkt og uddrag.

**Bedst til**
- nyheder
- omtale
- seneste nyt om X

**Undgå når**
- registrerede ændringer i CVR (LassoTimeline)

**Veje ind.** focus, show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `news`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: 3 rækker pr. post

**Props.** `company | person, limit? (1–10, standard 5; højst 3 vises), layout? ('grid'), more? (udgået for nyheder)`

<a id="LassoKeyFigureCards"></a>
## Nøgletalskort (`LassoKeyFigureCards`)

**Formål.** 1–5 nøgletal fra seneste regnskab hver med ændring mod året før.

**Bedst til**
- nøgletal
- omsætning
- resultat
- soliditetsgrad
- hvor mange ansatte
- hvad er omsætningen

**Undgå når**
- udvikling over flere år (LassoBarChart/LassoMultiYearTable)
- alle nøgletal for ét år (LassoKeyValueList variant 'financials')
- stamdata uden tal (LassoKeyValueList variant 'company')

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std 1/1, min ⅓, maks 1/1; drivere: ingen

**Props.** `company, metrics? (1–5 af omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), variant? ('plain')`

<a id="LassoBarChart"></a>
## Søjlegraf, ét nøgletal (`LassoBarChart`)

**Formål.** Udviklingen i ét nøgletal over 2–10 år som søjler.

**Bedst til**
- udvikling i omsætning
- hvordan går det med resultatet over tid

**Undgå når**
- 2–3 nøgletal (LassoGroupedBarChart)
- 4+ nøgletal eller tabel (LassoMultiYearTable)
- kun seneste år (LassoKeyFigureCards)
- egenkapital mod gæld (LassoStackedBarChart)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ⅓, maks 1/1; drivere: tidsakse

**Props.** `company, metric (omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), years (2–10, standard 5)`

<a id="LassoGroupedBarChart"></a>
## Grupperede søjler, 2–3 nøgletal (`LassoGroupedBarChart`)

**Formål.** 2–3 nøgletal side om side pr. år for én virksomhed.

**Bedst til**
- omsætning og resultat over tid
- hvordan går det økonomisk

**Undgå når**
- ét nøgletal (LassoBarChart)
- 4+ nøgletal eller præcise tal (LassoMultiYearTable)
- to virksomheder (LassoLineChart)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ¼, maks ½; drivere: tidsakse, 3 serier side om side

**Props.** `company, metrics (2–3 af omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), years (2–10, standard 5)`

<a id="LassoLineChart"></a>
## Linjegraf med benchmark (`LassoLineChart`)

**Formål.** Ét nøgletal over tid som linje, evt. mod en anden virksomhed eller branchen.

**Bedst til**
- sammenlign to virksomheder over tid
- udvikling mod branchen

**Undgå når**
- ét nøgletal for én virksomhed uden sammenligning (LassoBarChart)
- tabel (LassoMultiYearTable)

**Veje ind.** ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `companies`, `industryBenchmarks`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ½, maks 1/1; drivere: tidsakse, 2 serier side om side

**Props.** `company, metric (omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), years (2–10, standard 5), benchmark? (virksomhed), industry? (true = branchen som indeks)`

<a id="LassoStackedBarChart"></a>
## Stablede søjler, balance (`LassoStackedBarChart`)

**Formål.** Egenkapital og gæld (aktiver mod passiver) som stablede søjler.

**Bedst til**
- balancens sammensætning
- egenkapital mod gæld

**Undgå når**
- ét nøgletal (LassoBarChart)
- andele i procent (LassoShareBars)
- alle balanceposter (LassoBalanceSheet)

**Veje ind.** ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ¼, maks ¾; drivere: tidsakse, 4 serier side om side

**Props.** `company, years (2–10, standard 5)`

<a id="LassoShareBars"></a>
## Andelsbjælker, balance seneste år (`LassoShareBars`)

**Formål.** Dele af en helhed som donut og andelsbjælker (balance eller ejerkreds).

**Bedst til**
- balance
- egenkapital og gæld i procent
- hvordan er ejerskabet fordelt

**Undgå når**
- flere år (LassoMultiYearTable)
- soliditetsgrad som tal (LassoKeyFigureCards)
- ejernes navne og roller (LassoOwnerList)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `ownership`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: 4 serier side om side

**Props.** `company, variant? (balance | ejerkreds)`

<a id="LassoWaterfallChart"></a>
## Vandfald, omsætning til resultat (`LassoWaterfallChart`)

**Formål.** Hvordan omsætning bliver til årets resultat i seneste regnskabsår.

**Bedst til**
- fra omsætning til resultat
- hvor forsvinder pengene hen

**Undgå når**
- udvikling over år (LassoBarChart)
- enkelte tal (LassoKeyFigureCards)
- alle linjer (LassoIncomeStatement)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ⅓, maks 1/1; drivere: 8 serier side om side

**Props.** `company`

<a id="LassoKeyFigureGauge"></a>
## Nøgletalsmåler, mod branchen (`LassoKeyFigureGauge`)

**Formål.** Soliditets-, overskuds- og likviditetsgrad som målere mod branchens median.

**Bedst til**
- hvordan ligger X i forhold til branchen
- er soliditeten god for branchen

**Undgå når**
- udvikling mod branchen (LassoLineChart med industry)
- nøgletal uden sammenligning (LassoKeyFigureCards)
- andre navngivne virksomheder (LassoRanking/LassoCompareTable)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `industryBenchmarks`

**Live-tilgængelighed.** ikke koblet på endnu — Lasso har ingen branchetal for virksomhedens branche endnu.

**Bredde.** profil smal; std ⅓, min ⅓, maks ½; drivere: 3 serier side om side

**Props.** `company, metrics? (soliditetsgrad | overskudsgrad | likviditetsgrad), title?`

<a id="LassoMultiYearTable"></a>
## Flerårstabel (`LassoMultiYearTable`)

**Formål.** Nøgletal × år som præcise tal med ændring og tendens.

**Bedst til**
- tabel over nøgletal
- præcise tal over år
- 4+ nøgletal over tid

**Undgå når**
- ét nøgletal som graf (LassoBarChart)
- 2–3 nøgletal som graf (LassoGroupedBarChart)
- kun ét år (LassoKeyValueList variant 'financials')
- alle regnskabslinjer (LassoIncomeStatement)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std ⅔, min ⅔, maks 1/1; drivere: tidsakse, 10 serier side om side

**Props.** `company, metrics? (1–8 af omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), years (2–10, standard 5), title?, variant? (A | B)`

<a id="LassoIncomeStatement"></a>
## Resultatopgørelse, fuld (`LassoIncomeStatement`)

**Formål.** Hele resultatopgørelsen, kompakt med 2 år og ændring.

**Bedst til**
- resultatopgørelse
- hele resultatopgørelsen
- hvad er årets resultat før skat

**Undgå når**
- fuld bredde med værktøjslinje (LassoFinancialStatements)
- kun nøgletal (LassoKeyFigureCards/LassoMultiYearTable)
- balancen (LassoBalanceSheet)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: tidsakse, 5 serier side om side

**Props.** `company, years? (2–3, standard 2), title?`

<a id="LassoBalanceSheet"></a>
## Balance, fuld (`LassoBalanceSheet`)

**Formål.** Hele balancen (aktiver og passiver), kompakt med 2–3 år.

**Bedst til**
- balance
- aktiver og passiver
- hvor stor er egenkapitalen

**Undgå når**
- kun egenkapital/gæld som andele (LassoShareBars/LassoStackedBarChart)
- ét nøgletal (LassoKeyFigureCards)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ⅓, maks ½; drivere: tidsakse, 5 serier side om side

**Props.** `company, years? (2–3, standard 2), title?`

<a id="LassoCashFlow"></a>
## Pengestrømsopgørelse (`LassoCashFlow`)

**Formål.** Pengestrømsopgørelsen (drift, investering, finansiering), kompakt med 2–3 år.

**Bedst til**
- pengestrøm
- cash flow

**Undgå når**
- resultat (LassoIncomeStatement)
- balance (LassoBalanceSheet)
- fuld bredde (LassoFinancialStatements)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: tidsakse, 5 serier side om side

**Props.** `company, years? (2–3, standard 2), title?`

<a id="LassoFinancialStatements"></a>
## Regnskabsdetaljer med værktøjslinje (`LassoFinancialStatements`)

**Formål.** Det fulde regnskab som ét bredt element med værktøjslinje.

**Bedst til**
- vis hele regnskabet
- regnskabet med koncerntal
- hent årsrapport

**Undgå når**
- ½ ved siden af andet (LassoIncomeStatement/LassoBalanceSheet/LassoCashFlow)
- kun én opgørelse eller nøgletal over år (LassoMultiYearTable)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `financials`, `financialStatements`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std ¾, min ⅔, maks ¾; drivere: tidsakse, 5 serier side om side

**Props.** `company, statement? (income | balance | cashflow), years? (2–5, standard 2), year?, title?`

<a id="LassoMergers"></a>
## Fusioner og spaltninger (`LassoMergers`)

**Formål.** Fusioner og spaltninger som 'fra → til' med dato og type.

**Bedst til**
- har X fusioneret
- hvilke selskaber er fusioneret ind i X
- spaltning

**Undgå når**
- ejerskifte (LassoOwnerList/LassoOwnershipDiagram)
- hele historikken (LassoTimeline)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `companies`, `companyEvents`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: 3 rækker pr. post, længste etiket 44 tegn

**Props.** `company, title?`

<a id="LassoRegistration"></a>
## Regnskabsoplysninger og kapital (`LassoRegistration`)

**Formål.** Registreringsdetaljer fra CVR: revision, regnskabsår, kapital, vedtægter og tegningsregel.

**Bedst til**
- er revisionen fravalgt
- hvilken regnskabsklasse
- hvad er kapitalen
- tegningsregel

**Undgå når**
- kun revisor, stiftelse, form eller branche (LassoKeyValueList variant 'company')
- hele profilen med regnskabsanalyse (LassoTextSections)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `companies`, `ownership`, `financials`, `textSections`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: længste etiket 45 tegn, 4 serier side om side

**Props.** `company, variant? (full | profile), title?`

<a id="LassoAnnouncements"></a>
## Statstidende (`LassoAnnouncements`)

**Formål.** Seneste bekendtgørelser i Statstidende (konkurs, rekonstruktion, likvidation).

**Bedst til**
- står X i Statstidende
- er der bekendtgjort konkurs

**Undgå når**
- CVR-status alene (LassoCompanyHead)
- Creditsafe (LassoCreditRating)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `companies`, `companyEvents`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: 3 rækker pr. post, længste etiket 44 tegn

**Props.** `company, title?`

<a id="LassoRelationsTable"></a>
## Relationer over tid (`LassoRelationsTable`)

**Formål.** Relationer grupperet efter rolle (ledelse, bestyrelse, stiftere, ejere) med fra–til-datoer.

**Bedst til**
- tidligere direktører
- tidligere ejere
- hvem har siddet i bestyrelsen
- hvornår trådte X ind

**Undgå når**
- kun nuværende ledelse (LassoPersonList)
- kun ejerne (LassoOwnerList)

**Veje ind.** focus, render_view

**Kræver data (Dataset).** `companyHistories`, `beneficialOwnership`

**Live-tilgængelighed.** når data findes — Historikken (GET /{lassoId}/history) er ubekræftet for virksomheder; uden den vises de nuværende roller og ejere.

**Bredde.** profil bred; std ⅔, min ⅔, maks ⅔; drivere: 2 rækker pr. post, længste etiket 40 tegn

**Props.** `company, show? (current | former | all), groups?, title?`

<a id="LassoCompanyHistory"></a>
## Stamdata historik (`LassoCompanyHistory`)

**Formål.** Stamdata over tid: navne, adresser, ansatte, branche, kapital og kontakt med fra–til.

**Bedst til**
- tidligere navne
- tidligere adresser
- ansatte over tid
- hvad hed X før

**Undgå når**
- kun nuværende stamdata (LassoKeyValueList)
- regnskabets tal (LassoMultiYearTable)

**Veje ind.** focus, render_view

**Kræver data (Dataset).** `companyHistories`

**Live-tilgængelighed.** når data findes — Historikken (GET /{lassoId}/history) er ubekræftet for virksomheder.

**Bredde.** profil bred; std 1/1, min ⅔, maks 1/1; drivere: 3 rækker pr. post, længste etiket 60 tegn

**Props.** `company, fields?, limit?, title?`

<a id="LassoPublications"></a>
## Regnskabspublicering (`LassoPublications`)

**Formål.** Liste over offentliggjorte regnskaber med dato, type og hovedtal.

**Bedst til**
- hvornår kom regnskabet
- er regnskabet korrigeret

**Undgå når**
- tallene selv skal ses (LassoFinancialStatements/LassoMultiYearTable)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `companyEvents`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ½, maks ½; drivere: tidsakse, 4 serier side om side

**Props.** `company, limit?, title?`

<a id="LassoPersonList"></a>
## Ledelse og bestyrelse (`LassoPersonList`)

**Formål.** Direktion og bestyrelse med rolle og tiltrådt/fratrådt.

**Bedst til**
- direktion
- bestyrelse
- ledelse
- hvem er direktør
- hvem sidder i bestyrelsen
- tidligere direktør

**Undgå når**
- ejere (LassoOwnerList/LassoBeneficialOwners)
- smal kolonne med både personer og ejere (LassoRelations)
- én bestemt person (show_person)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `people`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ¼, maks ½; drivere: 2 rækker pr. post, længste etiket 34 tegn

**Props.** `company, show? (current | all), roles? (direktion | bestyrelse), title?`

<a id="LassoOwnerList"></a>
## Legale ejere (`LassoOwnerList`)

**Formål.** De legale (direkte) ejere med ejerandel som interval.

**Bedst til**
- ejere
- hvem ejer X

**Undgå når**
- reelle ejere, 'i sidste ende' (LassoBeneficialOwners)
- koncern, moderselskab, datterselskaber (LassoOwnershipDiagram)
- hvem er revisor (LassoKeyValueList variant 'company')

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `ownership`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ¼, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn

**Props.** `company`

<a id="LassoBeneficialOwners"></a>
## Reelle ejere (`LassoBeneficialOwners`)

**Formål.** De fysiske personer, der i sidste ende ejer virksomheden, med ejerkæden.

**Bedst til**
- reelle-ejere
- hvem er de reelle ejere
- personerne bag
- gennem holdingselskaber

**Undgå når**
- direkte ejere (LassoOwnerList)
- koncernstruktur som diagram (LassoOwnershipDiagram)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `beneficialOwnership`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ¼, maks ½; drivere: 2 rækker pr. post, længste etiket 30 tegn

**Props.** `company`

<a id="LassoOwnershipDiagram"></a>
## Ejerdiagram, koncern (`LassoOwnershipDiagram`)

**Formål.** Koncernstruktur i flere lag som diagram: ejere over, datterselskaber under.

**Bedst til**
- koncern
- ejerstruktur
- moderselskab
- datterselskaber
- hvordan hænger selskaberne sammen

**Undgå når**
- én liste af direkte ejere (LassoOwnerList)
- personerne i sidste ende (LassoBeneficialOwners)

**Veje ind.** focus, show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `ownershipGraphs`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std ⅔, min ⅔, maks 1/1; drivere: længste etiket 45 tegn

**Props.** `company | person, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate? (ÅÅÅÅ-MM-DD), title?`

<a id="LassoRelations"></a>
## Rolleliste, kompakt (`LassoRelations`)

**Formål.** Direktion, bestyrelse og de tre største ejere i ét kompakt element.

**Bedst til**
- overblik i smal kolonne ved siden af en bred graf

**Undgå når**
- spørgsmålet gælder ledelsen (LassoPersonList) eller ejerne (LassoOwnerList)
- listen står i fuld bredde

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `people`, `ownership`, `beneficialOwnership`, `productionUnits`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ¼, min ¼, maks ⅓; drivere: 2 rækker pr. post, længste etiket 45 tegn

**Props.** `company, title?, full? (også reelle ejere og antal produktionsenheder)`

<a id="LassoCompareTable"></a>
## Sammenligning, navngivne virksomheder (`LassoCompareTable`)

**Formål.** 2–3 navngivne virksomheder side om side på 1–5 nøgletal.

**Bedst til**
- sammenlign A og B
- A vs. B på omsætning og ansatte

**Undgå når**
- ét nøgletal og rækkefølge (LassoRanking)
- mange fundet med kriterier (LassoCompanyTable)

**Veje ind.** compare_companies, render_view

**Kræver data (Dataset).** `companies`, `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std 1/1, min ⅔, maks 1/1; drivere: længste etiket 45 tegn, 6 serier side om side

**Props.** `companies[] (2–3; højst 3 vises, 4 i fuld bredde), metrics? (1–5 af omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), title?`

<a id="LassoRanking"></a>
## Rangliste, ét nøgletal (`LassoRanking`)

**Formål.** 2–10 navngivne virksomheder rangeret på ét nøgletal.

**Bedst til**
- hvem er størst
- rangér A, B og C på omsætning

**Undgå når**
- flere nøgletal (LassoCompareTable)
- mange fundet med kriterier (LassoCompanyTable)
- to virksomheder over tid (LassoLineChart)

**Veje ind.** compare_companies, render_view

**Kræver data (Dataset).** `companies`, `financials`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ¼, maks ⅔; drivere: længste etiket 45 tegn, 6 serier side om side

**Props.** `companies[] (2–10, første fremhæves), metric (omsaetning | bruttofortjeneste | resultat | egenkapital | ansatte | ebitda | balancesum | gaeld | soliditetsgrad | overskudsgrad | likviditetsgrad), order? (desc | asc; asc når spørgsmålet er lavest/mindst), top? (3–10, standard 5), title?`

<a id="LassoCompanyTable"></a>
## Virksomhedstabel, søgning (`LassoCompanyTable`)

**Formål.** Tabel over virksomheder fundet med kriterier, med detaljer ved klik.

**Bedst til**
- målgrupper
- revisorer i Region Midt med mindst 10 ansatte
- find virksomheder der ...

**Undgå når**
- 2–3 navngivne virksomheder (LassoCompareTable)
- én virksomhed (show_company)

**Veje ind.** search_companies, render_view

**Kræver data (Dataset).** `searches`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std 1/1, min 1/1, maks 1/1; drivere: længste etiket 45 tegn, 8 serier side om side

**Props.** `source='search', search { query, criteria[], sort?, limit? }, columns? (navn | cvr | by | region | branche | status | ansatte | omsaetning | bruttofortjeneste | resultat | udvikling | score), title?`

<a id="LassoPersonTable"></a>
## Persontabel, navnesøgning (`LassoPersonTable`)

**Formål.** Tabel over personer fundet ved navnesøgning.

**Bedst til**
- find personer med navnet X
- hvem er personen X

**Undgå når**
- én kendt person (show_person)
- virksomheder (LassoCompanyTable)

**Veje ind.** search_persons, render_view

**Kræver data (Dataset).** `personSearches`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std 1/1, min 1/1, maks 1/1; drivere: 6 serier side om side

**Props.** `query (navn), limit? (1–50, standard 25), title?`

<a id="LassoCreditRating"></a>
## Kreditvurdering, Creditsafe (`LassoCreditRating`)

**Formål.** Kreditvurdering fra Creditsafe: kreditmaksimum, international og lokal score, PDF-rapport.

**Bedst til**
- kredit
- kreditvurdering
- kan vi give dem kredit
- Creditsafe

**Undgå når**
- Lassos 0–100-score (LassoScoreGauge); skalaerne må ikke blandes

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `creditRatings`

**Live-tilgængelighed.** kræver abonnement — Kræver Creditsafe-abonnement

**Bredde.** profil smal; std ⅓, min ¼, maks ⅓; drivere: ingen

**Props.** `company, title?`

<a id="LassoRiskObservations"></a>
## Risikoobservationer (`LassoRiskObservations`)

**Formål.** Lassos risikoobservationer som liste sorteret efter alvor, med filtre.

**Bedst til**
- risikoobservationer
- røde flag i detaljer
- alle observationer

**Undgå når**
- bredt risikospørgsmål (show_company focus risiko)
- Creditsafe (LassoCreditRating)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `observations`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ⅓, maks ½; drivere: 2 rækker pr. post

**Props.** `company, title?, compact?`

<a id="LassoScoreGauge"></a>
## Risikoscore (`LassoScoreGauge`)

**Formål.** Lassos risikoscore 0–100 som måler, regnet ud fra Creditsafe-ratingen.

**Bedst til**
- score
- risikoscore

**Undgå når**
- bredt risikospørgsmål (show_company focus risiko)
- Creditsafes egne tal og rapport (LassoCreditRating)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `scores`

**Live-tilgængelighed.** kræver abonnement — Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.

**Bredde.** profil smal; std ¼, min ¼, maks ½; drivere: ingen

**Props.** `company, title?, detail?`

<a id="LassoProductionUnits"></a>
## Produktionsenheder, P-numre (`LassoProductionUnits`)

**Formål.** Produktionsenheder (P-numre) med adresse og branche.

**Bedst til**
- enheder
- hvor har X afdelinger
- produktionsenheder

**Undgå når**
- kun hovedadressen (LassoContact)
- placering på kort (LassoMap)

**Veje ind.** ask (spørgsmål), render_view

**Kræver data (Dataset).** `productionUnits`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std 1/1, min ¾, maks 1/1; drivere: længste etiket 54 tegn, 5 serier side om side

**Props.** `company`

<a id="LassoProperties"></a>
## Ejendomme, BBR (`LassoProperties`)

**Formål.** Ejendomme (BBR) knyttet til virksomheden.

**Bedst til**
- ejendomme
- hvilke ejendomme ejer X

**Undgå når**
- produktionsenheder (LassoProductionUnits)
- adresse (LassoContact)

**Veje ind.** ask (spørgsmål), render_view

**Kræver data (Dataset).** `properties`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ½, maks 1/1; drivere: 2 rækker pr. post

**Props.** `company, title?`

<a id="LassoMap"></a>
## Kort, adresser og P-enheder (`LassoMap`)

**Formål.** Kort med virksomhedens adresse og enheder.

**Bedst til**
- hvor ligger X
- placering af enheder

**Undgå når**
- kun adressen som tekst (LassoContact)
- liste over enheder (LassoProductionUnits)

**Veje ind.** ask (spørgsmål), focus, render_view

**Kræver data (Dataset).** `maps`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ⅓, maks 1/1; drivere: ingen

**Props.** `company, title?`

<a id="LassoLivestock"></a>
## CHR, husdyr (`LassoLivestock`)

**Formål.** Dyrehold (CHR) med besætninger og hændelser.

**Bedst til**
- besaetning
- hvor mange dyr har X

**Undgå når**
- ejendomme (LassoProperties)

**Veje ind.** ask (spørgsmål), render_view

**Kræver data (Dataset).** `livestock`

**Live-tilgængelighed.** kræver Lasso-modul — Kræver Ejendomme-modulet i Lasso-abonnementet

**Bredde.** profil smal; std ½, min ⅓, maks ½; drivere: 3 serier side om side

**Props.** `company`

<a id="LassoPersonHead"></a>
## Personhoved (`LassoPersonHead`)

**Formål.** Personens navn og handlinger øverst på en personvisning.

**Bedst til**
- identitet
- overskrift på enhver personvisning

**Undgå når**
- en virksomhed (LassoCompanyHead)

**Veje ind.** show_person, render_view

**Kræver data (Dataset).** `persons`

**Live-tilgængelighed.** altid

**Bredde.** profil fleksibel; std 1/1, min 1/1, maks 1/1; drivere: længste etiket 45 tegn

**Props.** `person, variant?`

<a id="LassoPersonRoles"></a>
## Roller over tid (`LassoPersonRoles`)

**Formål.** Personens roller i virksomheder over tid.

**Bedst til**
- roller
- hvor sidder X i bestyrelser

**Undgå når**
- hvem X sidder sammen med (LassoPersonNetwork)
- konkurser og tvangsopløsninger (LassoPersonStats, LassoTimeline med filter 'risiko')

**Veje ind.** show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `persons`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ⅔, min ½, maks 1/1; drivere: 2 rækker pr. post, længste etiket 45 tegn, tidsakse

**Bredde pr. variant.**
- `show:current`: profil smal; std ½, min ½, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn
- `show:ended`: profil smal; std ½, min ⅓, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn
- `show:owner`: profil smal; std ½, min ⅓, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn

**Props.** `person, show? ('all' | 'current' | 'ended' | 'owner'), role? ('bestyrelse' | 'direktion' | 'ejer'), except? ('risiko', kun show 'ended': uden selskaber med konkurs eller tvangsopløsning), limit?, more? ('expand' | 'roller'), title?`

<a id="LassoPersonNetwork"></a>
## Personnetværk (`LassoPersonNetwork`)

**Formål.** Personens netværk: de personer X sidder sammen med, og selskaberne.

**Bedst til**
- netvaerk
- hvem sidder X sammen med

**Undgå når**
- personens egne roller (LassoPersonRoles)

**Veje ind.** show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `personNetworks`

**Live-tilgængelighed.** når data findes

**Bredde.** profil bred; std 1/1, min 1/1, maks 1/1; drivere: 3 rækker pr. post, længste etiket 45 tegn, tidsakse

**Props.** `person, limit? (standard 3), more? ('expand' | 'netvaerk'), title?`

<a id="LassoPersonRisk"></a>
## Personrisiko (`LassoPersonRisk`)

**Formål.** Personens tilknytning til konkurser og tvangsopløsninger.

**Bedst til**
- konkurs
- har X været i konkurser

**Undgå når**
- virksomhedens egen risiko (LassoRiskObservations)

**Veje ind.** show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `persons`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ⅓, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn

**Props.** `person, title?`

<a id="LassoPersonStats"></a>
## Netværkstal, person (`LassoPersonStats`)

**Formål.** Tre tal-kort om personen: Netværk (personer i 1. led), Konkurser og Tvangsopløsninger blandt personens selskaber.

**Bedst til**
- hvor stort er X's netværk
- har X været i konkurser
- persontal

**Undgå når**
- hvem i netværket (LassoPersonNetwork)
- hvilke selskaber og forløbet (LassoTimeline med filter 'risiko')

**Veje ind.** show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `persons`, `personNetworks`

**Live-tilgængelighed.** når data findes

**Bredde.** profil fleksibel; std ½, min ⅓, maks ½; drivere: længste etiket 45 tegn

**Props.** `person`

<a id="LassoPersonFacts"></a>
## Stamoplysninger, person (`LassoPersonFacts`)

**Formål.** Personens stamoplysninger som nøgle/værdi (bopæl, kommune, roller, ejerskaber). Udgået.

**Bedst til**
- bopael
- hvor bor X
- hvem er X

**Undgå når**
- roller over tid (LassoPersonRoles)

**Veje ind.** show_person, ask (spørgsmål), render_view

**Kræver data (Dataset).** `persons`

**Live-tilgængelighed.** når data findes

**Bredde.** profil smal; std ⅓, min ⅓, maks ⅓; drivere: længste etiket 45 tegn

**Props.** `person, title?`

<a id="LassoChangeFeed"></a>
## Ændringsfeed, overvågede virksomheder (`LassoChangeFeed`)

**Formål.** Ændringer i overvågede virksomheder de seneste dage.

**Bedst til**
- hvad er ændret i mine kunder
- ændringer i overvågningslisten

**Undgå når**
- hele historikken over år for én virksomhed (LassoTimeline)
- overblik pr. måned (LassoHeatmap)

**Veje ind.** focus, ask (spørgsmål), render_view

**Kræver data (Dataset).** `changeFeeds`

**Live-tilgængelighed.** når data findes — Der overvåges ingen virksomheder endnu.

**Bredde.** profil smal; std ½, min ½, maks ½; drivere: 2 rækker pr. post, længste etiket 45 tegn

**Props.** `list? ELLER company?, days? (1–90, standard 7 for en liste og 30 for én virksomhed), types? (delmængde af regnskab | ledelse | ejerskab | status | stamdata), title?`

<a id="LassoHeatmap"></a>
## Heatmap, aktivitet pr. måned (`LassoHeatmap`)

**Formål.** Ændringer pr. måned og type i en overvågningsliste som heatmap.

**Bedst til**
- hvornår sker der mest
- aktivitet over tid i overvågningen

**Undgå når**
- enkelte ændringer (LassoChangeFeed)

**Veje ind.** render_view

**Kræver data (Dataset).** `activityHeatmaps`

**Live-tilgængelighed.** når data findes — Der overvåges ingen virksomheder endnu.

**Bredde.** profil fleksibel; std ½, min ⅓, maks ¾; drivere: tidsakse, 12 serier side om side

**Props.** `list?, months? (3–24, standard 12), types? (delmængde af regnskab | ledelse | ejerskab | status | stamdata), title?`

<a id="LassoSavedPages"></a>
## Gemte sider (`LassoSavedPages`)

**Formål.** Brugerens gemte virksomheds- og personsider.

**Bedst til**
- mine gemte
- hvad har jeg gemt

**Undgå når**
- en enkelt virksomhed (show_company)

**Veje ind.** gemte sider, render_view

**Kræver data (Dataset).** `savedPages`

**Live-tilgængelighed.** når data findes — Der er ingen gemte sider endnu.

**Bredde.** profil fleksibel; std 1/1, min 1/1, maks 1/1; drivere: længste etiket 45 tegn, 5 serier side om side

**Props.** `kind? (company | person | all), limit? (1–100, standard 20), title?`

<a id="LassoFollowUps"></a>
## Opfølgningsknapper (`LassoFollowUps`)

**Formål.** Opfølgende spørgsmål som klikbare forslag under et svar.

**Bedst til**
- næste skridt efter et svar

**Undgå når**
- selve svaret skal vises (brug elementet med dataene)

**Veje ind.** focus, ask (spørgsmål), show_person, compare_companies, render_view

**Kræver data (Dataset).** ingen

**Live-tilgængelighed.** altid

**Bredde.** profil fleksibel; std 1/1, min 1/1, maks 1/1; drivere: ingen

**Props.** `prompts[] (1–6) { label, prompt }`

## Oversigt

| Type | Profil | std/min/max | Live | Veje |
|---|---|---|---|---|
| `LassoCompanyHead` | fleksibel | 1/1 / 1/1 / 1/1 | altid | focus, ask, render_view |
| `LassoKeyValueList` | smal (variant:financials: smal) | ½ / ½ / ½ | altid | focus, ask, render_view |
| `LassoContact` | smal | ⅓ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoContactPersons` | smal | ⅓ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoShortcuts` | smal | ½ / ¼ / ½ | altid | focus, render_view |
| `LassoTextSections` | fleksibel | ½ / ½ / ⅔ | når data findes | focus, ask, render_view |
| `LassoSummary` | fleksibel | ½ / ¼ / ⅔ | altid | focus, person, ask, render_view |
| `LassoTimeline` | smal | ⅓ / ¼ / ⅔ | når data findes | focus, person, ask, render_view |
| `LassoNews` | smal | ½ / ½ / ½ | når data findes | focus, person, ask, render_view |
| `LassoKeyFigureCards` | fleksibel | 1/1 / ⅓ / 1/1 | når data findes | focus, ask, render_view |
| `LassoBarChart` | fleksibel | ½ / ⅓ / 1/1 | når data findes | focus, ask, render_view |
| `LassoGroupedBarChart` | fleksibel | ½ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoLineChart` | fleksibel | ½ / ½ / 1/1 | når data findes | ask, render_view |
| `LassoStackedBarChart` | fleksibel | ½ / ¼ / ¾ | når data findes | ask, render_view |
| `LassoShareBars` | smal | ½ / ½ / ½ | når data findes | focus, ask, render_view |
| `LassoWaterfallChart` | fleksibel | ½ / ⅓ / 1/1 | når data findes | focus, ask, render_view |
| `LassoKeyFigureGauge` | smal | ⅓ / ⅓ / ½ | ikke koblet på endnu | focus, ask, render_view |
| `LassoMultiYearTable` | bred | ⅔ / ⅔ / 1/1 | når data findes | focus, ask, render_view |
| `LassoIncomeStatement` | smal | ½ / ½ / ½ | når data findes | focus, ask, render_view |
| `LassoBalanceSheet` | smal | ⅓ / ⅓ / ½ | når data findes | focus, ask, render_view |
| `LassoCashFlow` | smal | ½ / ½ / ½ | når data findes | focus, ask, render_view |
| `LassoFinancialStatements` | bred | ¾ / ⅔ / ¾ | når data findes | focus, ask, render_view |
| `LassoMergers` | smal | ½ / ½ / ½ | når data findes | ask, focus, render_view |
| `LassoRegistration` | smal | ½ / ½ / ½ | når data findes | ask, focus, render_view |
| `LassoAnnouncements` | smal | ½ / ½ / ½ | når data findes | ask, focus, render_view |
| `LassoRelationsTable` | bred | ⅔ / ⅔ / ⅔ | når data findes | focus, render_view |
| `LassoCompanyHistory` | bred | 1/1 / ⅔ / 1/1 | når data findes | focus, render_view |
| `LassoPublications` | fleksibel | ½ / ½ / ½ | når data findes | ask, focus, render_view |
| `LassoPersonList` | smal | ⅓ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoOwnerList` | smal | ⅓ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoBeneficialOwners` | smal | ⅓ / ¼ / ½ | når data findes | focus, ask, render_view |
| `LassoOwnershipDiagram` | bred | ⅔ / ⅔ / 1/1 | når data findes | focus, person, ask, render_view |
| `LassoRelations` | smal | ¼ / ¼ / ⅓ | når data findes | focus, ask, render_view |
| `LassoCompareTable` | bred | 1/1 / ⅔ / 1/1 | når data findes | compare_companies, render_view |
| `LassoRanking` | fleksibel | ½ / ¼ / ⅔ | når data findes | compare_companies, render_view |
| `LassoCompanyTable` | bred | 1/1 / 1/1 / 1/1 | når data findes | search_companies, render_view |
| `LassoPersonTable` | bred | 1/1 / 1/1 / 1/1 | når data findes | search_persons, render_view |
| `LassoCreditRating` | smal | ⅓ / ¼ / ⅓ | kræver abonnement | focus, ask, render_view |
| `LassoRiskObservations` | smal | ⅓ / ⅓ / ½ | når data findes | ask, focus, render_view |
| `LassoScoreGauge` | smal | ¼ / ¼ / ½ | kræver abonnement | focus, ask, render_view |
| `LassoProductionUnits` | bred | 1/1 / ¾ / 1/1 | når data findes | ask, render_view |
| `LassoProperties` | fleksibel | ½ / ½ / 1/1 | når data findes | ask, render_view |
| `LassoMap` | fleksibel | ½ / ⅓ / 1/1 | når data findes | ask, focus, render_view |
| `LassoLivestock` | smal | ½ / ⅓ / ½ | kræver Lasso-modul | ask, render_view |
| `LassoPersonHead` | fleksibel | 1/1 / 1/1 / 1/1 | altid | person, render_view |
| `LassoPersonRoles` | fleksibel (show:current: smal, show:ended: smal, show:owner: smal) | ⅔ / ½ / 1/1 | når data findes | person, ask, render_view |
| `LassoPersonNetwork` | bred | 1/1 / 1/1 / 1/1 | når data findes | person, ask, render_view |
| `LassoPersonRisk` | smal | ⅓ / ⅓ / ½ | når data findes | person, ask, render_view |
| `LassoPersonStats` | fleksibel | ½ / ⅓ / ½ | når data findes | person, ask, render_view |
| `LassoPersonFacts` | smal | ⅓ / ⅓ / ⅓ | når data findes | person, ask, render_view |
| `LassoChangeFeed` | smal | ½ / ½ / ½ | når data findes | focus, ask, render_view |
| `LassoHeatmap` | fleksibel | ½ / ⅓ / ¾ | når data findes | render_view |
| `LassoSavedPages` | fleksibel | 1/1 / 1/1 / 1/1 | når data findes | saved, render_view |
| `LassoFollowUps` | fleksibel | 1/1 / 1/1 / 1/1 | altid | focus, ask, person, compare_companies, render_view |
