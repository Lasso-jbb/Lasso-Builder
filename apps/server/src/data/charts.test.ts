import assert from "node:assert/strict";
import { test } from "node:test";
import { activityHeatmapKey, buildActivityHeatmap, changeFeedKey, COMPONENT_CATALOG, composeCompany, composeProbe, parseViewSpec } from "@lasso/spec";
import { adaptIndustryBenchmark, adaptMapPoints, coordinatesOf } from "../lasso/chartAdapters.js";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";

const demo = new DemoProvider();
const ID = "CVR-1-99000001";

test("nye katalogtyper (13.10, 13.11, 13.12) har schema og katalogtekst uden midterprik; 18.2/22.2 er slettet (Jakob 01.10)", () => {
  for (const type of ["LassoScoreHistory", "LassoAuditorIndependence"]) assert.ok(!COMPONENT_CATALOG.some((e) => (e.type as string) === type), type);
  for (const type of ["LassoKeyFigureGauge", "LassoHeatmap", "LassoMap"] as const) {
    const entry = COMPONENT_CATALOG.find((e) => e.type === type);
    assert.ok(entry, type);
    assert.match(entry.description, /Brug til:[^]*Brug ikke når:[^]*Kræver:[^]*Eksempel/);
    assert.doesNotMatch(entry.description, /·/);
  }
  const spec = parseViewSpec({
    title: "Test",
    components: [
      { type: "LassoKeyFigureGauge", company: ID, metrics: ["soliditetsgrad"] },
      { type: "LassoHeatmap", list: "Kunder" },
      { type: "LassoMap", company: ID },
      { type: "LassoShareBars", company: ID, variant: "ejerkreds" },
      { type: "LassoLineChart", company: ID, industry: true },
    ],
  });
  assert.equal(spec.components[1]!.type === "LassoHeatmap" && spec.components[1]!.months, 12, "standard 12 måneder");
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoKeyFigureGauge", company: ID, metrics: ["omsaetning"] }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoHeatmap", months: 30 }] }));
});

test("resolveSpec henter branchetal, historik, kort, heatmap og det fulde regnskab til stablet/vandfald", async () => {
  const spec = parseViewSpec({
    title: "Test",
    components: [
      { type: "LassoKeyFigureGauge", company: ID },
      { type: "LassoHeatmap", list: "Kunder", months: 6 },
      { type: "LassoMap", company: ID },
      { type: "LassoStackedBarChart", company: ID },
      { type: "LassoShareBars", company: ID, variant: "ejerkreds" },
    ],
  });
  const ds = await resolveSpec(spec, demo);
  assert.deepEqual(ds.errors, {});
  assert.equal(ds.industryBenchmarks[ID]?.state, "ok");
  assert.ok(ds.financials[ID] && ds.financialStatements[ID], "stablet søjle henter også det fulde regnskab");
  assert.ok(ds.ownership[ID], "ejerkreds henter ejerne");
  const h = ds.activityHeatmaps[activityHeatmapKey({ list: "Kunder", months: 6 })];
  assert.equal(h?.months.length, 6);
  assert.ok(h!.total > 0);
  assert.ok(ds.maps[ID]!.points.some((p) => p.kind === "focus"));
});

test("demo: scoremålerens hente-tilstande; Lassos risikoscore uden Creditsafe-fakta og historik (10.1)", async () => {
  assert.equal((await demo.score("CVR-1-99000003")).state, "notfetched");
  assert.equal((await demo.score("CVR-1-99000006")).state, "fetching");
  const off = await demo.score("CVR-1-99000010");
  assert.equal(off.state, "unavailable");
  assert.ok(off.reason, "ikke tilgængelig har altid en årsag");
  const ok = await demo.score(ID);
  assert.equal(typeof ok.score, "number");
  assert.ok(ok.score! >= 0 && ok.score! <= 100, "0-100, hvor 100 = høj risiko");
  assert.equal(ok.facts, undefined, "ingen Kreditmaksimum/International score (Creditsafe bruges ikke)");
  assert.equal(ok.history, undefined, "ingen scorehistorik (18.2 udgår)");
});

