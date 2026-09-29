import assert from "node:assert/strict";
import { test } from "node:test";
import { CREDIT_LOCKED_REASON, parseViewSpec } from "@lasso/spec";
import { loadConfig } from "../config.js";
import { LiveProvider } from "../data/live.js";
import { resolveSpec } from "../data/resolve.js";
import { MemoryScoreStore } from "../scores/store.js";
import { LassoApiError, type LassoClient } from "./client.js";
import { adaptCreditRating, creditRatingFromError, CREDIT_NONE_REASON } from "./creditAdapters.js";
import { historyFromCredit, pointsFromCredit, SCORE_HISTORY_BUILDING_REASON, SCORE_LOCKED_REASON, SCORE_NONE_REASON, scoreFromCredit, toLassoScore } from "./scoreAdapters.js";

const ID = "CVR-1-34580820";
const NOW = new Date("2026-09-27T10:00:00Z");
const CHECKED = "2026-09-27";

/** Samme fixture som creditAdapters.test.ts (docs.lassox.com). */
const FIXTURE = {
  current: { creditMax: 250000, creditCurrency: "DKK", internationalScore: "B", internationalDescription: "Low", localScore: 62, localDescription: "Low Risk" },
  previous: { creditMax: 180000, creditCurrency: "DKK", internationalScore: "C", internationalDescription: "Moderate", localScore: 45, localDescription: "Moderate Risk" },
  latestChange: "2026-04-15T00:00:00",
  pdfUrl: "https://api.lassox.com/data/creditsafe/report/34580820.pdf",
};

test("C1 ok med lokal score: score = 100 - localScore, kilde, dato og grundlag", () => {
  const s = scoreFromCredit(ID, adaptCreditRating(ID, FIXTURE, NOW), CHECKED);
  assert.equal(s.state, "ok");
  assert.equal(s.score, 38);
  assert.equal(s.source, "Creditsafe via Lasso");
  assert.equal(s.updated, "2026-09-27");
  assert.equal(s.basis, "Creditsafe-rating B, lokal score 62/100, kreditmaksimum 250 t. kr.");
  assert.equal(s.facts, undefined, "bogstavet vises kun som fakta-linje, når der ingen lokal score er");
  assert.equal(toLassoScore(100), 0);
  assert.equal(toLassoScore(1), 99);
});

test("C1 ok uden lokal score men med A-E: A=10, B=30, C=50, D=70, E=90 og label", () => {
  const got = ["A", "B", "C", "D", "E"].map((l) => {
    const s = scoreFromCredit(ID, adaptCreditRating(ID, { current: { internationalScore: l, creditMax: 1000, creditCurrency: "DKK" } }, NOW), CHECKED);
    return [s.state, s.score, s.facts?.[0]?.value];
  });
  assert.deepEqual(got, [["ok", 10, "Creditsafe A"], ["ok", 30, "Creditsafe B"], ["ok", 50, "Creditsafe C"], ["ok", 70, "Creditsafe D"], ["ok", 90, "Creditsafe E"]]);
});

test("C1 ok uden nogen score: unavailable med 'ingen score'", () => {
  const s = scoreFromCredit(ID, adaptCreditRating(ID, { current: { creditMax: 1000, creditCurrency: "DKK" } }, NOW), CHECKED);
  assert.deepEqual([s.state, s.score, s.reason], ["unavailable", null, SCORE_NONE_REASON]);
  assert.equal(SCORE_NONE_REASON, "Creditsafe har ingen score for virksomheden.");
});

test("C1 locked: abonnementsteksten, og historikken er tom med samme tekst", () => {
  const locked = creditRatingFromError(ID, new LassoApiError(403, null, "u"));
  const s = scoreFromCredit(ID, locked, CHECKED);
  assert.deepEqual([s.state, s.score, s.reason], ["unavailable", null, SCORE_LOCKED_REASON]);
  assert.equal(SCORE_LOCKED_REASON, "Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.");
  assert.notEqual(SCORE_LOCKED_REASON, CREDIT_LOCKED_REASON);
  const h = historyFromCredit(ID, locked, []);
  assert.deepEqual([h.points, h.reason], [[], SCORE_LOCKED_REASON]);
  assert.deepEqual(pointsFromCredit(ID, locked, CHECKED), [], "intet skrives uden abonnement");
});

test("C1 unavailable: ratingens egen årsag", () => {
  const r = creditRatingFromError(ID, new LassoApiError(404, null, "u"));
  const s = scoreFromCredit(ID, r, CHECKED);
  assert.deepEqual([s.state, s.reason], ["unavailable", CREDIT_NONE_REASON]);
  assert.deepEqual(historyFromCredit(ID, r, []).reason, CREDIT_NONE_REASON);
});

test("C1 error: unavailable med 'kunne ikke hentes (…)', aldrig en undtagelse", () => {
  const r = creditRatingFromError(ID, new LassoApiError(500, { errorMessage: "Creditsafe svarede ikke" }, "u"));
  const s = scoreFromCredit(ID, r, CHECKED);
  assert.deepEqual([s.state, s.score, s.reason], ["unavailable", null, "Kreditvurderingen kunne ikke hentes (Lasso API-fejl (500): Creditsafe svarede ikke)"]);
  assert.match(historyFromCredit(ID, r, []).reason ?? "", /kunne ikke hentes/);
});

