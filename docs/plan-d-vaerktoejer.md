# D1 + D3 — Nye MCP-værktøjer: `search_persons` og `compare_companies`

Fables beslutning (plan D1/D3, docs/plan-mcp.md, Ø7). Begge værktøjer er *read-only*, returnerer en Lasso-visning som de øvrige (`viewResult` med tekstkort, link og PDF-link), og deres beskrivelser holdes korte (token-loft Ø8: ≤ 300 tokens pr. værktøj).

## D1 — `search_persons`

**Formål:** Finde personer i CVR på navn (og evt. rolle/by), som `search_companies` finder virksomheder. Resultatet er `LassoPersonTable` (katalog 26f: navn, by, aktive roller, seneste selskab), så brugeren kan vælge en person og gå videre med `show_person`.

**Input (zod):**
- `query: string (2–120)` — navnet eller en del af det, fx "Mette Holm".
- `limit?: 1–50` (standard 25).
- `role?: "direktoer" | "bestyrelse" | "ejer" | "alle"` (standard alle) — filtrerer på personens aktive roller.
- `city?: string (≤ 60)` — by/postnummer-filter på bopæl.
- `title?: string (≤ 80)`.

**Adfærd:** `DataProvider.personSearch(query, limit)` (findes: `searchPersonsTable` i provider.ts) → filtrér på `role`/`city` i use case-laget → spec `{ kind:"list", title, layout:"stack", components:[{ type:"LassoPersonTable", query, limit, title }] }`. Ét træf med præcist navnematch: svaret nævner i `summary`, at `show_person` kan kaldes direkte med personens Lasso-ID. Nul træf: tom tilstand i tabellen + `note` "Ingen personer fundet på '…'. Prøv et kortere navn." Aldrig en fejl for 0 træf.

**Beskrivelse (til modellen, dansk):** "Søg personer i CVR på navn (og evt. rolle eller by) og vis dem som en Lasso-tabel med aktive roller. Brug til 'find Mette Holm', 'hvem hedder … og sidder i bestyrelser', når navnet er tvetydigt, eller når brugeren vil se flere personer. Kald derefter show_person med personens Lasso-ID (CVR-3-…). Brug ikke til én kendt person (show_person) eller til virksomheder (search_companies)."

**Tekstkort:** det eksisterende PersonTable-kort beholdes uændret (Jakob 15.3: ingen by/fødselsår; Ø4). Afgjort af Fable efter D2.

**Tests:** use case med demo-provider: query med flere træf, med `role`-filter, 0 træf (note, ingen fejl), 1 præcist træf (summary nævner show_person). Tool-registrering i server.ts: schema afviser query < 2 tegn. Token-loft grønt.

## D3 — `compare_companies`

**Formål:** Sammenligne 2–10 navngivne virksomheder på nøgletal — det, `render_view` i dag kræver, at modellen selv komponerer. Værktøjet vælger komponent efter spørgsmål og antal:

| Input | Komponenter (i rækkefølge) |
|---|---|
| 2–6 virksomheder, flere nøgletal (standard) | `LassoCompareTable` (metrics ≤ 5) + `LassoLineChart` for de to første på det første nøgletal (`benchmark`) + `LassoFollowUps` ("Vis X", "Vis Y", "Sammenlign på soliditet") |
| 2–10 virksomheder, `metric` angivet (ét nøgletal) eller spørgsmål med "hvem er størst/bedst/højest/lavest" | `LassoRanking` (companies, metric; første fremhæves) + `LassoCompareTable` med ≤ 3 nøgletal |
| > 6 virksomheder uden `metric` | `LassoRanking` på `omsaetning` (fallback `bruttofortjeneste`) + note "Sammenligningstabellen viser højst 6; de 6 største er valgt." |

**Input (zod):**
- `companies: string[] (2–10)` — navne, CVR-numre eller Lasso-ID'er (navne slås op som i show_company: bedste match, alternativer i `note`).
- `metrics?: Metric[] (1–5)`; `metric?: Metric` (rangering); `years?: 2–10` (standard 5, linjegraf).
- `question?: string (≤ 300)` — bruges kun til at vælge rangering vs. tabel og til nøgletal via `parseAsk`'s metric-genkendelse (ingen ny ordbog).
- `title?`.

**Adfærd:** ny `composeCompare(refs, options)` i `packages/spec/src/composeCompare.ts` (ren funktion, testbar uden server), use case `compareCompanies` i views.ts (navneopslag → Lasso-ID'er → `normalizeSpec` → `resolveSpec`), tool i server.ts. Kolonnenavne i CompareTable ombrydes/afkortes (B8 leverer).

**Beskrivelse (til modellen):** "Sammenlign 2–10 navngivne virksomheder på nøgletal: tabel (2–6, flere nøgletal), rangering (ét nøgletal, 'hvem er størst') og udvikling over tid for de to første. Send virksomhederne som navne eller CVR-numre og brugerens spørgsmål i question. Brug ikke til én virksomhed (show_company) eller til at finde virksomheder efter kriterier (search_companies)."

**Tekstkort:** tabelform som CompareTable (én linje pr. virksomhed: nøgletal seneste år) + ved rangering "1. Navn: værdi …".

**COMPOSITION_RULES (D5):** "Flere virksomheder → compare_companies" erstatter den nuværende render_view-anvisning for sammenligning; `render_view` beholdes til alt andet.

**Tests:** composeCompare: 2 vs 6 vs 8 virksomheder, med/uden metric, "hvem er størst"-spørgsmål → Ranking først; use case: navneopslag med tvetydigt navn giver note; ugyldigt antal afvises af schema; eval: to nye tilfælde i questions.json med `kind:"compare"` er *ikke* i skemaet — i stedet en unit-test i apps/server (E1 dækker MCP-kaldet).

## Ikke i D
- `ScoreCompare` er en portal-komponent (props, ikke spec-type) → Ø9.
- `LassoHeatmap` for flere virksomheder → overvågning (Ø9).
