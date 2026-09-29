# Bredde-udtræk

Tabel over nuværende bredderegler og målte højder pr. komponenttype og bredde.

Kilder:
- Regler: packages/spec/src/catalog.ts linjer 74-134 (GRID_RULES)
- Højder: packages/spec/src/grid.ts linjer 51-100 (MEASURED_HEIGHTS)

## Tabel

| Type | std | min | max | højdeklasse | adfærd | flex | h@¼ | h@⅓ | h@½ | h@⅔ | h@¾ | h@1/1 |
|------|-----|-----|-----|-------------|--------|------|-----|-----|-----|-----|-----|-------|
| LassoAnnouncements | full | half | full | low | growing | rows | 44 | 44 | 64 | 64 | 64 | 64 |
| LassoAuditorIndependence | full | half | full | high | growing | — | 1153 | 1031 | 797 | 530 | 476 | 420 |
| LassoBalanceSheet | half | half | three-quarters | very-high | growing | — | 750 | 739 | 741 | 741 | 741 | 741 |
| LassoBarChart | half | third | full | medium | fixed | plot | 336 | 336 | 300 | 300 | 300 | 300 |
| LassoBeneficialOwners | third | quarter | half | low | growing | rows | 178 | 160 | 161 | 161 | 161 | 161 |
| LassoCashFlow | half | half | three-quarters | high | growing | — | 562 | 562 | 564 | 564 | 564 | 564 |
| LassoChangeFeed | full | half | full | very-high | growing | rows | 1181 | 1057 | 979 | 943 | 943 | 943 |
| LassoCompanyHead | full | full | full | low | fixed | — | 34 | 34 | 34 | 34 | 34 | 34 |
| LassoCompanyTable | full | full | full | high | growing | rows | 1317 | 1229 | 545 | 545 | 545 | 604 |
| LassoCompareTable | full | two-thirds | full | high | growing | — | 489 | 489 | 427 | 407 | 407 | 327 |
| LassoContact | third | quarter | half | medium | fixed | — | 261 | 261 | 206 | 206 | 206 | 206 |
| LassoContactPersons | third | quarter | half | medium | growing | rows | 234 | 234 | 236 | 236 | 236 | 236 |
| LassoCreditRating | half | third | full | high | fixed | — | 468 | 430 | 493 | 475 | 475 | 475 |
| LassoFinancialStatements | full | full | full | very-high | growing | — | 574 | 574 | 434 | 434 | 434 | 1239 |
| LassoFollowUps | full | full | full | low | fixed | — | 64 | 64 | 64 | 64 | 64 | 64 |
| LassoGroupedBarChart | half | third | full | medium | fixed | plot | 327 | 327 | 300 | 300 | 300 | 300 |
| LassoHeatmap | half | third | full | medium | fixed | — | 226 | 226 | 270 | 270 | 270 | 270 |
| LassoIncomeStatement | half | half | three-quarters | high | growing | — | 442 | 442 | 444 | 444 | 444 | 444 |
| LassoKeyFigureCards | full | half | full | low | fixed | — | 481 | 230 | 166 | 148 | 133 | 138 |
| LassoKeyFigureGauge | third | quarter | half | medium | fixed | — | 183 | 183 | 185 | 185 | 185 | 185 |
| LassoKeyValueList | half | half | full | very-high | growing | rows | 964 | 924 | 662 | 662 | 644 | 626 |
| LassoKeyValueList (financials) | half | half | full | high | fixed | rows | 814 | 814 | 535 | 535 | 535 | 535 |
| LassoLineChart | half | third | full | medium | fixed | plot | 354 | 354 | 300 | 300 | 300 | 300 |
| LassoLivestock | half | half | full | high | growing | — | 605 | 554 | 477 | 337 | 286 | 286 |
| LassoMap | half | third | full | high | fixed | plot | 220 | 220 | 400 | 400 | 400 | 400 |
| LassoMergers | half | half | full | high | growing | — | 356 | 314 | 473 | 341 | 341 | 341 |
| LassoMultiYearTable | half | half | full | medium | growing | — | 338 | 338 | 296 | 296 | 296 | 296 |
| LassoNews | half | third | full | medium | growing | rows | 266 | 226 | 310 | 292 | 292 | 292 |
| LassoOwnerList | third | quarter | half | low | growing | rows | 168 | 168 | 161 | 161 | 161 | 161 |
| LassoOwnershipDiagram | two-thirds | half | full | high | growing | plot | 357 | 357 | 541 | 541 | 541 | 770 |
| LassoPersonFacts | third | quarter | half | high | growing | rows | 433 | 433 | 337 | 337 | 337 | 337 |
| LassoPersonHead | full | full | full | low | fixed | — | 34 | 34 | 34 | 34 | 34 | 34 |
| LassoPersonList | third | quarter | half | medium | growing | rows | 255 | 255 | 229 | 229 | 229 | 229 |
| LassoPersonNetwork | two-thirds | half | full | medium | growing | plot | 468 | 351 | 317 | 317 | 317 | 317 |
| LassoPersonRisk | half | third | full | high | growing | rows | 622 | 474 | 404 | 386 | 368 | 368 |
| LassoPersonRoles | two-thirds | half | full | medium | growing | plot | 362 | 362 | 295 | 295 | 295 | 295 |
| LassoPersonStats | full | half | full | low | fixed | — | 90 | 90 | 90 | 90 | 90 | 90 |
| LassoPersonTable | full | full | full | high | growing | rows | 1317 | 1229 | 545 | 545 | 545 | 604 |
| LassoProductionUnits | full | two-thirds | full | high | growing | — | 395 | 355 | 604 | 604 | 567 | 370 |
| LassoProperties | half | third | full | low | growing | — | 139 | 122 | 124 | 107 | 107 | 107 |
| LassoPublications | half | half | full | high | growing | rows | 612 | 594 | 443 | 405 | 405 | 405 |
| LassoRanking | half | third | full | medium | growing | rows | 269 | 269 | 220 | 220 | 220 | 220 |
| LassoRegistration | full | two-thirds | full | high | growing | — | 1153 | 1031 | 797 | 530 | 476 | 420 |
| LassoRelations | quarter | quarter | half | medium | growing | — | 267 | 267 | 269 | 269 | 269 | 269 |
| LassoRiskObservations | half | third | full | high | growing | rows | 468 | 430 | 493 | 475 | 475 | 475 |
| LassoSavedPages | full | full | full | high | growing | — | 1317 | 1229 | 545 | 545 | 545 | 604 |
| LassoScoreGauge | quarter | quarter | half | medium | fixed | — | 292 | 292 | 224 | 224 | 224 | 224 |
| LassoScoreHistory | half | third | full | medium | fixed | plot | 354 | 354 | 300 | 300 | 300 | 300 |
| LassoShareBars | half | quarter | half | medium | fixed | — | 154 | 154 | 200 | 200 | 200 | 200 |
| LassoShortcuts | half | quarter | full | low | fixed | — | 66 | 66 | 88 | 88 | 88 | 40 |
| LassoStackedBarChart | half | third | full | medium | fixed | plot | 232 | 212 | 300 | 300 | 300 | 300 |
| LassoSummary | full | half | full | high | growing | lines | 879 | 735 | 590 | 569 | 506 | 485 |
| LassoTextSections | half | half | full | high | growing | lines | 879 | 735 | 590 | 569 | 506 | 485 |
| LassoTimeline | half | third | full | high | growing | rows | 476 | 440 | 514 | 514 | 514 | 514 |
| LassoWaterfallChart | half | third | full | medium | fixed | plot | 322 | 322 | 300 | 300 | 300 | 300 |

