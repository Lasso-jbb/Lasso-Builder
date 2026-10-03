import assert from "node:assert/strict";
import { test } from "node:test";
import { viewSpecSchema, type ViewSpec } from "@lasso/spec";
import { ENTITY_PLACEHOLDER, NAME_REMAINS, entityForms, hasPlaceholder, instantiate, stripEntityName, templateFromSpec, titleFallback } from "./templateSpec.js";
import { MemoryPageTemplateStore, MAX_SPEC_BYTES, MAX_TEMPLATES, PageTemplateError } from "./templates.js";

const company = { kind: "company" as const, id: "CVR-1-99000001" };
const person = { kind: "person" as const, id: "CVR-3-4000000007" };

const spec = (components: unknown[]): ViewSpec => ({ version: 2, kind: "custom", title: "KYC-overblik", layout: "dashboard", criteria: [], components }) as unknown as ViewSpec;

test("entityForms: Lasso-ID, og for en virksomhed også CVR-nummeret", () => {
  assert.deepEqual(entityForms(company), ["CVR-1-99000001", "99000001"]);
  assert.deepEqual(entityForms(person), ["CVR-3-4000000007"]);
});

test("templateFromSpec: id og CVR-nummer bliver {{entity}}; andre virksomheder (benchmark) og tekst røres ikke", () => {
  const s = spec([
    { type: "LassoCompanyHistory", company: "CVR-1-99000001" },
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
  const other = spec([{ type: "LassoCompanyHistory", company: "CVR-1-99000004" }]);
  assert.deepEqual(templateFromSpec(other, company), { error: "Siden handler ikke om én virksomhed." });
  assert.deepEqual(templateFromSpec(other, person), { error: "Siden handler ikke om én person." });
  assert.match((templateFromSpec({ title: "x" }, company) as { error: string }).error, /Specen er ugyldig/);
  // En persons id findes ikke som virksomhed.
  assert.ok("error" in templateFromSpec(spec([{ type: "LassoPersonStats", person: person.id }]), company));
  assert.ok("spec" in templateFromSpec(spec([{ type: "LassoPersonStats", person: person.id }]), person));
});

test("instantiate: {{entity}} bliver Lasso-ID'et overalt; skabelonen ændres ikke; rundtur giver den oprindelige spec", () => {
  const s = spec([
    { type: "LassoCompanyHistory", company: "CVR-1-99000001" },
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
  const s = (templateFromSpec(spec([{ type: "LassoCompanyHistory", company: company.id }]), company) as { spec: ViewSpec }).spec;
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
  await assert.rejects(store.create({ ...base, spec: spec([{ type: "LassoCompanyHistory", company: "CVR-1-99000001" }]) }), /ikke bundet/);
  await assert.rejects(store.create({ ...base, kind: "firma" as never }), PageTemplateError);
  for (let i = 0; i < MAX_TEMPLATES; i++) await store.create({ ...base, userId: "max" });
  await assert.rejects(store.create({ ...base, userId: "max" }), /højst/);
});

const named = { ...company, name: "Eksempel Byg A/S" };
const withParts = (extra: Record<string, unknown>, components: unknown[]) => ({ ...spec(components), ...extra }) as unknown as ViewSpec;
const body = [{ type: "LassoKeyFigureCards", company: company.id }];

test("templateFromSpec: hoved og opfølgende spørgsmål tages ikke med; en side kun med hoved afvises", () => {
  const s = spec([{ type: "LassoCompanyHead", company: company.id }, ...body, { type: "LassoFollowUps", prompts: [{ label: "Ejere", prompt: "Hvem ejer Eksempel Byg A/S?" }] }]);
  const r = templateFromSpec(s, named);
  assert.ok("spec" in r, "error" in r ? r.error : "");
  assert.deepEqual(r.spec.components.map((c) => c.type), ["LassoKeyFigureCards"]);
  const p = templateFromSpec(spec([{ type: "LassoPersonHead", person: person.id }]), { ...person, name: "Gitte Prøve" });
  assert.match((p as { error: string }).error, /kun af entitetens hoved/);
});

test("stripEntityName: efterstillet ', Navn' og ' – Navn', selve navnet, selskabsformer, store/små bogstaver", () => {
  const n = "Eksempel Byg A/S";
  assert.equal(stripEntityName("Nøgletal, Eksempel Byg A/S", n), "Nøgletal");
  assert.equal(stripEntityName("Nøgletal – eksempel byg", n), "Nøgletal");
  assert.equal(stripEntityName("Nøgletal - EKSEMPEL BYG APS", "Eksempel Byg ApS"), "Nøgletal");
  assert.equal(stripEntityName("Eksempel Byg A/S", n), "");
  assert.equal(stripEntityName("Eksempel Byg", n), "");
  assert.equal(stripEntityName("Ejere i Eksempel Byg A/S i dag", n), "Ejere i i dag");
  assert.equal(stripEntityName("Nøgletal", n), "Nøgletal");
  assert.equal(stripEntityName("Nøgletal, Eksempel Byg A/S", undefined), "Nøgletal, Eksempel Byg A/S");
});

test("templateFromSpec: navnet fjernes fra titel og undertitel; står det stadig et sted, afvises siden", () => {
  const ok = templateFromSpec(withParts({ title: "KYC, Eksempel Byg A/S", subtitle: "Eksempel Byg" }, body), named) as { spec: ViewSpec };
  assert.equal(ok.spec.title, "KYC");
  assert.equal(ok.spec.subtitle, undefined);
  // Titlen bliver tom: første komponents titel, ellers "Side".
  const empty = templateFromSpec(withParts({ title: "Eksempel Byg A/S" }, body), named) as { spec: ViewSpec };
  assert.equal(empty.spec.title, "Side");
  const titled = templateFromSpec(withParts({ title: "Eksempel Byg A/S" }, [{ type: "LassoRanking", companies: [company.id, "CVR-1-99000004"], title: "Nøgletal" }]), named) as { spec: ViewSpec };
  assert.equal(titled.spec.title, "Nøgletal");
  // Navnet i en komponents tekst: afvist (også uden selskabsformen).
  for (const text of ["Her er Eksempel Byg A/S", "Eksempel Byg har 64 ansatte", "eksempel byg"]) {
    const r = templateFromSpec(spec([{ type: "LassoRanking", companies: [company.id, "CVR-1-99000004"], title: text }]), named);
    assert.deepEqual(r, { error: NAME_REMAINS }, text);
  }
  // Et andet navn, der kun ligner, røres ikke.
  assert.ok("spec" in templateFromSpec(spec([{ type: "LassoRanking", companies: [company.id, "CVR-1-99000004"], title: "Eksempel Byggeri" }]), named));
  assert.equal(titleFallback("", spec(body)), "Side");
  assert.equal(titleFallback("Min", spec(body)), "Min");
});

test("MemoryPageTemplateStore: grænsen holder ved samtidige kald, og specens størrelse måles i bytes", async () => {
  const store = new MemoryPageTemplateStore();
  const s = (templateFromSpec(spec(body), company) as { spec: ViewSpec }).spec;
  const input = { org: "lasso", userId: "race", kind: "company" as const, title: "T", spec: s };
  const results = await Promise.allSettled(Array.from({ length: MAX_TEMPLATES + 10 }, () => store.create(input)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, MAX_TEMPLATES);
  assert.equal((await store.list("lasso", "race")).length, MAX_TEMPLATES);
  // 'ø' er 2 bytes: færre tegn end grænsen, men flere bytes.
  const pad = "ø".repeat(Math.ceil(MAX_SPEC_BYTES * 0.6));
  const big = { ...s, components: [{ ...s.components[0]!, title: pad }] } as unknown as ViewSpec;
  assert.ok(JSON.stringify(big).length < MAX_SPEC_BYTES && Buffer.byteLength(JSON.stringify(big)) > MAX_SPEC_BYTES);
  await assert.rejects(store.create({ ...input, userId: "bytes", spec: { ...big, components: [{ ...big.components[0]!, company: ENTITY_PLACEHOLDER }] } as unknown as ViewSpec }), /for stor/);
});
