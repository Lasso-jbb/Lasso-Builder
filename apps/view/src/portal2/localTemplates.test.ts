import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewSpec } from "@lasso/spec";
import type { SaveTemplateBody, ViewResult } from "../portal/api.js";
import { moduleTabs } from "./model.js";
import {
  addLocalTemplate,
  LOCAL_TEMPLATES_MAX,
  localTemplates,
  localTemplatesKey,
  newLocalId,
  readLocalTemplates,
  removeLocalTemplate,
  serverTemplates,
  specHash,
  type LocalTemplate,
  type TemplateApi,
} from "./localTemplates.js";
import { runViewLink } from "./viewLink.js";

const ID = "CVR-1-99000001";
const spec = (title: string, extra: Record<string, unknown> = {}) => ({ version: 2, kind: "company", title, layout: "dashboard", criteria: [], components: [], ...extra }) as unknown as ViewSpec;

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), map: m };
}

/** Et falsk portal-API: prepare fjerner entiteten (her: title bliver "<titel> (forberedt)"), render tæller kald. */
function fakeApi() {
  const calls = { save: 0, prepare: 0, renderSpec: [] as unknown[], render: 0, remove: 0 };
  const api: TemplateApi = {
    list: async () => [],
    save: async (b: SaveTemplateBody) => (calls.save++, { id: "srv-1", kind: b.kind, title: b.title }),
    remove: async () => void calls.remove++,
    render: async () => (calls.render++, { spec: spec("srv"), dataset: {} } as unknown as ViewResult),
    prepare: async (b) => (calls.prepare++, { title: `${b.spec.title} (forberedt)`, subtitle: "Undertitel", spec: { ...b.spec, title: "{navn}" } as ViewSpec }),
    renderSpec: async (b) => (calls.renderSpec.push(b), { spec: { ...b.spec, title: "tegnet" }, dataset: {}, summary: "s" } as unknown as ViewResult),
  };
  return { api, calls };
}

test("Lokalt lager: tilføj, dublet efter den forberedte specs hash, fjern og højst 20 (den ældste falder ud)", () => {
  let list: LocalTemplate[] = [];
  const a = addLocalTemplate(list, { kind: "company", title: "A", spec: spec("A") }, "local:aaaaaaaaaaaa", 1);
  assert.equal(a.existed, false);
  list = a.list;
  // Samme spec med nøglerne i en anden rækkefølge er en dublet.
  const reordered = { components: [], criteria: [], layout: "dashboard", title: "A", kind: "company", version: 2 } as unknown as ViewSpec;
  assert.equal(specHash(reordered), specHash(spec("A")));
  const dup = addLocalTemplate(list, { kind: "company", title: "A igen", spec: reordered }, "local:bbbbbbbbbbbb", 2);
  assert.equal(dup.existed, true);
  assert.equal(dup.template.id, "local:aaaaaaaaaaaa");
  assert.equal(dup.list.length, 1);
  // Samme spec til en person er ikke en dublet.
  assert.equal(addLocalTemplate(list, { kind: "person", title: "A", spec: spec("A") }, "local:cccccccccccc", 3).existed, false);
  assert.deepEqual(removeLocalTemplate(list, "local:aaaaaaaaaaaa"), []);
  for (let i = 0; i < LOCAL_TEMPLATES_MAX + 3; i++) list = addLocalTemplate(list, { kind: "company", title: `T${i}`, spec: spec(`T${i}`) }, `local:${String(i).padStart(12, "0")}`, i).list;
  assert.equal(list.length, LOCAL_TEMPLATES_MAX);
  assert.equal(list[0]!.title, "T3", "de ældste er faldet ud");
  // Id'et holder modulnøglen (tpl:<id>) under serverens 40 tegn.
  assert.match(newLocalId(), /^local:[a-z0-9]{12}$/i);
  assert.ok(`tpl:${newLocalId()}`.length <= 40);
});

