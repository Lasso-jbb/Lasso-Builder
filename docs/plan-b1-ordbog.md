# B1 — Spørgsmålsordbog for de manglende komponenter

Fables beslutning (plan B1, docs/plan-mcp.md). Gælder for `packages/spec/src/ask.ts`. Mønstre skrives mod den *foldede* tekst (`foldText`: små bogstaver, æ→ae, ø→oe, å→aa), som de eksisterende `TOPIC_RULES`.

## 1. Princip
- Et spørgsmål får det **mest specifikke** emne først: nye regler står **før** de brede (`kredit`, `regnskab`, `historik`, `adresse`, `branche`, `formaal`), og de brede regler mister de ord, som nu er specifikke.
- Hver ny komponent får et **svar-element** (lead) og en **kontekst** i rangorden, som de eksisterende `companyFragment`/`personFragment`.
- **`topic`-hintet** (B3) er den kaldende AI's aflæsning af emnet. Det behandles som "emne nævnt allerførst i spørgsmålet": hintet lægges forrest i `ask.topics`, `generic` bliver `false`, og mønstrene kører derefter som normalt (`AskHints.topic?: AskTopic`). Ukendte værdier ignoreres. Alias-tabellen i afsnit 4 oversætter AI-ord til kanoniske emner.
- Komponenter, der er *fler-entitets* (CompareTable, Ranking, CompanyTable, PersonTable) eller *portal/strukturelle* (Heatmap, SavedPages, Shortcuts, FollowUps, hoveder), får **ingen** ordbogspost — de nås via værktøjer (fase D) og fokus-sider. Heatmap: kun `render_view` indtil overvågning (Ø9).

## 2. Nye emner (ASK_TOPICS) og regler (TOPIC_RULES), i forrang-rækkefølge

| Emne (nyt) | kind | Mønster (foldet tekst) | Skal stå FØR | Ændring i eksisterende regel |
|---|---|---|---|---|
| `roede-flag` | company | `roede\s?flag\w*\|advarsel\w*\|advarsler\|observation\w*\|noget galt\|bekymr\w*\|\badvar\w*` | `kredit` | `kredit` mister `roede flag` |
| `fusion` | company | `fusion\w*\|fusioner\w*\|spaltning\w*\|spaltet\|delt op\|sammenlagt\|sammenlaegning\w*\|opkoeb\w*\|overtaget af\|overtagelse\w*` | `historik` | — |
| `meddelelser` | company | `offentliggoer\w*\|offentliggjort\|statstidende\|meddelelse\w*\|bekendtgoer\w*\|bekendtgjort` | `dokumenter`, `historik`, `nyheder` | — |
| `dokumenter` | company | `dokument\w*\|\bfiler\b\|erhvervsstyrelsen\|publikation\w*\|\bbilag\w*\|indsendt\w*` | `regnskab`, `historik` | — |
| `branchesammenligning` | company | `i forhold til branchen\|branchegennemsnit\w*\|gennemsnit\w*\s+(?:i\s+)?(?:sin\|deres\|hele\s+)?\s*branche\w*\|sammenlignet med branchen\|bedre end (?:gennemsnittet\|branchen\|andre)\|daarligere end (?:gennemsnittet\|branchen)\|benchmark\w*\|klarer .{0,20} sig i forhold til` | `branche` | `branche` mister intet (den fanger kun `branche\w*` løst; forrang afgør) |
| `placering` | company | `paa et kort\|kort over\|\bkortet\b\|(?:hvor (?:ligger\|har)\|beliggenhed\w*) .{0,40}(?:afdeling\w*\|adresser\|enheder\|filial\w*\|butik\w*)\|geografi\w*` | `adresse`, `enheder` | `adresse` uændret; `enheder` uændret (placering vinder ved "afdelinger + hvor ligger", `enheder` alene giver stadig ProductionUnits) |
| `heleregnskab` | company | `hele regnskabet\|komplette regnskab\w*\|fulde regnskab\w*\|alle poster\w*\|alle regnskabslinjer\|alle linjer\w*\|skifte (?:aar\|regnskabsaar)\|(?:vaelge\|vaelg) (?:aar\|regnskabsaar)` | `regnskab`, `resultatopgoerelse`, `balance` | — |
| `registrering` | company | `selskabskapital\w*\|indskudskapital\w*\|\bkapital\b(?!andel)\|vedtaegt\w*\|tegningsregel\w*\|tegningsret\w*\|registreret med\|registrering\w*\|\bregnskabsklasse\w*` | `formaal`, `stamdata`-emner | `formaal` mister `tegningsregel\w*\|tegningsret\w*\|\btegne[rs]?\b`; `formaal` beholder `formaal\w*` |
| `opsummering` | company | `opsummer\w*\|opsummering\w*\|kort fortalt\|tl;?dr\|\bresume\w*\|i korte traek\|hurtigt overblik\|sammendrag\w*\|kort version` | alle brede | — |
| `aendringer` | company | `aendringsfeed\w*\|seneste aendringer\|nye aendringer\|(?:aendret\|aendring\w*\|sket) .{0,30}(?:sidste\|seneste) \d+ (?:dage\|uger\|maaneder)\|sidste \d+ dage` | `historik` | `historik` beholder `aendring\w*\|\baendret\b` (uden periode = historik) |
| `score` (findes) | company | uændret `\bscore\w*` + tilføj `kreditscore\w*` | — | — |
| `persontal` | person | `hvor mange (?:roller\|selskaber\|poster\|ejerskaber\|bestyrelser\|virksomheder)\|antal (?:roller\|selskaber\|poster)\|\bi alt\b\|hvor mange .{0,20}ophoert` | `roller` | — |