test("heatmap: tæller foldede ændringer med deres antal og udelader tomme typer", () => {
  const now = new Date(Date.UTC(2026, 8, 15));
  const h = buildActivityHeatmap(
    [
      { type: "regnskab", at: "2026-09-02T08:00:00Z" },
      { type: "stamdata", at: "2026-08-10T08:00:00Z", count: 5 },
      { type: "ledelse", at: "2025-01-10T08:00:00Z" },
    ],
    { months: 3, now },
  );
  assert.deepEqual(h.months, ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(h.rows.map((r) => [r.type, r.counts]), [["regnskab", [0, 0, 1]], ["stamdata", [0, 5, 0]]]);
  assert.equal(h.total, 6);
});

test("live-adaptere er defensive: ukendt form giver unavailable/tom, aldrig en fejl", () => {
  assert.equal(adaptIndustryBenchmark("CVR-1-1", {}).state, "unavailable");
  const b = adaptIndustryBenchmark("CVR-1-1", { industryCode: "412000", companyCount: 250, years: [{ year: 2025, median: { solvencyRatio: 0.325, profitMargin: 6.1 } }] });
  assert.equal(b.state, "ok");
  assert.equal(b.years[0]!.median.soliditetsgrad, 32.5, "brøk ganges op til procent");
  assert.equal(b.years[0]!.median.overskudsgrad, 6.1);
  assert.equal(b.peers, 250);
  assert.equal(coordinatesOf({ x: 552000, y: 6200000 }), null, "UTM afvises");
  assert.deepEqual(coordinatesOf({ coordinates: { lat: 56.16, lng: 9.55 } }), { lat: 56.16, lon: 9.55 });
  const empty = adaptMapPoints("CVR-1-1", { name: "Prøve A/S", address: { street: "Prøvevej" } });
  assert.equal(empty.points.length, 0);
  assert.ok(empty.emptyReason);
  const one = adaptMapPoints("CVR-1-1", { name: "Prøve A/S", address: { latitude: 56.1, longitude: 9.5 } }, [{ pNumber: "1", address: {} }]);
  assert.equal(one.points.length, 1);
  assert.equal(one.missing, 1);
});

test("B4: LassoChangeFeed for én virksomhed: resolveSpec henter changeFeed({ companies: [id], days }) (demo: mindst 3 ændringer inden for 90 dage)", async () => {
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoChangeFeed", company: ID }] });
  const ds = await resolveSpec(spec, demo);
  const feed = ds.changeFeeds[changeFeedKey({ company: ID, days: 30 })];
  assert.ok(feed, Object.keys(ds.changeFeeds).join(", "));
  assert.equal(feed.days, 30);
  assert.equal(feed.listName, undefined);
  assert.ok(feed.entries.length >= 3, `${feed.entries.length}`);
  assert.ok(feed.entries.every((e) => e.lassoId === ID));
  const ninety = await demo.changeFeed({ companies: [ID], days: 90 });
  assert.ok(ninety.total >= 5 && ninety.entries.every((e) => e.lassoId === ID));
  // En virksomhed uden ændringer: tom tilstand med årsag, ingen liste; listen "Kunder" er uændret.
  const none = await demo.changeFeed({ companies: ["CVR-1-99000009"], days: 30 });
  assert.equal(none.entries.length, 0);
  assert.match(none.emptyReason ?? "", /Ingen ændringer i virksomheden/);
  assert.equal((await demo.changeFeed({ list: "Kunder", days: 7 })).listName, "Kunder");
  // Fokus historik henter feedet (probe) og viser det for Eksempel Byg ("vis alt": Ø13/B8 gør feedet smalt og højt,
  // så det inden for højdebudgettet kan vige for Statstidende/fusioner).
  const hist = await resolveSpec(composeProbe(ID, "historik"), demo);
  assert.ok(composeCompany(ID, hist, { focus: "historik", showAll: true }).components.some((c) => c.type === "LassoChangeFeed" && c.company === ID));
});