## Analyse

**Total komponenter: 55 rækker**

### Må stå smalt (min ≤ ⅓)

26 komponenter:

- LassoBarChart
- LassoBeneficialOwners
- LassoContact
- LassoContactPersons
- LassoCreditRating
- LassoGroupedBarChart
- LassoHeatmap
- LassoKeyFigureGauge
- LassoLineChart
- LassoMap
- LassoNews
- LassoOwnerList
- LassoPersonFacts
- LassoPersonList
- LassoPersonRisk
- LassoProperties
- LassoRanking
- LassoRelations
- LassoRiskObservations
- LassoScoreGauge
- LassoScoreHistory
- LassoShareBars
- LassoShortcuts
- LassoStackedBarChart
- LassoTimeline
- LassoWaterfallChart

### Må strækkes til fuld (max = 1/1) selv om std ≤ ½

23 komponenter:

- LassoBarChart
- LassoCreditRating
- LassoGroupedBarChart
- LassoHeatmap
- LassoKeyValueList
- LassoKeyValueList (financials)
- LassoLineChart
- LassoLivestock
- LassoMap
- LassoMergers
- LassoMultiYearTable
- LassoNews
- LassoPersonRisk
- LassoProperties
- LassoPublications
- LassoRanking
- LassoRiskObservations
- LassoScoreHistory
- LassoShortcuts
- LassoStackedBarChart
- LassoTextSections
- LassoTimeline
- LassoWaterfallChart

### Højden mere end fordobles fra full til quarter (h@¼ / h@1/1 ≥ 2)

7 komponenter:

- LassoKeyFigureCards: 481px / 138px = 3.49x
- LassoAuditorIndependence: 1153px / 420px = 2.75x
- LassoRegistration: 1153px / 420px = 2.75x
- LassoCompanyTable: 1317px / 604px = 2.18x
- LassoPersonTable: 1317px / 604px = 2.18x
- LassoSavedPages: 1317px / 604px = 2.18x
- LassoLivestock: 605px / 286px = 2.12x
