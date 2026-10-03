import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewSpec } from "@lasso/spec";
import { PortalApiError, type PageTemplate, type SaveTemplateBody } from "../portal/api.js";
import { parseDeepLink, withoutDeepLink } from "./model.js";
import { runViewLink, type StoredView } from "./viewLink.js";

const ID = "CVR-1-99000001";
const spec = { version: 2, kind: "company", title: "KYC", layout: "dashboard", criteria: [], components: [] } as unknown as ViewSpec;
const stored = (extra: Partial<StoredView> = {}): StoredView => ({ entity: { kind: "company", id: ID }, spec, title: "KYC-overblik", subtitle: "Ejere og nøgletal", ...extra });

test("Dybt link med visning: ?aabn=…&visning=… læses uden fastgørelse og ryddes fra adressen; det ældre fokus/fastgoer virker stadig", () => {
  assert.deepEqual(parseDeepLink(`?aabn=${ID}&visning=Ab3_x-9`), { kind: "company", id: ID, tab: "overblik", pin: false, view: "Ab3_x-9" });
  // Med visning fastgøres fanen ikke, heller ikke med fastgoer=1.
  assert.equal(parseDeepLink(`?aabn=${ID}&visning=abc&fastgoer=1`)!.pin, false);
  // Et ugyldigt id ignoreres (som et almindeligt link til fanen).
  assert.equal(parseDeepLink(`?aabn=${ID}&visning=<script>`)!.view, undefined);
  assert.deepEqual(parseDeepLink(`?aabn=${ID}&fokus=oekonomi&fastgoer=1`), { kind: "company", id: ID, tab: "oekonomi", pin: true });
  assert.equal(withoutDeepLink(`https://x.dk/portal?aabn=${ID}&visning=abc&tema=dark`), "/portal?tema=dark");
});

test("Visningen som modul: ny egen side gemmes med titel, undertitel, spec og entitet, og fanen skifter til den", async () => {
  const saved: SaveTemplateBody[] = [];
  const r = await runViewLink(
    { kind: "company", id: ID, view: "abc" },
    {
      visning: async (id) => (assert.equal(id, "abc"), stored()),
      saveTemplate: async (body) => (saved.push(body), { id: "tpl-1", kind: body.kind, title: body.title, subtitle: body.subtitle } as PageTemplate),
    },
  );
  assert.deepEqual(saved, [{ kind: "company", title: "KYC-overblik", subtitle: "Ejere og nøgletal", spec, entity: { kind: "company", id: ID } }]);
  assert.deepEqual(r, { tab: "tpl:tpl-1", template: { id: "tpl-1", kind: "company", title: "KYC-overblik", subtitle: "Ejere og nøgletal" } });
});

test("Visningen findes allerede som egen side: intet gemmes, fanen skifter til den", async () => {
  let saves = 0;
  const r = await runViewLink({ kind: "company", id: ID, view: "abc" }, { visning: async () => stored({ existingTemplateId: "tpl-9" }), saveTemplate: async () => (saves++, { id: "x", kind: "company", title: "x" }) });
  assert.equal(saves, 0);
  assert.deepEqual(r, { tab: "tpl:tpl-9" });
});

test("Fejl: udløbet visning, navnetjek (400), en afvisning (403) og en anden entitet giver en kort dansk besked og Overblik", async () => {
  const fail = (e: unknown) => ({ visning: async () => Promise.reject(e), saveTemplate: async () => ({ id: "x", kind: "company", title: "x" }) as PageTemplate });
  const link = { kind: "company" as const, id: ID, view: "abc" };
  assert.deepEqual(await runViewLink(link, fail(new PortalApiError(404, "Not found"))), { tab: "overblik", notice: "Visningen findes ikke længere. Bed om et nyt link." });
  assert.deepEqual(await runViewLink(link, fail(new PortalApiError(410, "Gone"))), { tab: "overblik", notice: "Visningen findes ikke længere. Bed om et nyt link." });
  const save = (e: unknown) => ({ visning: async () => stored(), saveTemplate: async () => Promise.reject(e) });
  assert.deepEqual(await runViewLink(link, save(new PortalApiError(400, "Navnet findes allerede."))), { tab: "overblik", notice: "Navnet findes allerede." });
  assert.deepEqual(await runViewLink(link, save(new PortalApiError(403, "Forbidden"))), { tab: "overblik", notice: "Visningen kunne ikke tilføjes som modul." });
  assert.deepEqual(await runViewLink(link, save(new Error("netværk"))), { tab: "overblik", notice: "Visningen kunne ikke åbnes. Prøv linket igen." });
  const other = await runViewLink(link, { visning: async () => stored({ entity: { kind: "company", id: "CVR-1-99000002" } }), saveTemplate: async () => ({ id: "x", kind: "company", title: "x" }) });
  assert.equal(other.tab, "overblik");
  assert.match(other.notice!, /passer ikke/);
});
