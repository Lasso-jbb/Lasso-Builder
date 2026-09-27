import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCompany } from "./compose.js";
import { emptyDataset, type Dataset } from "./models.js";
import { extraSignals, riskSignals } from "./riskSignals.js";
import { hasNoStatements, hasReportingDuty, NO_STATEMENTS_REASON, noStatementsReason } from "./statements.js";

const id = "CVR-1-43811983";
const NOW = new Date("2026-09-27T12:00:00Z");

/** Lassos egen enkeltmandsvirksomhed: stiftet 2023, intet regnskab, én "mulig vigtig" observation om netop det. */
function enk(): Dataset {
  const ds = emptyDataset("live");
  ds.companies[id] = { lassoId: id, name: "Lasso", status: "Aktiv", form: "ENK", founded: "2023-01-30" };
  ds.people[id] = [{ name: "Christian", role: "Fuldt ansvarlig deltager", from: "2023-01-30" }];
  ds.financials[id] = { lassoId: id, currency: "DKK", years: [] };
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };
  ds.observations[id] = {
    lassoId: id,
    observations: [
      { id: "o1", title: "Intet offentliggjort regnskab", severity: 50, detail: "Virksomheden har endnu ikke offentliggjort et regnskab." },
      { id: "o2", title: "Virksomhedsstatus", severity: 0 },
    ],
  };
  return ds;
}

test("regnskab uden offentliggjort regnskab: én tom tilstand på nøgletallenes plads, oplysninger og ledelse ved siden af", () => {
  const spec = composeCompany(id, enk(), { focus: "regnskab" });
  const types = spec.components.map((c) => c.type);
  assert.deepEqual(types, ["LassoCompanyHead", "LassoRiskObservations", "LassoIncomeStatement", "LassoKeyValueList", "LassoPersonList", "LassoFollowUps"]);
  const stmt = spec.components.find((c) => c.type === "LassoIncomeStatement");
  assert.equal(stmt?.title, "Regnskab");
  assert.equal(stmt?.column, undefined);
  assert.equal(spec.components.find((c) => c.type === "LassoKeyValueList")?.column, 1);
  assert.equal(spec.components.find((c) => c.type === "LassoPersonList")?.column, 2);
  assert.equal(spec.columns, 2);
  // Ikke to tomme tabeller med samme tekst, og ingen opfølgning, der kræver regnskabstal.
  assert.ok(!types.includes("LassoBalanceSheet"));
  const follow = spec.components.find((c) => c.type === "LassoFollowUps");
  assert.ok(follow && follow.type === "LassoFollowUps");
  assert.deepEqual(follow.prompts.map((p) => p.label), ["Risiko", "Kreditvurdering", "Ledelse"]);
});

test("regnskab uden ledelse: ejere (eller revisor) i kolonne 2", () => {
  const ds = enk();
  ds.people[id] = [];
  ds.ownership[id] = { lassoId: id, owners: [{ name: "Christian", kind: "person", share: "100 %" }] };
  const spec = composeCompany(id, ds, { focus: "regnskab" });
  assert.equal(spec.components.find((c) => c.column === 2)?.type, "LassoOwnerList");
});

test("regnskab med regnskab: tabellerne står stadig i fuld bredde", () => {
  const ds = enk();
  ds.financialStatements[id] = {
    lassoId: id,
    currency: "DKK",
    incomeStatement: [{ year: 2025, revenue: 1_000_000, profit: 100_000 }],
    balanceSheet: [{ year: 2025, assetsTotal: 500_000, liabilitiesAndEquityTotal: 500_000 }],
    cashFlow: [],
  };
  const spec = composeCompany(id, enk(), { focus: "regnskab" });
  assert.ok(!spec.components.some((c) => c.type === "LassoBalanceSheet"));
  const full = composeCompany(id, ds, { focus: "regnskab" });
  const stmts = full.components.filter((c) => c.type === "LassoIncomeStatement" || c.type === "LassoBalanceSheet");
  assert.equal(stmts.length, 2);
  assert.ok(stmts.every((c) => c.column === undefined && c.title === undefined));
  assert.ok(!full.components.some((c) => c.type === "LassoKeyValueList"));
});

