import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadConfig } from "../config.js";
import { LassoClient } from "./client.js";

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
