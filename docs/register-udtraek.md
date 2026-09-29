# Register af komponenttyper

Udtrukket 2026-09-29. Følgende tabel viser for hver af de 54 komponenitertyper i spec.ts: hvilke Dataset-nøgler serveren henter i resolve.ts, og hvilke ruter (composere/usecases) der udsender den.

| Type | Dataset-nøgler (fra resolve.ts) | compose.ts (fokus) | composePerson.ts | ask.ts | usecases | Katalog | Grid (std/min/max/height) |
|---|---|---|---|---|---|---|---|
| LassoAnnouncements | company, companyEvents | — | — | — | — | ja | full/half/full/low |
| LassoAuditorIndependence | auditorIndependence, company | risiko | — | ja | — | nej | full/half/full/high |
| LassoBalanceSheet | — | regnskab | — | ja | — | ja | half/half/three-quarters/very-high |
| LassoBarChart | — | oekonomi | — | ja | — | ja | half/third/full/medium |
| LassoBeneficialOwners | beneficialOwnership | ejerskab | — | ja | — | ja | third/quarter/half/low |
| LassoCashFlow | — | regnskab | — | ja | — | ja | half/half/three-quarters/high |
| LassoChangeFeed | — | — | — | — | — | ja | full/half/full/very-high |
| LassoCompanyHead | company, observations | — | — | — | — | ja | full/full/full/low |
| LassoCompanyTable | — | — | — | — | views.ts | ja | full/full/full/high |
| LassoCompareTable | company | — | — | — | — | ja | full/two-thirds/full/high |
| LassoContact | contact | overblik, kontakt | — | ja | — | ja | third/quarter/half/medium |
| LassoContactPersons | contactPersons | kontakt | — | ja | — | ja | third/quarter/half/medium |
| LassoCreditRating | creditRating | risiko | — | ja | — | ja | half/third/full/high |
| LassoFinancialStatements | financialStatements | — | — | — | — | ja | full/full/full/very-high |
| LassoFollowUps | — | — | ja | — | — | ja | full/full/full/low |
| LassoGroupedBarChart | financials | oekonomi | — | ja | — | ja | half/third/full/medium |
| LassoHeatmap | — | — | — | — | — | ja | half/third/full/medium |
| LassoIncomeStatement | — | regnskab | — | ja | — | ja | half/half/three-quarters/high |
| LassoKeyFigureCards | — | overblik, oekonomi | — | ja | — | ja | full/half/full/low |
| LassoKeyFigureGauge | financials | — | — | — | — | ja | third/quarter/half/medium |
| LassoKeyValueList | company, financials | overblik, regnskab, risiko | — | ja | — | ja | half/half/full/very-high |
| LassoLineChart | company, financials, industryBenchmark | — | — | ja | views.ts | ja | half/third/full/medium |
| LassoLivestock | livestock | — | — | ja | — | ja | half/half/full/high |
| LassoMap | mapPoints | — | — | — | — | ja | half/third/full/high |
| LassoMergers | company, companyEvents | — | — | — | — | ja | half/half/full/high |
| LassoMultiYearTable | financials | oekonomi | — | ja | — | ja | half/half/full/medium |
| LassoNews | — | overblik, historik | ja | ja | — | ja | half/third/full/medium |
| LassoOwnerList | ownership | overblik, regnskab, ejerskab, ledelse, risiko | — | ja | — | ja | third/quarter/half/low |
| LassoOwnershipDiagram | — | ejerskab | ja | ja | — | ja | two-thirds/half/full/high |
| LassoPersonFacts | person | — | ja | ja | — | ja | third/quarter/half/high |
| LassoPersonHead | — | — | ja | — | — | ja | full/full/full/low |
| LassoPersonList | people | overblik, regnskab, kontakt, ejerskab, ledelse, risiko | — | ja | — | ja | third/quarter/half/medium |
| LassoPersonNetwork | personNetwork | — | ja | ja | — | ja | two-thirds/half/full/medium |
| LassoPersonRisk | — | — | ja | ja | — | ja | half/third/full/high |
| LassoPersonRoles | — | — | ja | ja | — | ja | two-thirds/half/full/medium |
| LassoPersonStats | person, personNetwork | — | — | — | — | ja | full/half/full/low |
| LassoPersonTable | — | — | — | — | — | ja | full/full/full/high |
| LassoProductionUnits | productionUnits | — | — | ja | — | ja | full/two-thirds/full/high |
| LassoProperties | properties | — | — | ja | — | ja | half/third/full/low |
| LassoPublications | companyEvents | — | — | — | — | ja | half/half/full/high |
| LassoRanking | company | — | — | — | — | ja | half/third/full/medium |
| LassoRegistration | company | — | — | — | — | ja | full/two-thirds/full/high |
| LassoRelations | people | overblik | — | ja | — | ja | quarter/quarter/half/medium |
| LassoRiskObservations | observations | — | — | — | — | ja | half/third/full/high |
| LassoSavedPages | — | — | — | — | pages.ts | ja | full/full/full/high |
| LassoScoreGauge | score | — | — | ja | — | ja | quarter/quarter/half/medium |
| LassoScoreHistory | scoreHistory | — | — | — | — | nej | half/third/full/medium |
| LassoShareBars | — | oekonomi | — | ja | — | ja | half/quarter/half/medium |
| LassoShortcuts | company | overblik, ejerskab | — | — | — | ja | half/quarter/full/low |
| LassoStackedBarChart | — | — | — | ja | — | ja | half/third/full/medium |
| LassoSummary | — | — | — | — | — | ja | full/half/full/high |
| LassoTextSections | textSections | overblik, oekonomi | — | ja | — | ja | half/half/full/high |
| LassoTimeline | timeline | overblik, ledelse, risiko, historik | ja | ja | — | ja | half/third/full/high |
| LassoWaterfallChart | financials | oekonomi | — | ja | — | ja | half/third/full/medium |

## Typer uden katalogpost (2 stk.)

- LassoAuditorIndependence
- LassoScoreHistory

## Noter

### Om compose.ts (fokus)
Kolonnen angiver, i hvilken `case "fokus"` fra `composeCompany`-funktionen i compose.ts typen optræder som komponenter. "—" betyder, at typen ikke hentes i composeProbe eller composeCompany; den kan stadig optræde i composeAskCompany (spørges der specielt om dem).

### Om Dataset-nøgler
Listet viser, hvilke calls til `want()` i `switch(c.type)` i resolve.ts der hentes for typen. "—" betyder, at typen ikke har egne datakrav (data afledes, eller der er ingen opslag).

### Om katalogpost
"ja" = der findes en entry i COMPONENT_CATALOG i catalog.ts.
"nej" = typen har grid-regel i GRID_RULES men ingen katalogentry.

### Om grid (std/min/max/height)
Fra GRID_RULES i catalog.ts: standardbredde, minimumsbredde, maksimumsbredde, og højtklasse (low/medium/high/very-high).