## 3. Svar-element og kontekst (nye ask-typer)

`COMPANY_ASK_TYPES` udvides med: `observationer`, `fusioner`, `meddelelser`, `dokumenter`, `branchesammenligning`, `placering`, `heleregnskab`, `registrering`, `opsummering`, `aendringer`. `PERSON_ASK_TYPES` med: `persontal`. `COMPANY_TYPE_OF`/`PERSON_TYPE_OF` mapper 1:1 (emne → type; `score` bliver ved sin type).

| Ask-type | cards | lead (i rækkefølge) | context (rangorden) | Bemærkning |
|---|---|---|---|---|
| `observationer` | `RISK_CARD_METRICS` | `LassoRiskObservations` | `LassoCreditRating`, `timeline({kinds:["status"],limit:5})`, `LassoAuditorIndependence`, `LassoShareBars`, `ANALYSIS()`, `RELATIONS()` | Har spørgsmålet også `kredit` (fx "kan vi handle med dem, er der røde flag"), står `LassoCreditRating` som lead nr. 2. |
| `fusioner` | — | `LassoMergers` | `timeline({kinds:["status"],limit:5})`, `item("LassoOwnerList")`, `RELATIONS()`, `PROFILE()` | Tom tilstand: "Ingen fusioner eller spaltninger registreret". |
| `meddelelser` | — | `LassoAnnouncements` | `LassoPublications`, `timeline({limit:5})`, `item("LassoNews",{limit:3})` | |
| `dokumenter` | — | `LassoPublications` | `LassoAnnouncements`, `timeline({kinds:["regnskab"],limit:5})`, `financialsList()` | |
| `branchesammenligning` | `standard` | `item("LassoKeyFigureGauge", { metrics })` — `metrics` = spørgsmålets nøgletal (op til 3), ellers `["soliditetsgrad","overskudsgrad","likviditetsgrad"]` | `MAIN_GRAPH()`, `financialsList()`, `ANALYSIS()`, `RELATIONS()` | Live: `ikke-endnu` uden branchetal → tom tilstand med årsag. |
| `placering` | — | `LassoMap` | `LassoProductionUnits`, `item("LassoContact")`, `rowsList(["kommune","region"], "Virksomhedsoplysninger")` | Har spørgsmålet også `enheder`, står `LassoProductionUnits` som lead nr. 2. |
| `heleregnskab` | `standard` | `LassoFinancialStatements` | `ANALYSIS()`, `MAIN_GRAPH()` | Har spørgsmålet et regnskabsår (`ask.year`), gives det videre som prop. Vinder over `regnskab`-typen (den udelades, når `heleregnskab` findes). |
| `registrering` | — | `LassoRegistration` | `PROFILE()`, `rowsList(["stiftet","form","regnskabsperiode"], "Virksomhedsoplysninger")`, `item("LassoOwnerList")` | `variant` efter ord: "vedtægter/formål" → `'profile'`, ellers `'full'`. |
| `opsummering` | `standard` | `LassoSummary` | `PROFILE()`, `RELATIONS()`, `MAIN_GRAPH()`, `item("LassoContact")` | |
| `aendringer` | — | `item("LassoChangeFeed", { company, days })` — `days` fra spørgsmålet (`\d+ (dage\|uger\|maaneder)` → dage, loft 90), ellers 30 | `timeline({limit:5})`, `item("LassoNews",{limit:3})` | Kræver at `LassoChangeFeed` kan stå for én virksomhed (B4: `company`-prop og `changeFeed({companies:[id], days})` i resolve). |
| `score` (findes) | `standard` | Hvis `ask.trend \|\| ask.past` eller ordene `udvikl\w*\|op eller ned\|steget\|faldet\|over tid`: `LassoScoreHistory` først, så `LassoScoreGauge`; ellers som i dag | uændret | Live: Ø6 — låst uden Creditsafe-abonnement (C1). |
| `persontal` (person) | — | `LassoPersonStats` | `item("LassoPersonRoles",{show:"current",limit:5})`, `item("LassoPersonRisk")`, `timeline({limit:5})` | |

