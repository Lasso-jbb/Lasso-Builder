import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COMPONENT_CATALOG, type PersonVM } from "@lasso/spec";
import { ScoreGauge } from "./components/ScoreGauge.js";
import { ScoreHistory } from "./components/ScoreHistory.js";
import { Livestock } from "./components/Livestock.js";
import { KeyFigureGauge } from "./components/KeyFigureGauge.js";
import { PersonFacts } from "./components/PersonFacts.js";
import { LIVESTOCK_MODULE_REASON, NO_BENCHMARK_REASON, SCORE_SUBSCRIPTION_REASON } from "./unavailableReasons.js";

const ID = "CVR-1-99000001";
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("C6: årsagsteksterne er identiske med register.liveNote i kataloget", () => {
  const note = (t: string) => COMPONENT_CATALOG.find((c) => c.type === t)?.register?.liveNote;
  assert.equal(note("LassoScoreGauge"), SCORE_SUBSCRIPTION_REASON);
  assert.equal(note("LassoScoreHistory"), SCORE_SUBSCRIPTION_REASON);
  assert.equal(note("LassoLivestock"), LIVESTOCK_MODULE_REASON);
  assert.equal(note("LassoKeyFigureGauge"), NO_BENCHMARK_REASON);
});

test("ScoreGauge: abonnements-årsag giver låst tilstand uden knap", () => {
  const h = html(createElement(ScoreGauge, { score: { lassoId: ID, score: null, state: "unavailable", reason: SCORE_SUBSCRIPTION_REASON }, onFetch: () => {} }));
  assert.match(h, /lasso-state-locked/);
  assert.ok(h.includes(SCORE_SUBSCRIPTION_REASON));
  assert.doesNotMatch(h, /<button/);
  assert.doesNotMatch(h, /lasso-state--unavailable|Score ikke tilgængelig/);
});

test("ScoreGauge: anden unavailable-årsag er stadig ikke tilgængelig", () => {
  const h = html(createElement(ScoreGauge, { score: { lassoId: ID, score: null, state: "unavailable", reason: "Holdingselskab uden drift." } }));
  assert.match(h, /lasso-state--unavailable/);
  assert.doesNotMatch(h, /lasso-state-locked/);
});

test("ScoreHistory: abonnements-årsag giver låst tilstand uden knap", () => {
  const h = html(createElement(ScoreHistory, { history: { lassoId: ID, points: [], reason: SCORE_SUBSCRIPTION_REASON }, onFetch: () => {} }));
  assert.match(h, /lasso-state-locked/);
  assert.ok(h.includes(SCORE_SUBSCRIPTION_REASON));
  assert.doesNotMatch(h, /<button/);
  const other = html(createElement(ScoreHistory, { history: { lassoId: ID, points: [], reason: "Historikken opbygges." } }));
  assert.doesNotMatch(other, /lasso-state-locked/);
});

test("Livestock: modulårsag giver låst tilstand", () => {
  const h = html(createElement(Livestock, { livestock: { lassoId: ID, herds: [], events: [], unavailableReason: LIVESTOCK_MODULE_REASON } }));
  assert.match(h, /lasso-state-locked/);
  assert.ok(h.includes(LIVESTOCK_MODULE_REASON));
  const other = html(createElement(Livestock, { livestock: { lassoId: ID, herds: [], events: [], unavailableReason: "Svaret er ikke verificeret." } }));
  assert.doesNotMatch(other, /lasso-state-locked/);
});

test("KeyFigureGauge: branchetal-årsag vises som ikke tilgængelig med årsagen", () => {
  const fin = { lassoId: ID, years: [] } as never;
  for (const reason of [NO_BENCHMARK_REASON, "Virksomheden har ingen registreret branchekode."]) {
    const h = html(createElement(KeyFigureGauge, { financials: fin, industry: { lassoId: ID, state: "unavailable", reason, years: [] } }));
    assert.match(h, /lasso-state--unavailable/);
    assert.ok(h.includes(reason));
    assert.doesNotMatch(h, /lasso-state-locked|<button/);
  }
});

test("PersonFacts: rækkerne ligger i en toskolonners liste (kolonner ved ≥ ½ via container query)", () => {
  const person: PersonVM = { lassoId: "CVR-3-4000000001", name: "Mette Nielsen", zip: "8600", city: "Silkeborg", municipality: "Viborg", roles: [] } as unknown as PersonVM;
  const h = html(createElement(PersonFacts, { person }));
  assert.match(h, /lasso-kv-list lasso-kv-list--twocol/);
  assert.match(h, /lasso-personfacts/);
});

test("PersonFacts: styles.css har to kolonner i personfacts-containeren fra 480 px", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /@container personfacts \(min-width: 480px\)[^}]*\{[^}]*lasso-kv-list--twocol[^}]*column-count: 2/);
});
