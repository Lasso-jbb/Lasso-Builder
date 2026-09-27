import assert from "node:assert/strict";
import { test } from "node:test";
import { parseViewSpec } from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import { loadConfig } from "../config.js";
import { textCard } from "../data/card.js";
import { DemoProvider } from "../data/demo.js";
import { entityIdsOf, resolveSpec } from "../data/resolve.js";
import { summarizeView } from "../data/summary.js";
import { verifyEntityLink } from "../web/links.js";
import { entitySnapshot, pagesExtras, savedPageVM } from "./resolveExtras.js";
import { MemorySavedPageStore, SavedPageError } from "./store.js";

const config = loadConfig({ MCP_ACCESS_KEY: "k", LINK_SECRET: "hemmelig", PUBLIC_BASE_URL: "https://lasso.test" });
const user: CurrentUser = { id: "jbb", name: "Jakob", org: "lasso", isDemo: false };
const provider = new DemoProvider();
const listSpec = parseViewSpec({ title: "Mine gemte sider", layout: "stack", components: [{ type: "LassoSavedPages" }] });

test("uden extras får LassoSavedPages en tom tilstand, og savedIds udelades", async () => {
  const ds = await resolveSpec(listSpec, provider);
  assert.deepEqual(ds.savedPages, {});
  assert.equal(ds.errors["savedPages:all|20"], "Gemte sider kræver adgang som bruger og vises ikke på en delt side.");
  assert.equal("savedIds" in ds, false);
  // Kortet ombryder teksten i sin faste bredde.
  assert.match((textCard(listSpec, ds) ?? "").replace(/ *│\n│ /g, " "), /Gemte sider kræver adgang som bruger og vises ikke på en delt side\./);
});

test("entityIdsOf samler company, companies, benchmark og person", () => {
  const spec = parseViewSpec({
    title: "Blandet",
    components: [
      { type: "LassoCompanyHead", company: "CVR-1-99000001" },
      { type: "LassoCompareTable", companies: ["CVR-1-99000002", "CVR-1-99000001"] },
      { type: "LassoLineChart", company: "CVR-1-99000003", metric: "omsaetning", years: 5, benchmark: "CVR-1-99000004" },
      { type: "LassoPersonHead", person: "CVR-3-4000000001" },
      { type: "LassoSavedPages" },
    ],
  });
  assert.deepEqual(entityIdsOf(spec).sort(), ["CVR-1-99000001", "CVR-1-99000002", "CVR-1-99000003", "CVR-1-99000004", "CVR-3-4000000001"]);
});

test("en fejl i savedIds vælter aldrig visningen", async () => {
  const spec = parseViewSpec({ title: "Byg", components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001" }] });
  const ds = await resolveSpec(spec, provider, {
    savedIds: () => {
      throw new Error("databasen er nede");
    },
  });
  assert.equal(ds.companies["CVR-1-99000001"]?.name, "Eksempel Byg A/S");
  assert.equal("savedIds" in ds, false);
  const rejected = await resolveSpec(spec, provider, { savedIds: async () => Promise.reject(new Error("nede")) });
  assert.equal("savedIds" in rejected, false);
});

test("pagesExtras: listen med signerede links pr. side, og savedIds for visningens ID'er", async () => {
  const pages = new MemorySavedPageStore();
  await pages.save({ org: "lasso", userId: "jbb", lassoId: "CVR-1-99000001", kind: "company", name: "Eksempel Byg A/S", cvr: "99000001", focus: "oekonomi", origin: "manual" });
  await new Promise((r) => setTimeout(r, 2));
  await pages.save({ org: "lasso", userId: "jbb", lassoId: "CVR-3-4000000001", kind: "person", name: "Bo Eksempel", note: "Bestyrelse", origin: "send" });
  // En ukendt focus i lageret giver et link uden focus (så det altid kan verificeres).
  await pages.save({ org: "lasso", userId: "anna", lassoId: "CVR-1-99000002", kind: "company", name: "Anden", focus: "ukendt", origin: "manual" });

  const extras = pagesExtras(pages, user, config);
  const ds = await resolveSpec(
    parseViewSpec({ title: "Blandet", components: [{ type: "LassoSavedPages" }, { type: "LassoCompanyHead", company: "CVR-1-99000001" }, { type: "LassoCompanyHead", company: "CVR-1-99000002" }] }),
    provider,
    extras,
  );
  const list = ds.savedPages["all|20"]!;
  assert.equal(list.total, 2);
  assert.deepEqual(list.pages.map((p) => p.lassoId), ["CVR-3-4000000001", "CVR-1-99000001"]);
  assert.equal(list.pages[0]!.note, "Bestyrelse");
  assert.equal(list.pages[0]!.origin, "send");
  const byg = list.pages[1]!;
  assert.equal(byg.cvr, "99000001");
  const q = Object.fromEntries(new URL(byg.url!).searchParams);
  assert.deepEqual(verifyEntityLink(config, "CVR-1-99000001", q), { ok: true, lassoId: "CVR-1-99000001", focus: "oekonomi" });
  assert.deepEqual(ds.savedIds, ["CVR-1-99000001"]);

  const [other] = (await pages.list("lasso", "anna")).pages;
  const vm = savedPageVM(config, other!);
  assert.equal(vm.focus, "ukendt");
  assert.equal(new URL(vm.url!).searchParams.get("f"), null);

  const summary = summarizeView(listSpec, ds);
  assert.match(summary, /Gemte sider \(2 i alt, viser 2\): Bo Eksempel \(Person, CVR-3-4000000001, gemt \d\d\.\d\d\.\d{4}, note "Bestyrelse"\), Eksempel Byg A\/S \(Virksomhed, CVR 99000001, gemt \d\d\.\d\d\.\d{4}\)\./);
});

test("resuméet nævner højst 10 navne og tæller resten", async () => {
  const pages = new MemorySavedPageStore();
  for (let i = 1; i <= 13; i++) {
    const cvr = String(99000000 + i);
    await pages.save({ org: "lasso", userId: "jbb", lassoId: `CVR-1-${cvr}`, kind: "company", name: `Firma ${i}`, cvr, origin: "manual" });
  }
  const spec = parseViewSpec({ title: "Mine gemte sider", layout: "stack", components: [{ type: "LassoSavedPages", limit: 12 }] });
  const ds = await resolveSpec(spec, provider, pagesExtras(pages, user, config));
  const summary = summarizeView(spec, ds);
  assert.match(summary, /Gemte sider \(13 i alt, viser 12\): /);
  assert.equal((summary.match(/\(Virksomhed, CVR/g) ?? []).length, 10);
  assert.match(summary, / … og 3 til\./);
  const card = textCard(spec, ds)!;
  assert.match(card, /MINE GEMTE SIDER \(13\)/);
  assert.match(card, /og 1 flere/);
  assert.equal((card.match(/Åbn: https:\/\/lasso\.test\/e\//g) ?? []).length, 12);
});

test("entitySnapshot henter navn (og CVR) friskt og afviser andre ID'er", async () => {
  assert.deepEqual(await entitySnapshot(provider, "CVR-1-99000001"), { kind: "company", name: "Eksempel Byg A/S", cvr: "99000001" });
  const person = await entitySnapshot(provider, "CVR-3-4000000001");
  assert.equal(person.kind, "person");
  assert.equal(person.cvr, undefined);
  assert.ok(person.name.length > 0);
  await assert.rejects(entitySnapshot(provider, "CVR-2-1000000000"), SavedPageError);
  await assert.rejects(entitySnapshot(provider, "CVR-1-12345678"));
});
