import assert from "node:assert/strict";
import { test } from "node:test";
import { businessResume } from "./textSections.js";
import { companyFacts, STAMDATA_ROWS } from "./companyFacts.js";
import { relationGroupsOf, relationsFromCurrent } from "./relations.js";
import { portalPages } from "./showcase.js";
import type { CompanyVM } from "./models.js";

const co: CompanyVM = {
  lassoId: "CVR-1-34580820", cvr: "34580820", name: "LASSO X A/S", status: "Normal", form: "Aktieselskab", industryCode: "631000", industryText: "IT-infrastruktur",
  address: { street: "Toldbodgade 37B", zip: "1253", city: "København K", municipality: "København" }, founded: "2012-05-14", employees: 16,
  secondaryNames: ["Hubster A/S", "Lasso Excite A/S"], advertisingProtected: false, listed: false, statutesChanged: "2022-07-13",
  registeredCapital: { amount: 1782248, currency: "DKK" }, purpose: "Selskabets formål er at drive virksomhed med databehandling.", signingRule: "Tegnes af to direktører.",
  altIndustries: [{ code: "622000", text: "Computerkonsulentbistand" }],
};

test("stamoplysninger: rows giver portalens felter i portalens rækkefølge; uden rows er listen uændret", () => {
  const rows = companyFacts(co, undefined, { year: 2025, periodStart: "2025-01-01", periodEnd: "2025-12-31", published: "2026-04-15" }, { rows: STAMDATA_ROWS });
  const labels = rows.map((r) => r.label);
  assert.deepEqual(labels.slice(0, 4), ["Firmanavn", "Adresse", "Kommune", "Reklamebeskyttet"]);
  assert.equal(rows.find((r) => r.key === "binavne")?.value, "Hubster A/S\nLasso Excite A/S");
  assert.equal(rows.find((r) => r.key === "brancher")?.value, "631000: IT-infrastruktur\n622000: Computerkonsulentbistand");
  assert.equal(rows.find((r) => r.key === "boersnoteret")?.value, "Nej");
  assert.equal(rows.find((r) => r.key === "senesteregnskab")?.value, "15.04.2026");
  assert.ok(!companyFacts(co, undefined, undefined).some((r) => r.key === "firmanavn" || r.key === "binavne"), "nye rækker kun med rows");
});

test("relationsgrupper: adm. direktør står under Adm. direktører og Direktion; formand og suppleant er underroller", () => {
  assert.deepEqual(relationGroupsOf("Adm. direktør"), { groups: ["adm", "direktion"], role: "Adm. dir" });
  assert.deepEqual(relationGroupsOf("Bestyrelsesformand"), { groups: ["bestyrelse"], role: "Formand" });
  assert.deepEqual(relationGroupsOf("MEMBER", "board").groups, ["bestyrelse"]);
  assert.deepEqual(relationGroupsOf("", "founder").groups, ["stiftere"]);
  const rel = relationsFromCurrent([{ name: "A", role: "Direktør", from: "2014-06-01" }, { name: "B", role: "Bestyrelsesmedlem", from: "2016-01-01", to: "2024-01-01" }], { lassoId: "x", owners: [{ name: "C ApS", share: "15–19,99 %" }] });
  assert.equal(rel.filter((r) => r.current).length, 2);
  assert.equal(rel.find((r) => r.name === "B")?.current, false);
  assert.equal(rel.find((r) => r.group === "legale-ejere")?.votes, "15–19,99 %");
});

test("erhvervsresume: fortæller alder, første navn, branche, formål, ansatte og seneste regnskab uden dobbelt punktum", () => {
  const t = businessResume({ name: "LASSO X A/S", founded: "2012-05-14", city: "København K", industryText: "IT-infrastruktur", purpose: "At drive IT.", employees: 16, firstName: "HUBSTER ApS", lastYear: { year: 2025, grossProfit: 18_792_000, profit: -201_000 }, today: new Date("2026-09-30") })!;
  assert.match(t, /^For 14 år siden blev virksomheden LASSO X A\/S stiftet i København K\./);
  assert.match(t, /grundlagt under navnet HUBSTER ApS/);
  assert.match(t, /formål er angivet som "At drive IT"/);
  assert.match(t, /bruttofortjeneste på 18,8 mio\. kr\. og et resultat på -0,2 mio\. kr\.$/);
  assert.doesNotMatch(t, /\.\./);
});

test("Lasso-siden: Overblik i tre kolonner (¼ ¼ ½) og Stamoplysninger som liste; alle specs er gyldige", () => {
  const [ov, st] = portalPages("CVR-1-34580820");
  assert.equal(ov!.layout, "columns");
  assert.deepEqual([...new Set(ov!.components.map((c) => `${(c as { column?: number }).column}:${(c as { width?: string }).width}`))], ["1:quarter", "2:quarter", "3:half"]);
  assert.deepEqual(st!.components.map((c) => c.type), ["LassoKeyValueList", "LassoRelationsTable", "LassoRelationsTable", "LassoCompanyHistory", "LassoProductionUnits"]);
});
