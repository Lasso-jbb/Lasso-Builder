import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ObservationsVM } from "@lasso/spec";
import { RiskObservations, observationSummary, sortObservations } from "./components/RiskObservations.js";
import { DataState } from "./primitives.js";

const data: ObservationsVM = {
  lassoId: "CVR-1-99000001",
  checkedAt: "2026-09-25",
  sources: ["CVR", "regnskab"],
  observations: [
    { id: "a", severity: 25, title: "Revisor skiftet", source: "Regnskab", date: "2026-06-02" },
    { id: "b", severity: 100, title: "Negativ egenkapital hos ejer", detail: "Eksempel Holding ApS har negativ egenkapital.", source: "Regnskab", date: "2026-06-02" },
    { id: "c", severity: 50, title: "Adresse deles med 12 virksomheder", source: "CVR", date: "2026-02-14" },
    { id: "d", severity: 0, title: "Nyt medlem i ledelsen", source: "Ledelse" },
  ],
};

test("17.2: sammenfatning som filterchips og kort sorteret efter alvor", () => {
  const html = renderToStaticMarkup(createElement(RiskObservations, { data, demo: true }));
  assert.match(html, /3, eksempeldata/);
  assert.match(html, /aria-pressed="false"[^>]*>1 høj</);
  assert.match(html, />1 middel</);
  assert.match(html, />1 info</);
  const order = ["Negativ egenkapital", "Adresse deles", "Revisor skiftet", "Nyt medlem"].map((t) => html.indexOf(t));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  // Regel 7: alvorsordet står ved farvekanten
  assert.match(html, /lasso-obs-card--høj[^]*Høj, Regnskab, 02\.06\.2026/);
  assert.doesNotMatch(html, /·/);
  assert.match(html, /Kilde: Lasso \(CVR, regnskab\), opdateret 25\.09\.2026/);
});

test("17.2: tom liste er positiv information med dato, stiplet ramme og ingen fejl", () => {
  const html = renderToStaticMarkup(createElement(RiskObservations, { data: { lassoId: "x", observations: [], checkedAt: "2026-09-25" } }));
  assert.match(html, /class="lasso-state lasso-state--positive"/);
  assert.match(html, /Intet at bemærke/);
  assert.match(html, /Sidst tjekket 25\.09\.2026/);
  assert.doesNotMatch(html, /lasso-state--error|role="alert"/);
});

test("17.2: sammenfatning og sortering", () => {
  assert.equal(observationSummary(data.observations), "1 høj, 1 middel, 1 info og 1 neutral");
  assert.deepEqual(sortObservations(data.observations).map((o) => o.id), ["b", "c", "a", "d"]);
});

test("26h.1: DataState låst, på forespørgsel, tom med handling og fejl med rød kant", () => {
  const locked = renderToStaticMarkup(createElement(DataState, { state: "locked", reason: "Reelle ejere kræver Lasso Pro.", action: { label: "Se planer", onClick: () => {} } }));
  assert.match(locked, /lasso-state-locked__content/);
  assert.match(locked, /Reelle ejere kræver Lasso Pro\.[^]*lasso-btn--primary[^>]*>Se planer</);
  const req = renderToStaticMarkup(createElement(DataState, { state: "onrequest", reason: "Tager 5–45 sekunder og koster 1 kredit.", action: { label: "Hent kreditvurdering", onClick: () => {} } }));
  assert.match(req, /koster 1 kredit\.[^]*Hent kreditvurdering/);
  const pending = renderToStaticMarkup(createElement(DataState, { state: "onrequest", reason: "x", pending: { title: "Henter vurdering …", detail: "ca. 20 sek." } }));
  assert.match(pending, /role="status"[^]*lasso-ring[^]*Henter vurdering/);
  assert.doesNotMatch(pending, /<button/);
  const empty = renderToStaticMarkup(createElement(DataState, { state: "empty", title: "Ingen nyheder endnu", reason: "Vi har ikke fundet omtale.", checkedAt: "2026-09-25", action: { label: "Overvåg nyheder", onClick: () => {} } }));
  assert.match(empty, /Ingen nyheder endnu[^]*Sidst tjekket 25\.09\.2026\.[^]*Overvåg nyheder/);
  const error = renderToStaticMarkup(createElement(DataState, { state: "error", title: "Regnskab kunne ikke hentes", reason: "Erhvervsstyrelsen svarer ikke.", onRetry: () => {}, secondaryAction: { label: "Rapportér", onClick: () => {} } }));
  assert.match(error, /lasso-state--error[^]*Regnskab kunne ikke hentes[^]*lasso-btn--primary[^>]*>Prøv igen<[^]*Rapportér/);
});

test("26d.5: netværkstal som tre små kort, konkurser i rød med ordet", async () => {
  const { PersonStats } = await import("./components/PersonStats.js");
  const person = {
    lassoId: "CVR-3-1",
    name: "Mette Eksempel",
    roles: [
      { companyName: "Gammel Eksempel ApS", companyStatus: "Konkurs", companyEnded: "2019-05-01", kind: "direction" as const, role: "Direktør", from: "2013-01-01", to: "2019-01-01", active: false },
      { companyName: "Data Eksempel A/S", kind: "direction" as const, role: "Direktør", from: "2015-01-01", active: true },
    ],
  };
  const html = renderToStaticMarkup(createElement(PersonStats, { person, network: { lassoId: "CVR-3-1", people: Array.from({ length: 14 }, (_, i) => ({ name: `P${i}` })) as never } }));
  assert.equal((html.match(/lasso-personstats__card/g) ?? []).length, 3);
  assert.match(html, /Netværk<\/span><span class="lasso-personstats__value">14<\/span><span class="lasso-personstats__sub">personer i 1\. led/);
  assert.match(html, /Konkurser<\/span><span class="lasso-personstats__value lasso-personstats__value--danger">1<\/span><span class="lasso-personstats__sub">seneste 2019/);
  assert.match(html, /Tvangsopl\.<\/span><span class="lasso-personstats__value">0<\/span><span class="lasso-personstats__sub">ingen registreret/);
});

test("26d.7: scoremåler med udvikling (maks 6 punkter), fast valgfelt og seneste ændringer", async () => {
  const { ScoreGauge } = await import("./components/ScoreGauge.js");
  const history = ["2024-01-01", "2024-05-01", "2024-09-01", "2025-01-01", "2025-05-01", "2025-09-01", "2026-09-01"].map((date, i) => ({ date, score: 40 + i * 2 }));
  const html = renderToStaticMarkup(
    createElement(ScoreGauge, { score: { lassoId: "x", score: 52, history, changes: [{ date: "2026-06-06", label: "Regnskab 2025 indlæst", delta: 5 }, { date: "2025-05-20", label: "Betalingsanmærkning", delta: -4 }] } }),
  );
  assert.equal((html.match(/lasso-gauge-history__(dot|last)"/g) ?? []).length, 6);
  assert.match(html, /09\.2026<\/span><span>52, lav risiko, \+10 siden 05\.2024/);
  assert.match(html, /Regnskab 2025 indlæst[^]*06\.2026[^]*lasso-gauge-changes__delta--up[^>]*>\+5</);
  assert.match(html, /lasso-gauge-changes__delta--down[^>]*>−4</);
});
