import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadConfig } from "../config.js";
import { isCacheableFailure, LassoApiError, LassoClient, SCRAPE_TIMEOUT_MS } from "./client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureFetch(): { calls: { url: string; headers: Record<string, string>; body?: string }[] } {
  const log = { calls: [] as { url: string; headers: Record<string, string>; body?: string }[] };
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    log.calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined });
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }) as typeof fetch;
  return log;
}

test("søgningen går til dev3 med sin egen nøgle, resten til api.lassox.com", async () => {
  const log = captureFetch();
  const client = new LassoClient(loadConfig({ LASSO_API_TOKEN: "hoved-nøgle", LASSO_SEARCH_API_TOKEN: "søge-nøgle", LASSO_CACHE_TTL_SECONDS: "0" }));
  assert.equal(client.hasSearchCredentials, true);
  await client.searchPrompt("revisorer i Aarhus");
  await client.searchByFilters([{ FieldName: "x" }], "x");
  await client.company("CVR-1-11111111");
  assert.equal(log.calls[0]!.url, "https://dev3.api.lassox.com/apps/search/query/prompt");
  assert.equal(log.calls[0]!.headers["lasso-api-key"], "søge-nøgle");
  assert.deepEqual(JSON.parse(log.calls[0]!.body!), { Prompt: "revisorer i Aarhus" });
  assert.equal(log.calls[1]!.url, "https://dev3.api.lassox.com/apps/search/lassoid");
  assert.deepEqual(JSON.parse(log.calls[1]!.body!), { filters: [{ FieldName: "x" }], OrderBy: "x" });
  assert.equal(log.calls[2]!.url, "https://api.lassox.com/CVR-1-11111111");
  assert.equal(log.calls[2]!.headers["lasso-api-key"], "hoved-nøgle");
});

test("uden søgenøgle bruges hovedklienten", async () => {
  const log = captureFetch();
  const client = new LassoClient(loadConfig({ LASSO_API_TOKEN: "hoved-nøgle", LASSO_SEARCH_API_TOKEN: "CHANGE_ME", LASSO_CACHE_TTL_SECONDS: "0" }));
  assert.equal(client.hasSearchCredentials, false);
  await client.searchPrompt("x");
  assert.equal(log.calls[0]!.url, "https://api.lassox.com/apps/search/query/prompt");
});

test("mislykkede kald (4xx, timeout) huskes kort, så samme fejl ikke rammes igen straks; 5xx prøves igen", async () => {
  let calls = 0;
  let status = 404;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ errorMessage: "nope" }), { status });
  }) as typeof fetch;
  const client = new LassoClient(loadConfig({ LASSO_API_TOKEN: "k", LASSO_CACHE_TTL_SECONDS: "300" }));
  await assert.rejects(client.company("CVR-1-1"));
  await new Promise((r) => setTimeout(r, 0));
  await assert.rejects(client.company("CVR-1-1"));
  assert.equal(calls, 1, "404 huskes (negativ cache)");

  status = 503;
  await assert.rejects(client.company("CVR-1-2"));
  await new Promise((r) => setTimeout(r, 0));
  await assert.rejects(client.company("CVR-1-2"));
  assert.equal(calls, 3, "503 kan være forbigående og prøves igen");
});

test("isCacheableFailure", () => {
  assert.equal(isCacheableFailure(new LassoApiError(400, null, "x")), true);
  assert.equal(isCacheableFailure(new LassoApiError(429, null, "x")), false);
  assert.equal(isCacheableFailure(new LassoApiError(502, null, "x")), false);
  const timeout = new Error("t");
  timeout.name = "TimeoutError";
  assert.equal(isCacheableFailure(timeout), true);
  assert.equal(isCacheableFailure(new TypeError("fetch failed")), false);
});

test("kontaktendpoints (scraping) har kort timeout, resten den globale", async () => {
  assert.equal(SCRAPE_TIMEOUT_MS, 8_000);
  assert.equal(new LassoClient(loadConfig({ LASSO_API_TOKEN: "k", LASSO_API_TIMEOUT_MS: "15000" })).scrapeTimeoutMs, 8_000);
  assert.equal(new LassoClient(loadConfig({ LASSO_API_TOKEN: "k", LASSO_API_TIMEOUT_MS: "3000" })).scrapeTimeoutMs, 3_000);
  // Kaldet afbrydes efter scrape-timeouten, ikke den globale.
  globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal;
    return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
  }) as typeof fetch;
  const client = new LassoClient(loadConfig({ LASSO_API_TOKEN: "k", LASSO_CACHE_TTL_SECONDS: "0", LASSO_API_TIMEOUT_MS: "50" }));
  const started = Date.now();
  // AbortSignal.timeout holder ikke processen i live; det gør denne timer, indtil kaldet er afbrudt.
  const keepAlive = setTimeout(() => {}, 5_000);
  const err = (await client.contacts("CVR-1-1").catch((e: unknown) => e)) as Error;
  clearTimeout(keepAlive);
  assert.equal(err.name, "TimeoutError");
  assert.ok(Date.now() - started < 2_000);
});