test("Lokalt lager i browseren: pr. bruger, overlever genindlæsning, og ødelagte data giver en tom liste", () => {
  const s = memory();
  const list = addLocalTemplate([], { kind: "company", title: "A", spec: spec("A") }, "local:aaaaaaaaaaaa", 1).list;
  s.setItem(localTemplatesKey("demo"), JSON.stringify(list));
  assert.equal(readLocalTemplates(s, "demo").length, 1);
  assert.equal(readLocalTemplates(s, "anden").length, 0);
  s.setItem(localTemplatesKey("demo"), "{ikke json");
  assert.deepEqual(readLocalTemplates(s, "demo"), []);
  s.setItem(localTemplatesKey("demo"), JSON.stringify([{ id: "srv-1", kind: "company", title: "x", spec: {}, hash: "h" }]));
  assert.deepEqual(readLocalTemplates(s, "demo"), [], "kun lokale id'er");
});

test("Demobrugeren: gem forbereder hos serveren og gemmer i browseren; samme visning igen giver samme modul; fjern og tegn lokalt", async () => {
  const s = memory();
  const { api, calls } = fakeApi();
  let n = 0;
  const backend = localTemplates(api, s, "demo", () => 100, () => `local:${String(++n).padStart(12, "0")}`);
  const body: SaveTemplateBody = { kind: "company", title: "Fra kortet", spec: spec("KYC"), entity: { kind: "company", id: ID } };
  const first = await backend.save(body);
  assert.deepEqual(first, { id: "local:000000000001", kind: "company", title: "KYC (forberedt)", subtitle: "Undertitel" });
  assert.equal(calls.save, 0, "serverens POST /templates bruges ikke");
  assert.equal(calls.prepare, 1);
  const again = await backend.save(body);
  assert.equal(again.id, first.id, "dublet: samme modul");
  assert.deepEqual((await backend.list("company")).map((t) => t.id), [first.id]);
  assert.deepEqual(await backend.list("person"), []);
  // Modulrækken: den lokale side står efter de indbyggede som en egen side (rød nål).
  const tabs = moduleTabs("company", await backend.list("company"));
  assert.deepEqual(tabs.at(-1), { id: `tpl:${first.id}`, label: "KYC (forberedt)", template: true });
  // Tegnes med den aktive entitet via /templates/render, med sidens titel.
  const shown = await backend.render(first.id, "CVR-1-99000002");
  assert.deepEqual(calls.renderSpec[0], { kind: "company", spec: { ...spec("KYC"), title: "{navn}" }, entity: { kind: "company", id: "CVR-1-99000002" } });
  assert.equal(shown.spec.title, "KYC (forberedt)");
  assert.equal(calls.render, 0);
  await backend.remove(first.id);
  assert.deepEqual(await backend.list("company"), []);
  await assert.rejects(backend.render(first.id, ID), (e: Error & { status?: number }) => e.status === 404);
});

test("Vejene: en logget ind bruger bruger serverens skabeloner uændret; Åben i Lasso for demobrugeren gemmer lokalt uden demobesked", async () => {
  const { api, calls } = fakeApi();
  const srv = serverTemplates(api);
  const saved = await srv.save({ kind: "company", title: "X", spec: spec("X"), entity: { kind: "company", id: ID } });
  assert.equal(saved.id, "srv-1");
  assert.equal(calls.save, 1);
  assert.equal(calls.prepare, 0);
  await srv.render("srv-1", ID);
  assert.equal(calls.render, 1);

  const s = memory();
  const local = localTemplates(api, s, "demo", () => 1, () => "local:abcdefabcdef");
  const view = { entity: { kind: "company" as const, id: ID }, spec: spec("Ejere"), title: "Ejere" };
  const r1 = await runViewLink({ kind: "company", id: ID, view: "abc" }, { visning: async () => view, saveTemplate: local.save });
  assert.equal(r1.tab, "tpl:local:abcdefabcdef");
  assert.equal(r1.notice, undefined);
  // Andet klik: samme modul (dublet i browseren), ingen besked.
  const r2 = await runViewLink({ kind: "company", id: ID, view: "abc" }, { visning: async () => view, saveTemplate: localTemplates(api, s, "demo", () => 2, () => "local:zzzzzzzzzzzz").save });
  assert.equal(r2.tab, "tpl:local:abcdefabcdef");
  assert.equal(r2.notice, undefined);
});
