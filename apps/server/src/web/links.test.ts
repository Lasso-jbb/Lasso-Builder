import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { companyLink, verifyCompanyLink } from "./links.js";

const config = loadConfig({ MCP_ACCESS_KEY: "k", LINK_SECRET: "hemmelig", PUBLIC_BASE_URL: "https://lasso.test" });
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);
const NOW = Date.UTC(2026, 8, 25);

test("et signeret link kan verificeres og peger på /k/<cvr>", () => {
  const url = companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 10 }, NOW);
  assert.match(url, /^https:\/\/lasso\.test\/k\/34580820\?m=omsaetning&y=10&e=\w+&s=[\w-]{22}$/);
  assert.deepEqual(verifyCompanyLink(config, "34580820", query(url), NOW), { ok: true, link: { cvr: "34580820", metric: "omsaetning", years: 10 } });
});

test("ændret CVR, parameter eller signatur afvises", () => {
  const q = query(companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 10 }, NOW));
  assert.deepEqual(verifyCompanyLink(config, "24256790", q, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, y: "5" }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, s: "x".repeat(22) }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, s: undefined }, NOW), { ok: false, reason: "invalid" });
});

test("linket udløber efter LINK_TTL_DAYS", () => {
  const q = query(companyLink(config, { cvr: "34580820", metric: "resultat", years: 5 }, NOW));
  assert.equal(verifyCompanyLink(config, "34580820", q, NOW + 29 * 86_400_000).ok, true);
  assert.deepEqual(verifyCompanyLink(config, "34580820", q, NOW + 31 * 86_400_000), { ok: false, reason: "expired" });
});

test("linket bærer visningens focus, og focus er signeret", () => {
  const url = companyLink(config, { cvr: "34580820", metric: "bruttofortjeneste", years: 10, focus: "oekonomi" }, NOW);
  const q = query(url);
  assert.equal(q.f, "oekonomi");
  assert.deepEqual(verifyCompanyLink(config, "34580820", q, NOW), { ok: true, link: { cvr: "34580820", metric: "bruttofortjeneste", years: 10, focus: "oekonomi" } });
  // Et andet focus med samme signatur afvises; et ukendt focus også.
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, f: "ejerskab" }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, f: "hemmeligt" }, NOW), { ok: false, reason: "invalid" });
  // Overblik er standard og står ikke i linket.
  assert.equal(query(companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 5, focus: "overblik" }, NOW)).f, undefined);
});
