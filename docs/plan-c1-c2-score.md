# C1 + C2 — Score fra Creditsafe (kun med abonnement) og rating-historik

Fables beslutning (plan C1/C2, docs/plan-mcp.md, Ø6). Gælder `apps/server/src/data/live.ts` (`score`, `scoreHistory`), en ny `apps/server/src/scores/store.ts` og `packages/spec/src/models.ts` (kun dokumentation).

## C1 — Abonnementsregel og mapping

**Regel (Ø6):** Score og scorehistorik bygger *udelukkende* på Creditsafe-ratingen, og der laves **aldrig** et Creditsafe-kald for scorens skyld alene. Scoren afledes af det kald, `creditRating(lassoId)` allerede laver (samme 24-timers cache hos Lasso), så en side med både kreditvurdering og score koster ét opslag.

| CreditRatingVM.state | ScoreVM | Tekst (liveNote/reason) |
|---|---|---|
| `ok` med `current.localScore` (1–100) | `state:"ok"`, `score = 100 − localScore` (Lassos skala: 0 = lav risiko, 100 = høj risiko; `scoreBand`: <60 lav, <80 moderat, ellers høj), `source:"Creditsafe via Lasso"`, `updated = current.date ?? checkedAt` | — |
| `ok` uden `localScore` men med `internationalScore` A–E | `state:"ok"`, `score` = A→10, B→30, C→50, D→70, E→90; `label` = "Creditsafe {bogstav}" | — |
| `ok` uden nogen score | `state:"unavailable"` | "Creditsafe har ingen score for virksomheden." |
| `locked` (401/403 — tilkøb mangler) | `state:"unavailable"`, `reason` | **"Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet."** Intet opslag gentages på siden. |
| `unavailable` (404/ingen vurdering/beregner endnu) | `state:"unavailable"`, `reason` = ratingens reason | — |
| `error` | `state:"unavailable"`, `reason` = "Kreditvurderingen kunne ikke hentes (…)" | Aldrig en undtagelse. |

`ScoreVM.basis` (findes til 18.1): "Creditsafe-rating {A–E}, lokal score {n}/100, kreditmaksimum {beløb} {valuta}" når felterne findes.

**Ingen abonnement = ingen historik:** `scoreHistory` returnerer `points: []` med samme "Kræver Creditsafe-abonnement"-tekst, og der skrives intet i lageret.

**Forbehold (skal stå i koden):** Creditsafe-svarets form er taget fra docs.lassox.com og endnu ikke set mod et rigtigt svar (creditAdapters.ts). Skalaen `100 − localScore` verificeres mod ét rigtigt svar på staging, før prod (E1). Er `localScore` allerede risikoskala, vendes fortegnet ét sted (`toLassoScore`).

## C2 — Rating-historik i Postgres (A3)

**Tabel** (samme mønster som `views`/`view_versions` i apps/server/src/views/store.ts: `CREATE TABLE IF NOT EXISTS` ved første brug, `MemoryScoreStore` uden `DATABASE_URL`):

```sql
CREATE TABLE IF NOT EXISTS score_points (
  id           BIGSERIAL PRIMARY KEY,
  lasso_id     TEXT NOT NULL,
  observed_at  TIMESTAMPTZ NOT NULL,          -- ratingens egen dato (current.date) hvis den findes, ellers opslagstidspunktet
  score        SMALLINT NOT NULL,             -- Lassos skala 0–100
  local_score  SMALLINT,                      -- Creditsafe 1–100 som modtaget
  intl_score   CHAR(1),                       -- A–E
  credit_max   NUMERIC,
  currency     CHAR(3),
  source       TEXT NOT NULL DEFAULT 'creditsafe',
  UNIQUE (lasso_id, observed_at, score)       -- samme rating igen = ingen ny række
);
CREATE INDEX IF NOT EXISTS score_points_lasso_idx ON score_points (lasso_id, observed_at);
```

**Skrivning:** kun når `creditRating` gav `state:"ok"` med en score (dvs. kunden har abonnement og der var et reelt opslag). `INSERT … ON CONFLICT DO NOTHING`. Skrivning sker asynkront efter svaret (fire-and-forget med fejl-log), så siden ikke venter på databasen.

**Læsning:** `scoreHistory(lassoId)` = `SELECT observed_at, score, intl_score FROM score_points WHERE lasso_id=$1 ORDER BY observed_at` → `ScorePointVM[]` (`label` = "Creditsafe {intl}" når den findes). Har Creditsafe-svaret `previous`, indsættes det også som punkt (med `previous.date`), så historikken har mindst to punkter fra første opslag. Under 2 punkter: `reason` = "Historikken bygges op, hver gang kreditvurderingen hentes." (kun med abonnement — ellers abonnementsteksten).

**Sletning/retention:** ingen automatisk sletning (én lille række pr. opslag). GDPR: tabellen indeholder kun virksomheders (CVR) score, ingen persondata.

**Demo:** `DemoProvider.score/scoreHistory` uændret (demodata har egen score-form). Eval-tilfældene for score (`dataInDemo:false`) forbliver plan-niveau.

## Acceptkriterier (C3)
1. `live.ts`: `score()` og `scoreHistory()` følger tabellen; `creditRating` kaldes højst én gang pr. side (brug `resolve.ts`' delte hentning eller en pr.-request-memo — vis det i test).
2. `apps/server/src/scores/store.ts`: `PgScoreStore` + `MemoryScoreStore` + `createScoreStore(pool)`; wired i `index.ts` som views/pages.
3. Tests: mapping for alle seks tilstande (ok/lokal, ok/intl, ok/tom, locked, unavailable, error) med fixture fra creditAdapters.test.ts; store-tests mod memory-laget; ingen Creditsafe-kald ved `locked` ud over det ene, `creditRating` selv laver.
4. Register (`catalog.ts`): LassoScoreGauge/LassoScoreHistory `live:"abonnement"`, liveNote = abonnementsteksten (rettes fra `ikke-endnu`); LassoCreditRating uændret. Regenerér docs/komponenter.md.
5. Typecheck/test/build grønne; eval uændret (score-tilfældene er plan-niveau).
