import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCompany, composeProbe, parseViewSpec } from "@lasso/spec";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";
import { summarizeView } from "./summary.js";

const BYG = "CVR-1-99000001";
const TRANSPORT = "CVR-1-99000004";
const SOFTWARE = "CVR-1-99000005";
const CAFE = "CVR-1-99000009";

test("DemoProvider har en fuld A med forrige B, en D, en låst og en ikke beregnet (katalog 17)", async () => {
  const p = new DemoProvider();
  const byg = await p.creditRating(BYG);
  assert.equal(byg.state, "ok");
  assert.equal(byg.current?.internationalScore, "A");
  assert.equal(byg.previous?.internationalScore, "B");
  assert.ok(byg.pdfUrl && byg.latestChange && typeof byg.current?.creditMax === "number");
  const transport = await p.creditRating(TRANSPORT);
  assert.equal(transport.current?.internationalScore, "D");
  assert.equal(transport.previous?.internationalScore, "C");
  assert.equal((await p.creditRating(SOFTWARE)).state, "locked");
  assert.equal((await p.creditRating(CAFE)).state, "unavailable");
  await assert.rejects(p.creditRating("CVR-1-12345678"));
});

test("resuméet har én Creditsafe-linje: bogstav, ord, kreditmaksimum og forrige", async () => {
  const p = new DemoProvider();
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoCompanyHead", company: TRANSPORT }, { type: "LassoCreditRating", company: TRANSPORT }] });
  const ds = await resolveSpec(spec, p);
  const summary = summarizeView(spec, ds);
  assert.match(summary, /^Kreditvurdering \(Creditsafe\): D, høj risiko, kreditmaksimum 150 t\. kr\., lokal score 21, forrige C, ændret 02\.08\.2026\.$/m);

  const lockedSpec = parseViewSpec({ title: "x", components: [{ type: "LassoCreditRating", company: SOFTWARE }] });
  const lockedDs = await resolveSpec(lockedSpec, p);
  assert.match(summarizeView(lockedSpec, lockedDs), /Kreditvurdering \(Creditsafe\): låst: kræver Creditsafe-tilføjelse\./);
});

test("show_company focus risiko henter og viser Creditsafe; overblik henter den aldrig (kredit og ventetid)", async () => {
  const p = new DemoProvider();
  const ds = await resolveSpec(composeProbe(BYG, "risiko"), p);
  assert.equal(ds.creditRatings[BYG]?.current?.internationalScore, "A");
  const spec = composeCompany(BYG, ds, { focus: "risiko" });
  const credit = spec.components.find((c) => c.type === "LassoCreditRating");
  assert.ok(credit, "risiko viser kreditvurderingen");
  const overview = await resolveSpec(composeProbe(BYG, "overblik"), p);
  assert.deepEqual(overview.creditRatings, {});
  assert.ok(!composeCompany(BYG, overview, { focus: "overblik" }).components.some((c) => c.type === "LassoCreditRating"));
});
