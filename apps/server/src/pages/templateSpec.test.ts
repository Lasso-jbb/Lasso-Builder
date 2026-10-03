import assert from "node:assert/strict";
import { test } from "node:test";
import { viewSpecSchema, type ViewSpec } from "@lasso/spec";
import { ENTITY_PLACEHOLDER, NAME_REMAINS, distinctTitle, entityForms, hasPlaceholder, instantiate, stripEntityName, templateFromSpec, titleFallback } from "./templateSpec.js";
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

const silkeborg = { ...company, name: "Eksempel Byg A/S", city: "Silkeborg", street: "Prøvevej 1", cvr: "99000001" };
const kyc = { kind: "company" as const, id: "CVR-1-34580820", name: "LASSO X A/S", city: "Aarhus C", street: "Hack Kampmanns Plads 2", cvr: "34580820" };

test("stripEntityName: CVR (også formateret og med præfiks), Lasso-id, by og gade klippes; præposition og tegnsætning med", () => {
  assert.equal(stripEntityName("CVR 99000001, Silkeborg", silkeborg), "");
  assert.equal(stripEntityName("CVR-nr. 99000001", silkeborg), "");
  assert.equal(stripEntityName("Top for CVR 99000001", silkeborg), "Top");
  assert.equal(stripEntityName("Overblik 99 00 00 01", silkeborg), "Overblik");
  assert.equal(stripEntityName("Overblik 99000001", silkeborg), "Overblik");
  assert.equal(stripEntityName("Side om CVR-1-99000001", silkeborg), "Side");
  assert.equal(stripEntityName("Prøvevej 1, Silkeborg", silkeborg), "");
  // R4: præposition og tegn før det fjernede.
  assert.equal(stripEntityName("KYC-overblik for Eksempel Byg A/S", silkeborg), "KYC-overblik");
  assert.equal(stripEntityName("KYC-overblik over Eksempel Byg", silkeborg), "KYC-overblik");
  assert.equal(stripEntityName("Ejere af Eksempel Byg A/S –", silkeborg), "Ejere");
  assert.equal(stripEntityName("Status hos Eksempel Byg: ", silkeborg), "Status");
  assert.equal(stripEntityName("Noget om ejerne", silkeborg), "Noget om ejerne", "uden fjernelse røres titlen ikke");
  // Et andet 8-cifret tal og en anden by røres ikke.
  assert.equal(stripEntityName("Top 12345678 i Aarhus", silkeborg), "Top 12345678 i Aarhus");
});

test("templateFromSpec: designguidens KYC-mønster ('CVR …, genereret i dag kl. 09:52'); undertitlen gemmes ikke; metadata i tekst afvises", () => {
  const ranking = (title: string) => ({ type: "LassoRanking", companies: [kyc.id, "CVR-1-99000004"], title });
  const page = withParts({ title: "KYC-overblik for LASSO X A/S", subtitle: "CVR 34580820, genereret i dag kl. 09:52" }, [ranking("Størst")]);
  const ok = templateFromSpec(page, kyc) as { spec: ViewSpec };
  assert.ok(ok.spec, JSON.stringify(ok));
  assert.equal(ok.spec.title, "KYC-overblik");
  assert.equal(ok.spec.subtitle, undefined);
  // CVR, Lasso-id, by og gade i en anden tekst: afvist med den eksisterende fejl.
  for (const text of ["Top for CVR 34580820", "Top 34 58 08 20", "Aarhus C er størst", "Hack Kampmanns Plads 2", "Se CVR-1-34580820", "LASSO X A/S"]) {
    assert.deepEqual(templateFromSpec(withParts({}, [ranking(text)]), kyc), { error: NAME_REMAINS }, text);
  }
  // Et andet CVR-nummer og en anden by er fine.
  assert.ok("spec" in templateFromSpec(withParts({}, [ranking("Top for CVR 99000004 i Aalborg")]), kyc));
});

test("stripEntityName og templateFromSpec: postnummeret klippes og afvises; et andet firecifret tal røres ikke", () => {
  const e = { ...silkeborg, zip: "8600" };
  assert.equal(stripEntityName("Prøvevej 1, 8600 Silkeborg, CVR 99000001", e), "");
  assert.equal(stripEntityName("Overblik 8600", e), "Overblik");
  assert.equal(stripEntityName("Overblik 2024 og 86000", e), "Overblik 2024 og 86000");
  const ranking = (title: string) => ({ type: "LassoRanking", companies: [e.id, "CVR-1-99000004"], title });
  assert.deepEqual(templateFromSpec(withParts({}, [ranking("Postnr. 8600")]), e), { error: NAME_REMAINS });
  assert.ok("spec" in templateFromSpec(withParts({}, [ranking("Top 2024")]), e));
});

test("templateFromSpec: tom titel falder tilbage på undertitlen (fokusetiketten), men ikke på metadata; distinctTitle giver tillæg til modulnavne", () => {
  const spec1 = (extra: Record<string, unknown>) => withParts({ title: "Eksempel Byg A/S", ...extra }, body);
  assert.equal((templateFromSpec(spec1({ subtitle: "Ejerskab" }), silkeborg) as { spec: ViewSpec }).spec.title, "Ejerskab");
  assert.equal((templateFromSpec(spec1({ subtitle: "genereret i dag kl. 09:52" }), silkeborg) as { spec: ViewSpec }).spec.title, "Side", "et tal i undertitlen = metadata");
  assert.equal((templateFromSpec(spec1({ subtitle: "CVR 99000001, Silkeborg" }), silkeborg) as { spec: ViewSpec }).spec.title, "Side");
  assert.equal((templateFromSpec(spec1({}), silkeborg) as { spec: ViewSpec }).spec.title, "Side");
  assert.equal(titleFallback("", spec(body), "Ejerskab"), "Ejerskab");
  assert.equal(distinctTitle("Ejerskab", "company"), "Ejerskab, fra samtalen");
  assert.equal(distinctTitle(" regnskab ", "company"), "regnskab, fra samtalen");
  assert.equal(distinctTitle("Netværk", "person"), "Netværk, fra samtalen");
  assert.equal(distinctTitle("Netværk", "company"), "Netværk", "kun modulnavne for slagsen");
  assert.equal(distinctTitle("KYC-overblik", "company"), "KYC-overblik");
});