## 4. `topic`-hintets ordforråd (B3: enum i show_company/show_person)

Kanoniske værdier = alle `ASK_TOPICS` (gamle + nye). Aliaser, som oversættes før brug:

| AI skriver | Kanonisk |
|---|---|
| `risiko`, `roede_flag`, `red_flags`, `advarsler` | `roede-flag` |
| `fusioner`, `spaltning`, `mergers` | `fusion` |
| `offentliggoerelser`, `statstidende`, `announcements` | `meddelelser` |
| `publikationer`, `filer`, `documents` | `dokumenter` |
| `branche_sammenligning`, `benchmark`, `branchetal` | `branchesammenligning` |
| `kort`, `map`, `adresser`, `afdelinger` | `placering` |
| `hele_regnskabet`, `fuldt_regnskab`, `statements` | `heleregnskab` |
| `kapital`, `vedtaegter`, `registration` | `registrering` |
| `resume`, `summary`, `tldr` | `opsummering` |
| `changes`, `aendringsfeed`, `seneste_aendringer` | `aendringer` |
| `kreditscore`, `rating_history` | `score` |
| `antal_roller`, `stats` | `persontal` |
| `kredit`, `kreditvurdering`, `creditsafe` | `kredit` |

Eval-sættets `hints.topic` normaliseres til kanoniske værdier (B3): `risiko→roede-flag`, `fusioner→fusion`, `offentliggoerelser→meddelelser`, `regnskab (c-heleregnskab-01)→heleregnskab`.

## 5. Acceptkriterier for B2
- Alle 24 "manglende"-tilfælde i eval får det forventede lead på **plan-niveau** (askPlan.lead[0]); de 16 med `dataInDemo=true` også på **side-niveau** efter B4.
- Ingen regression: de 36 "eksisterende" holder ≥ 88,9 % på side, og ingen af de tidligere træf bliver miss.
- Nye regler har hver mindst 3 unit-tests i `ask.test.ts` (træf, ikke-træf, forrang mod den brede regel).
