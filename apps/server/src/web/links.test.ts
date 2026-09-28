import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { companyLink, personLink, verifyCompanyLink, verifyPersonLink } from "./links.js";

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

test("personlinket /p/ bærer personfokus, og fokus er signeret; overblik står ikke i linket", () => {
  const url = personLink(config, "CVR-3-4000000002", "risiko", NOW);
  assert.match(url, /^https:\/\/lasso\.test\/p\/CVR-3-4000000002\?e=\w+&f=risiko&s=[\w-]{22}$/);
  const q = query(url);
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", q, NOW), { ok: true, lassoId: "CVR-3-4000000002", focus: "risiko" });
  // Et andet personfokus med samme signatur afvises, et virksomhedsfokus og et ukendt også.
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...q, f: "netvaerk" }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...q, f: "oekonomi" }, NOW), { ok: false, reason: "invalid" });
  // Uden f: overblik, og samme signatur som links fra før personfokus.
  const plain = personLink(config, "CVR-3-4000000002", "overblik", NOW);
  assert.equal(query(plain).f, undefined);
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", query(plain), NOW), { ok: true, lassoId: "CVR-3-4000000002" });
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...query(plain), f: "risiko" }, NOW), { ok: false, reason: "invalid" });
  assert.equal(personLink(config, "CVR-3-4000000002", undefined, NOW), plain);
});

test("linket bærer spørgsmålet (q), og det er signeret; modellens nøgletal (qm) med", () => {
  const url = companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 5, question: "Hvad er soliditetsgraden i Novo?", metrics: ["soliditetsgrad"] }, NOW);
  const q = query(url);
  assert.equal(q.q, "Hvad er soliditetsgraden i Novo?");
  assert.equal(q.qm, "soliditetsgrad");
  assert.deepEqual(verifyCompanyLink(config, "34580820", q, NOW), {
    ok: true,
    link: { cvr: "34580820", metric: "omsaetning", years: 5, question: "Hvad er soliditetsgraden i Novo?", metrics: ["soliditetsgrad"] },
  });
  // Et andet spørgsmål eller andre nøgletal med samme signatur afvises; qm uden q og ukendte nøgletal også.
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, q: "Hvem ejer Novo?" }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, qm: "gaeld" }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, q: undefined }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...q, qm: "salg" }, NOW), { ok: false, reason: "invalid" });
  // Punktummer i spørgsmålet kan ikke flytte felterne i signaturen.
  const dots = query(companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 5, focus: "oekonomi", question: "a.b.c" }, NOW));
  assert.equal(verifyCompanyLink(config, "34580820", dots, NOW).ok, true);
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...dots, f: undefined, q: "oekonomi.q=a.b.c" }, NOW), { ok: false, reason: "invalid" });
});

test("gamle links uden q er stadig gyldige, og et spørgsmål kan ikke sættes på bagefter", () => {
  // Samme payload som før spørgsmålene: "k1.<cvr>.<metric>.<years>.<exp>[.<focus>]".
  const old = query(companyLink(config, { cvr: "34580820", metric: "resultat", years: 10, focus: "oekonomi" }, NOW));
  assert.equal(old.q, undefined);
  assert.deepEqual(verifyCompanyLink(config, "34580820", old, NOW), { ok: true, link: { cvr: "34580820", metric: "resultat", years: 10, focus: "oekonomi" } });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...old, q: "hvem ejer" }, NOW), { ok: false, reason: "invalid" });
  const person = query(personLink(config, "CVR-3-4000000002", "risiko", NOW));
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", person, NOW), { ok: true, lassoId: "CVR-3-4000000002", focus: "risiko" });
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...person, q: "sidder hun i bestyrelser" }, NOW), { ok: false, reason: "invalid" });
});

test("et spørgsmål over 300 tegn (eller tomt) afvises; linket selv klipper det til 300", () => {
  const long = "x".repeat(301);
  const url = companyLink(config, { cvr: "34580820", metric: "omsaetning", years: 5, question: long }, NOW);
  assert.equal(query(url).q!.length, 300);
  assert.equal(verifyCompanyLink(config, "34580820", query(url), NOW).ok, true);
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...query(url), q: long }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyCompanyLink(config, "34580820", { ...query(url), q: " " }, NOW), { ok: false, reason: "invalid" });
  const p = query(personLink(config, "CVR-3-4000000002", undefined, "Sidder Bo i bestyrelser?", NOW));
  assert.equal(p.q, "Sidder Bo i bestyrelser?");
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", p, NOW), { ok: true, lassoId: "CVR-3-4000000002", question: "Sidder Bo i bestyrelser?" });
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...p, q: long }, NOW), { ok: false, reason: "invalid" });
  assert.deepEqual(verifyPersonLink(config, "CVR-3-4000000002", { ...p, qm: "resultat" }, NOW), { ok: false, reason: "invalid" });
});
