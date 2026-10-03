import assert from "node:assert/strict";
import { test } from "node:test";
import { viewSpecSchema, type ViewSpec } from "@lasso/spec";
import { ENTITY_PLACEHOLDER, entityForms, hasPlaceholder, instantiate, templateFromSpec } from "./templateSpec.js";
import { MemoryPageTemplateStore, MAX_TEMPLATES, PageTemplateError } from "./templates.js";

const company = { kind: "company" as const, id: "CVR-1-99000001" };
const person = { kind: "person" as const, id: "CVR-3-4000000007" };

const spec = (components: unknown[]): ViewSpec => ({ version: 2, kind: "custom", title: "KYC-overblik", layout: "dashboard", criteria: [], components }) as unknown as ViewSpec;

test("entityForms: Lasso-ID, og for en virksomhed også CVR-nummeret", () => {
  assert.deepEqual(entityForms(company), ["CVR-1-99000001", "99000001"]);
  assert.deepEqual(entityForms(person), ["CVR-3-4000000007"]);
});

test("templateFromSpec: id og CVR-nummer bliver {{entity}}; andre virksomheder (benchmark) og tekst røres ikke", () => {
  const s = spec([
    { type: "LassoCompanyHead", company: "CVR-1-99000001" },
    { type: "LassoKeyFigureCards", company: "99000001" },
    { type: "LassoRanking", companies: ["CVR-1-99000001", "CVR-1-99000004"] },
    { type: "LassoLineChart", company: "CVR-1-99000001", benchmark: "CVR-1-99000004" },
  ]);
  const r = templateFromSpec(s, company);
  assert.ok("spec" in r, "error" in r ? r.error : "");
  const comps = r.spec.components as unknown as Record<string, unknown>[];
  assert.equal(comps[0]!.company, ENTITY_PLACEHOLDER);
  assert.equal(comps[1]!.company, ENTITY_PLACEHOLDER);
  assert.deepEqual(comps[2]!.companies, [ENTITY_PLACEHOLDER, "CVR-1-99000004"]);
  assert.equal(comps[3]!.benchmark, "CVR-1-99000004");
  assert.equal(r.spec.title, "KYC-overblik");
  assert.ok(hasPlaceholder(r.spec));
  assert.ok(!hasPlaceholder(s));
});

test("templateFromSpec: ingen forekomst giver en fejl; en ugyldig spec også", () => {
  const other = spec([{ type: "LassoCompanyHead", company: "CVR-1-99000004" }]);
  assert.deepEqual(templateFromSpec(other, company), { error: "Siden handler ikke om én virksomhed." });
  assert.deepEqual(templateFromSpec(other, person), { error: "Siden handler ikke om én person." });
  assert.match((templateFromSpec({ title: "x" }, company) as { error: string }).error, /Specen er ugyldig/);
  // En persons id findes ikke som virksomhed.
  assert.ok("error" in templateFromSpec(spec([{ type: "LassoPersonHead", person: person.id }]), company));
  assert.ok("spec" in templateFromSpec(spec([{ type: "LassoPersonHead", person: person.id }]), person));
});

test("instantiate: {{entity}} bliver Lasso-ID'et overalt; skabelonen ændres ikke; rundtur giver den oprindelige spec", () => {
  const s = spec([
    { type: "LassoCompanyHead", company: "CVR-1-99000001" },
    { type: "LassoRanking", companies: ["CVR-1-99000001", "CVR-1-99000004"] },
  ]);
  const t = (templateFromSpec(s, company) as { spec: ViewSpec }).spec;
  const before = JSON.stringify(t);
  const other = instantiate(t, "CVR-1-99000002");
  assert.equal(JSON.stringify(t), before);
  const comps = other.components as unknown as Record<string, unknown>[];
  assert.equal(comps[0]!.company, "CVR-1-99000002");
  assert.deepEqual(comps[1]!.companies, ["CVR-1-99000002", "CVR-1-99000004"]);
  assert.ok(!hasPlaceholder(other));
  assert.deepEqual(instantiate(t, company.id), viewSpecSchema.parse(s));
});

test("MemoryPageTemplateStore: pr. bruger, slags og org; fjern er kun brugerens egen; grænser og validering", async () => {
  const store = new MemoryPageTemplateStore();
  const s = (templateFromSpec(spec([{ type: "LassoCompanyHead", company: company.id }]), company) as { spec: ViewSpec }).spec;
  const base = { org: "lasso", userId: "pia", kind: "company" as const, title: "KYC", spec: s };
  const a = await store.create(base);
  const b = await store.create({ ...base, title: "Ejere", subtitle: "Kort" });
  await store.create({ ...base, userId: "ole", title: "Oles" });
  assert.deepEqual((await store.list("lasso", "pia")).map((t) => t.title), ["KYC", "Ejere"]);
  assert.equal((await store.list("lasso", "pia", "person")).length, 0);
  assert.equal((await store.list("lasso", "ole")).length, 1);
  assert.equal(await store.get("lasso", "ole", a.id), null, "en andens id");
  assert.equal(await store.remove("lasso", "ole", a.id), false);
  assert.equal(await store.remove("andenorg", "pia", a.id), false);
  assert.equal(await store.remove("lasso", "pia", a.id), true);
  assert.equal(await store.remove("lasso", "pia", a.id), false, "allerede væk");
  assert.deepEqual((await store.list("lasso", "pia")).map((t) => t.id), [b.id]);
  // Validering: titel, pladsholder, slags.
  await assert.rejects(store.create({ ...base, title: "  " }), PageTemplateError);
  await assert.rejects(store.create({ ...base, spec: spec([{ type: "LassoCompanyHead", company: "CVR-1-99000001" }]) }), /ikke bundet/);
  await assert.rejects(store.create({ ...base, kind: "firma" as never }), PageTemplateError);
  for (let i = 0; i < MAX_TEMPLATES; i++) await store.create({ ...base, userId: "max" });
  await assert.rejects(store.create({ ...base, userId: "max" }), /højst/);
});
