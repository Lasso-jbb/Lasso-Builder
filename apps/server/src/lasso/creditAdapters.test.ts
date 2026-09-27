import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { CREDIT_LOCKED_REASON, CREDIT_PENDING_REASON, parseViewSpec } from "@lasso/spec";
import { loadConfig } from "../config.js";
import { LiveProvider } from "../data/live.js";
import { resolveSpec } from "../data/resolve.js";
import { LassoApiError, LassoClient } from "./client.js";
import { adaptCreditRating, CREDIT_NONE_REASON, creditRatingFromError, loadCreditRating } from "./creditAdapters.js";

const ID = "CVR-1-34580820";
const NOW = new Date("2026-09-27T10:00:00Z");

/** Samme form som docs.lassox.com viser for GET /data/creditsafe/rating/{cvr}. */
const FIXTURE = {
  current: { creditMax: 250000, creditCurrency: "DKK", internationalScore: "B", internationalDescription: "Low", localScore: 62, localDescription: "Low Risk" },
  previous: { creditMax: 180000, creditCurrency: "DKK", internationalScore: "C", internationalDescription: "Moderate", localScore: 45, localDescription: "Moderate Risk" },
  latestChange: "2026-04-15T00:00:00",
  pdfUrl: "https://api.lassox.com/data/creditsafe/report/34580820.pdf",
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("adaptCreditRating oversætter dokumentationens form til CreditRatingVM", () => {
  const vm = adaptCreditRating(ID, FIXTURE, NOW);
  assert.equal(vm.state, "ok");
  assert.equal(vm.cvr, "34580820");
  assert.equal(vm.source, "Creditsafe via Lasso");
  assert.deepEqual(vm.current, FIXTURE.current);
  assert.equal(vm.previous?.internationalScore, "C");
  assert.equal(vm.latestChange, "2026-04-15");
  assert.equal(vm.pdfUrl, FIXTURE.pdfUrl);
  assert.equal(vm.updated, "2026-09-27", "uden tidsstempel i svaret er opdateret = opslagets dato");
  assert.equal(vm.cachedUntil, undefined, "Lasso sender ikke cachens udløb; vi gætter ikke");
});

test("adaptCreditRating er defensiv: store/små bogstaver, tal som tekst, ukendte bogstaver og usikre links", () => {
  const vm = adaptCreditRating(
    ID,
    { Current: { CreditMax: "1 250 000", internationalScore: "a", localScore: "88", localDescription: "Very Low Risk" }, previous: { internationalScore: "X" }, pdfUrl: "javascript:alert(1)" },
    NOW,
  );
  assert.equal(vm.state, "ok");
  assert.equal(vm.current?.creditMax, 1_250_000);
  assert.equal(vm.current?.internationalScore, "A");
  assert.equal(vm.current?.localScore, 88);
  assert.equal(vm.previous, undefined, "en vurdering uden gyldigt bogstav, tal og kreditmaksimum er tom");
  assert.equal(vm.pdfUrl, undefined, "kun http(s)-links");
  // Kreditmaksimum null betyder "Creditsafe anbefaler ingen kredit", ikke et manglende felt.
  assert.equal(adaptCreditRating(ID, { current: { internationalScore: "E", creditMax: null } }).current?.creditMax, null);
});

test("tomt svar eller ingen vurdering giver 'ikke beregnet', ikke en fejl", () => {
  for (const raw of [null, "", {}, { current: null, previous: null }, { current: {}, latestChange: "2026-01-01" }]) {
    const vm = adaptCreditRating(ID, raw, NOW);
    assert.equal(vm.state, "unavailable", JSON.stringify(raw));
    assert.equal(vm.reason, CREDIT_NONE_REASON);
  }
});

test("fejl bliver tilstande: 401/403 låst, 404 ikke beregnet, timeout beregner stadig, resten fejl", () => {
  assert.deepEqual(
    [401, 403].map((s) => creditRatingFromError(ID, new LassoApiError(s, null, "u"))).map((v) => [v.state, v.reason]),
    [["locked", CREDIT_LOCKED_REASON], ["locked", CREDIT_LOCKED_REASON]],
  );
  assert.equal(CREDIT_LOCKED_REASON, "Kræver Creditsafe-tilføjelse til Lasso-abonnementet");
  const notFound = creditRatingFromError(ID, new LassoApiError(404, { errorMessage: "Not found" }, "u"));
  assert.deepEqual([notFound.state, notFound.reason], ["unavailable", CREDIT_NONE_REASON]);
  const timeout = creditRatingFromError(ID, new DOMException("The operation was aborted due to timeout", "TimeoutError"));
  assert.deepEqual([timeout.state, timeout.reason], ["unavailable", "Creditsafe beregner stadig, prøv igen om lidt"]);
  assert.equal(timeout.reason, CREDIT_PENDING_REASON);
  const server = creditRatingFromError(ID, new LassoApiError(500, { errorMessage: "Creditsafe svarede ikke" }, "u"));
  assert.deepEqual([server.state, server.reason], ["error", "Lasso API-fejl (500): Creditsafe svarede ikke"]);
  assert.equal(creditRatingFromError(ID, new LassoApiError(429, null, "u")).state, "error");
  assert.equal(creditRatingFromError(ID, new TypeError("fetch failed")).reason, "Kunne ikke nå Lasso API");
  for (const vm of [notFound, timeout, server]) assert.equal(vm.lassoId, ID);
});

test("loadCreditRating slår op på CVR-nummeret, ikke Lasso-ID'et, og kaster aldrig", async () => {
  const seen: string[] = [];
  const ok = await loadCreditRating(ID, async (cvr) => (seen.push(cvr), FIXTURE), NOW);
  assert.deepEqual(seen, ["34580820"]);
  assert.equal(ok.state, "ok");
  const failed = await loadCreditRating(ID, async () => {
    throw new Error("uventet");
  });
  assert.deepEqual([failed.state, failed.reason], ["error", "uventet"]);
  const noCvr = await loadCreditRating("PU-2-abc", async () => FIXTURE);
  assert.equal(noCvr.state, "unavailable");
});

/** Falsk klient: kun det, LiveProvider.creditRating bruger. Logger argumenterne, så skipCache kan tjekkes. */
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

test("LiveProvider.creditRating: kalder uden skipCache og mapper 403 til låst og timeout til 'beregner stadig'", async () => {
  const ok = fakeClient(async () => FIXTURE);
  const vm = await new LiveProvider(ok.client, loadConfig({})).creditRating(ID);
  assert.equal(vm.state, "ok");
  assert.equal(vm.current?.internationalScore, "B");
  assert.deepEqual(ok.calls, [["34580820"]], "kun CVR; skipCache sendes aldrig (standard false)");

  const locked = fakeClient(async () => {
    throw new LassoApiError(403, { errorMessage: "Missing addon" }, "u");
  });
  assert.equal((await new LiveProvider(locked.client, loadConfig({})).creditRating(ID)).state, "locked");

  const slow = fakeClient(async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  const pending = await new LiveProvider(slow.client, loadConfig({})).creditRating(ID);
  assert.deepEqual([pending.state, pending.reason], ["unavailable", CREDIT_PENDING_REASON]);
});

test("resolveSpec henter LassoCreditRating til ds.creditRatings; en låst konto er data, ikke en fejlnøgle", async () => {
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCreditRating", company: ID }] });
  const locked = fakeClient(async () => {
    throw new LassoApiError(401, null, "u");
  });
  const ds = await resolveSpec(spec, new LiveProvider(locked.client, loadConfig({})));
  assert.equal(ds.creditRatings[ID]?.state, "locked");
  assert.equal(ds.errors[`creditRating:${ID}`], undefined);
});

test("klienten: GET /data/creditsafe/rating/{cvr}?skipCache=false, og svaret genbruges fra cachen", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    urls.push(String(input));
    return new Response(JSON.stringify(FIXTURE), { status: 200 });
  }) as typeof fetch;
  const client = new LassoClient(loadConfig({ LASSO_API_TOKEN: "k", LASSO_CACHE_TTL_SECONDS: "300" }));
  await client.creditsafeRating("34580820");
  await client.creditsafeRating("34580820");
  assert.deepEqual(urls, ["https://api.lassox.com/data/creditsafe/rating/34580820?skipCache=false"]);
});
