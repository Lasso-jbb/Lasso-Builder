import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewSpec } from "@lasso/spec";
import { canonicalJson, MemoryViewStore, randomShortId, SHORT_ID_PATTERN, shortExpired, specHash } from "./store.js";

const spec = { version: 2, kind: "custom", title: "T", components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001" }] } as unknown as ViewSpec;

test("korte id'er: 10 url-sikre tegn, tilfældige", () => {
  const ids = new Set(Array.from({ length: 200 }, randomShortId));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, SHORT_ID_PATTERN);
  assert.equal([...ids][0]!.length, 10);
});

test("saveShort: samme visning fra samme bruger giver samme id; anden bruger eller organisation et nyt; getShort finder den", async () => {
  const s = new MemoryViewStore();
  const a = await s.saveShort({ org: "o", owner: "u", spec, title: "T" }, 30);
  assert.equal((await s.saveShort({ org: "o", owner: "u", spec, title: "T" }, 30)).id, a.id);
  assert.notEqual((await s.saveShort({ org: "o", owner: "v", spec, title: "T" }, 30)).id, a.id);
  assert.notEqual((await s.saveShort({ org: "p", owner: "u", spec, title: "T" }, 30)).id, a.id);
  assert.equal((await s.getShort(a.id))?.org, "o");
  assert.equal(await s.getShort("findesikke"), null);
  assert.equal("hash" in a, false, "hashen er intern");
});

test("udløb: ældre end ttlDays er udløbet; en udløben visning giver et nyt id", async () => {
  const day = 86_400_000;
  const s = new MemoryViewStore();
  const old = await s.saveShort({ org: "o", owner: "u", spec, title: "T", createdAt: new Date(Date.now() - 31 * day).toISOString() }, 365);
  assert.equal(shortExpired(old, 30), true);
  assert.equal(shortExpired(old, 60), false);
  const fresh = await s.saveShort({ org: "o", owner: "u", spec, title: "T" }, 30);
  assert.notEqual(fresh.id, old.id);
  assert.equal(await s.getShort(old.id), null, "udløbne ryddes ved næste gem");
});

test("canonicalJson og specHash er uafhængige af nøgleorden", () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 1, c: undefined, e: 2 }] }), canonicalJson({ a: [{ e: 2, d: 1 }], b: 1 }));
  assert.equal(specHash({ x: 1, y: 2 }), specHash({ y: 2, x: 1 }));
  assert.notEqual(specHash({ x: 1 }), specHash({ x: 2 }));
});