test("C2 punkter: nuværende punkt med ratingens dato, forrige kun når dens dato kendes", () => {
  const r = adaptCreditRating(ID, FIXTURE, NOW);
  assert.deepEqual(pointsFromCredit(ID, r, CHECKED), [
    { lassoId: ID, observedAt: "2026-09-27", score: 38, localScore: 62, intlScore: "B", creditMax: 250000, currency: "DKK" },
  ]);
  const dated = { ...r, current: { ...r.current!, date: "2026-09-01" }, previous: { ...r.previous!, date: "2026-03-01" } };
  const pts = pointsFromCredit(ID, dated, CHECKED);
  assert.deepEqual(pts.map((p) => [p.observedAt, p.score]), [["2026-09-01", 38], ["2026-03-01", 55]]);
  assert.equal(scoreFromCredit(ID, dated, CHECKED).updated, "2026-09-01");
});

test("C2 historik: under to punkter giver 'bygges op', to eller flere giver ingen reason", () => {
  const r = adaptCreditRating(ID, FIXTURE, NOW);
  const one = historyFromCredit(ID, r, []);
  assert.deepEqual(one.points, [{ date: "2026-09-27", score: 38, label: "Creditsafe B" }]);
  assert.equal(one.reason, SCORE_HISTORY_BUILDING_REASON);
  const two = historyFromCredit(ID, r, [{ lassoId: ID, observedAt: "2026-06-01T00:00:00.000Z", score: 55, intlScore: "C" }]);
  assert.deepEqual(two.points.map((p) => [p.date, p.score]), [["2026-06-01", 55], ["2026-09-27", 38]]);
  assert.equal(two.reason, undefined);
});

test("MemoryScoreStore: samme rating igen giver ingen ny række; stigende dato; pr. virksomhed", async () => {
  const store = new MemoryScoreStore();
  await store.record([
    { lassoId: ID, observedAt: "2026-09-27", score: 38, localScore: 62, intlScore: "B" },
    { lassoId: ID, observedAt: "2026-03-01", score: 55 },
    { lassoId: "CVR-1-1", observedAt: "2026-03-01", score: 10 },
    { lassoId: ID, observedAt: "ikke en dato", score: 1 },
  ]);
  await store.record([{ lassoId: ID, observedAt: "2026-09-27", score: 38 }]);
  await store.record([{ lassoId: ID, observedAt: "2026-09-27", score: 40 }]);
  const h = await store.history(ID);
  assert.deepEqual(h.map((p) => [p.observedAt.slice(0, 10), p.score]), [["2026-03-01", 55], ["2026-09-27", 38], ["2026-09-27", 40]]);
  assert.deepEqual(await store.history("CVR-1-2"), []);
});

/** Falsk klient med tæller: kun det, LiveProvider bruger til kreditvurderingen. */
function fakeClient(result: () => Promise<unknown>) {
  const calls: unknown[][] = [];
  const client = {
    async creditsafeRating(...args: unknown[]) {
      calls.push(args);
      return result();
    },
  } as unknown as LassoClient;
  return { client, calls };
}

const PAGE = parseViewSpec({
  title: "x",
  components: [
    { type: "LassoCreditRating", company: ID },
    { type: "LassoScoreGauge", company: ID },
    { type: "LassoScoreHistory", company: ID },
  ],
});

test("ét opslag pr. side: kreditvurdering + score + historik giver ét Creditsafe-kald (ok)", async () => {
  const f = fakeClient(async () => FIXTURE);
  const scores = new MemoryScoreStore();
  const ds = await resolveSpec(PAGE, new LiveProvider(f.client, loadConfig({}), scores));
  assert.equal(f.calls.length, 1);
  assert.equal(ds.creditRatings[ID]?.state, "ok");
  assert.equal(ds.scores[ID]?.score, 38);
  assert.equal(ds.scoreHistories[ID]?.points.length, 1);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal((await scores.history(ID)).length, 1, "punktet er skrevet efter svaret");
});

test("ét opslag pr. side og intet gemt, når kontoen er låst", async () => {
  const f = fakeClient(async () => {
    throw new LassoApiError(403, { errorMessage: "Missing addon" }, "u");
  });
  const scores = new MemoryScoreStore();
  const ds = await resolveSpec(PAGE, new LiveProvider(f.client, loadConfig({}), scores));
  assert.equal(f.calls.length, 1, "ingen ekstra Creditsafe-kald for scorens skyld");
  assert.equal(ds.scores[ID]?.state, "unavailable");
  assert.equal(ds.scores[ID]?.reason, SCORE_LOCKED_REASON);
  assert.deepEqual(ds.scoreHistories[ID]?.points, []);
  assert.equal(ds.scoreHistories[ID]?.reason, SCORE_LOCKED_REASON);
  assert.deepEqual(ds.errors, {});
  assert.deepEqual(await scores.history(ID), []);
});

test("score og scoreHistory alene (uden kreditvurdering på siden) laver også kun ét kald", async () => {
  const f = fakeClient(async () => FIXTURE);
  const p = new LiveProvider(f.client, loadConfig({}));
  await Promise.all([p.score(ID), p.scoreHistory(ID)]);
  assert.equal(f.calls.length, 1);
});
