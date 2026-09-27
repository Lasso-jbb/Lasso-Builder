import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { entityLink, isEntityId, sendToLassoLink, verifyEntityLink, verifySendToLassoLink } from "./links.js";

const config = loadConfig({ MCP_ACCESS_KEY: "k", LINK_SECRET: "hemmelig", PUBLIC_BASE_URL: "https://lasso.test" });
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);

test("isEntityId accepterer virksomheder og personer, ikke P-enheder", () => {
  assert.equal(isEntityId("CVR-1-34580820"), true);
  assert.equal(isEntityId("CVR-3-4000455341"), true);
  assert.equal(isEntityId("CVR-2-1000000000"), false);
  assert.equal(isEntityId("CVR-1-1234"), false);
});

test("entityLink signeres, verificeres, bærer focus og udløber", () => {
  const now = Date.UTC(2026, 8, 27);
  const url = entityLink(config, "CVR-1-34580820", { focus: "oekonomi" }, now);
  assert.match(url, /^https:\/\/lasso\.test\/e\/CVR-1-34580820\?e=[0-9a-z]+&f=oekonomi&s=[A-Za-z0-9_-]{22}$/);
  const ok = verifyEntityLink(config, "CVR-1-34580820", query(url), now);
  assert.deepEqual(ok, { ok: true, lassoId: "CVR-1-34580820", focus: "oekonomi" });
  // Ændret focus eller ID bryder signaturen.
  assert.deepEqual(verifyEntityLink(config, "CVR-1-34580820", { ...query(url), f: "risiko" }, now), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyEntityLink(config, "CVR-1-34580821", query(url), now), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyEntityLink(config, "CVR-1-34580820", query(url), now + 31 * 86_400_000), { ok: false, reason: "expired" });
  // Overblik bærer intet f.
  const plain = entityLink(config, "CVR-3-4000455341", {}, now);
  assert.equal(query(plain).f, undefined);
  assert.deepEqual(verifyEntityLink(config, "CVR-3-4000455341", query(plain), now), { ok: true, lassoId: "CVR-3-4000455341" });
});

test("ENTITY_PAGES_PUBLIC tillader usignerede links, men tjekker stadig et signeret", () => {
  const closed = config;
  assert.deepEqual(verifyEntityLink(closed, "CVR-1-34580820", {}), { ok: false, reason: "invalid" });
  const open = loadConfig({ MCP_ACCESS_KEY: "k", LINK_SECRET: "hemmelig", ENTITY_PAGES_PUBLIC: "true" });
  assert.deepEqual(verifyEntityLink(open, "CVR-1-34580820", {}), { ok: true, lassoId: "CVR-1-34580820" });
  assert.deepEqual(verifyEntityLink(open, "CVR-1-34580820", { f: "oekonomi" }), { ok: true, lassoId: "CVR-1-34580820", focus: "oekonomi" });
  assert.deepEqual(verifyEntityLink(open, "CVR-1-34580820", { e: "abc", s: "forkert" }), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyEntityLink(open, "CVR-2-1000000000", {}), { ok: false, reason: "invalid" });
});

test("send-til-Lasso-links bærer bruger og org, er signerede og udløber", () => {
  const now = Date.UTC(2026, 8, 27);
  const url = sendToLassoLink(config, { lassoId: "CVR-1-34580820", userId: "jbb", org: "lasso", focus: "risiko" }, now);
  assert.match(url, /^https:\/\/lasso\.test\/send-to-lasso\?id=CVR-1-34580820&u=jbb&o=lasso&e=[0-9a-z]+&f=risiko&s=/);
  const ok = verifySendToLassoLink(config, query(url), now);
  assert.deepEqual(ok, { ok: true, link: { lassoId: "CVR-1-34580820", userId: "jbb", org: "lasso", focus: "risiko" } });
  // Skiftes brugeren i linket, er signaturen ugyldig: man kan ikke gemme på andres liste.
  assert.deepEqual(verifySendToLassoLink(config, { ...query(url), u: "anna" }, now), { ok: false, reason: "invalid" });
  assert.deepEqual(verifySendToLassoLink(config, query(url), now + 31 * 86_400_000), { ok: false, reason: "expired" });
  assert.deepEqual(verifySendToLassoLink(config, { id: "CVR-1-34580820", u: "jbb;x", o: "lasso", e: "1" }, now), { ok: false, reason: "invalid" });
});

test("uden nogen nøgle (lokalt) er links usignerede men stadig tidsbegrænsede", () => {
  const local = loadConfig({});
  const url = entityLink(local, "CVR-1-34580820");
  assert.equal(query(url).s, undefined);
  assert.equal(verifyEntityLink(local, "CVR-1-34580820", query(url)).ok, true);
});