test("hasNoStatements: kun hentet og tomt, aldrig 'ikke hentet'", () => {
  assert.equal(hasNoStatements(undefined), false);
  assert.equal(hasNoStatements({ incomeStatement: [], balanceSheet: [] }), true);
  assert.equal(hasNoStatements({ incomeStatement: [{}], balanceSheet: [] }), false);
});

test("Lassos 'Intet offentliggjort regnskab' dækker det afledte signal, så det ikke står to gange", () => {
  // Et anpartsselskab, så det afledte signal findes (en ENK har ingen regnskabspligt, se nedenfor).
  const ds = enk();
  ds.companies[id] = { ...ds.companies[id]!, form: "ApS" };
  const derived = riskSignals(id, ds, NOW).signals;
  assert.ok(derived.some((s) => s.id === "afledt:regnskab"), "over to år gammel uden regnskab giver signalet");
  assert.ok(!extraSignals(ds.observations[id]!.observations, derived).some((s) => s.id === "afledt:regnskab"));
  // Uden Lassos observation står det afledte signal.
  assert.ok(extraSignals([], derived).some((s) => s.id === "afledt:regnskab"));
  // Andre formuleringer fra Lasso dækker også.
  for (const title of ["Regnskab mangler", "Ikke offentliggjort årsregnskab", "Ingen regnskaber"]) {
    assert.ok(!extraSignals([{ id: "x", title, severity: 50 }], derived).some((s) => s.id === "afledt:regnskab"), title);
  }
});

test("noStatementsReason: siger hvorfor efter virksomhedsform og alder", () => {
  assert.match(noStatementsReason({ lassoId: id, name: "Lasso", form: "ENK", founded: "2023-01-30" }, NOW), /^Enkeltmandsvirksomheder/);
  assert.match(noStatementsReason({ lassoId: id, name: "X", form: "PMV" }, NOW), /^Enkeltmandsvirksomheder/);
  assert.match(noStatementsReason({ lassoId: id, name: "X", form: "Enkeltmandsvirksomhed" }, NOW), /^Enkeltmandsvirksomheder/);
  assert.match(noStatementsReason({ lassoId: id, name: "X", form: "I/S" }, NOW), /^Interessentskaber/);
  // Et ungt selskab: første regnskab er ikke kommet endnu.
  assert.equal(noStatementsReason({ lassoId: id, name: "X", form: "ApS", founded: "2025-06-01" }, NOW), "Virksomheden er stiftet 01.06.2025 og har ikke offentliggjort sit første regnskab endnu.");
  // Et ældre selskab uden regnskab, eller uden stamdata: den almindelige tekst.
  assert.equal(noStatementsReason({ lassoId: id, name: "X", form: "ApS", founded: "2010-01-01" }, NOW), NO_STATEMENTS_REASON);
  assert.equal(noStatementsReason(undefined, NOW), NO_STATEMENTS_REASON);
});

test("regnskabspligt: personligt ejede virksomheder får ikke det afledte 'intet regnskab'-signal", () => {
  assert.equal(hasReportingDuty("ENK"), false);
  assert.equal(hasReportingDuty("PMV"), false);
  assert.equal(hasReportingDuty("Enkeltmandsvirksomhed"), false);
  assert.equal(hasReportingDuty("ApS"), true);
  assert.equal(hasReportingDuty(undefined), true);
  const ds = enk();
  ds.observations[id] = { lassoId: id, observations: [] };
  assert.ok(!riskSignals(id, ds, NOW).signals.some((s) => s.id === "afledt:regnskab"));
  // Et anpartsselskab på samme alder uden regnskab: signalet står, og teksten siger "virksomheden".
  ds.companies[id] = { ...ds.companies[id]!, form: "ApS" };
  const signal = riskSignals(id, ds, NOW).signals.find((s) => s.id === "afledt:regnskab");
  assert.equal(signal?.severity, 50);
  assert.match(signal?.detail ?? "", /^Virksomheden er over to år gammel/);
});
