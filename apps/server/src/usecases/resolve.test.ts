import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { DemoProvider } from "../data/demo.js";
import { candidatesAsText, narrowToQuery, personDescription, resolveEntity } from "./resolve.js";

const ctx = { provider: new DemoProvider(), config: loadConfig({ LASSO_DATA_SOURCE: "demo" }) };

test("resolveEntity: ét match, flere match og intet match", async () => {
  const one = await resolveEntity(ctx, { kind: "person", query: "Gitte Prøve" });
  assert.equal(one.length, 1);
  assert.deepEqual({ ...one[0], subtitle: "" }, { kind: "person", id: "CVR-3-4000000007", name: "Gitte Prøve", subtitle: "" });
  // Beskrivelsen skiller personer ad: rolle, alder, by, antal selskaber og ét selskabsnavn.
  assert.match(one[0]!.subtitle, /^Direktør og ejer, \d+ år, Aalborg\. 1 selskab, bl\.a\. Eksempel Revision Nord ApS\.$/);

  const many = await resolveEntity(ctx, { kind: "person", query: "Prøve" });
  assert.equal(many.length, 5, "standard højst 5");
  assert.equal((await resolveEntity(ctx, { kind: "person", query: "Prøve", limit: 50 })).length, 10, "højst 10");

  assert.deepEqual(await resolveEntity(ctx, { kind: "company", query: "Findes Ikke Overhovedet" }), []);
  assert.match(candidatesAsText("company", "Findes Ikke", []), /Ingen virksomheder matcher/);
});

test("resolveEntity: virksomheder får by, CVR og status; et id slås op direkte", async () => {
  const rev = await resolveEntity(ctx, { kind: "company", query: "Eksempel Revision" });
  assert.ok(rev.length >= 2);
  assert.equal(rev[0]!.subtitle, "Aarhus C, CVR 99000002, Aktiv");
  const byId = await resolveEntity(ctx, { kind: "company", query: "99000001" });
  assert.deepEqual(byId.map((c) => c.name), ["Eksempel Byg A/S"]);
  assert.match(candidatesAsText("company", "Eksempel Revision", rev), /^2 virksomheder for "Eksempel Revision" \(id \| navn \| detaljer\):\nCVR-1-99000002 \| Eksempel Revision Midt ApS \| Aarhus C, CVR 99000002, Aktiv/);
});

test("resolveEntity: en åben fane med navnet står først som præcist match, uden dublet fra søgningen", async () => {
  const open = [
    { kind: "person" as const, id: "CVR-3-4000000007", name: "Gitte Prøve" },
    { kind: "company" as const, id: "CVR-1-34580820", name: "LASSO X A/S" },
  ];
  const gitte = await resolveEntity(ctx, { kind: "person", query: "Gitte" }, open);
  assert.equal(gitte[0]!.id, "CVR-3-4000000007");
  assert.equal(gitte[0]!.subtitle, "åben fane");
  assert.equal(gitte.filter((c) => c.id === "CVR-3-4000000007").length, 1);
  // Et firma, demodata ikke kender, findes alligevel, fordi fanen er åben.
  const lasso = await resolveEntity(ctx, { kind: "company", query: "Lasso X" }, open);
  assert.deepEqual(lasso.map((c) => c.id), ["CVR-1-34580820"]);
  // Fanens type skal passe: en person-fane matcher ikke et virksomhedsopslag.
  assert.equal((await resolveEntity(ctx, { kind: "company", query: "Gitte Prøve" }, open)).length, 0);
});

test("personDescription: felter, der mangler, udelades; to personer med samme navn får hver sin beskrivelse", async () => {
  const role = (companyName: string, r: string, active = true) => ({ companyName, kind: "director" as const, role: r, active });
  const p = { lassoId: "CVR-3-1", name: "Jakob Benediktson", city: "Kgs. Lyngby", birthYear: 1979, roles: [role("Benediktson Holding ApS", "Direktør"), role("Anden ApS", "Medejer"), role("Gammel ApS", "Bestyrelsesmedlem", false)] };
  assert.equal(personDescription(p as never, "", 2026), "Direktør og medejer, 47 år, Kgs. Lyngby. 2 selskaber, bl.a. Benediktson Holding ApS.");
  assert.equal(personDescription({ lassoId: "CVR-3-2", name: "X", roles: [] } as never, "Aarhus"), "Aarhus.");
  assert.equal(personDescription({ lassoId: "CVR-3-2", name: "X", city: "Odense", roles: [role("Y ApS", "Direktør")] } as never), "Direktør, Odense. 1 selskab, bl.a. Y ApS.");
  // Flere personer med navnet Prøve: hver sin kandidat med eget id og egen beskrivelse, aldrig slået sammen.
  const many = await resolveEntity(ctx, { kind: "person", query: "Prøve", limit: 5 });
  assert.equal(new Set(many.map((c) => c.id)).size, many.length);
  assert.ok(many.length >= 2);
  assert.ok(many.every((c) => c.subtitle.length > 0 && !/flere personer/i.test(c.subtitle)));
});

test("R: et præcist fulde navn giver ét match; kandidater, der mangler et ord, listes ikke; flere med samme fulde navn giver stadig en menu", () => {
  const cand = (id: string, name: string) => ({ kind: "person" as const, id, name, subtitle: "" });
  const rows = [cand("CVR-3-1", "Jakob Bech"), cand("CVR-3-2", "Jakob Bech Benediktson"), cand("CVR-3-3", "Jakob Bech Jensen")];
  assert.deepEqual(narrowToQuery(rows, "person", "Jakob Bech Benediktson").map((c) => c.id), ["CVR-3-2"]);
  // Med to navneord kan et længere navn være ment: det præcise står først, de længere efter (dem uden et ord udgår stadig).
  assert.deepEqual(narrowToQuery(rows, "person", "Jakob Bech").map((c) => c.id), ["CVR-3-1", "CVR-3-2", "CVR-3-3"]);
  assert.deepEqual(narrowToQuery([rows[1]!, rows[0]!, rows[2]!], "person", "Jakob Bech").map((c) => c.id), ["CVR-3-1", "CVR-3-2", "CVR-3-3"], "den præcise først, uanset rækkefølge");
  assert.deepEqual(narrowToQuery([rows[0]!, cand("CVR-3-8", "Jakob Berg")], "person", "Jakob Bech").map((c) => c.id), ["CVR-3-1"], "uden et ord udgår");
  assert.deepEqual(narrowToQuery([cand("CVR-3-9", "Ole"), cand("CVR-3-10", "Ole Berg")], "person", "Ole").map((c) => c.id), ["CVR-3-9", "CVR-3-10"], "ét ord: præcis først");
  // Mangler et ord, og én indeholder dem alle: de andre udgår (også uden et præcist match).
  const more = [...rows, cand("CVR-3-4", "Jakob Bech Benediktson Holm")];
  assert.deepEqual(narrowToQuery(more, "person", "Jakob Bech Benediktson").map((c) => c.id), ["CVR-3-2"], "præcist match vinder over længere navne");
  assert.deepEqual(narrowToQuery([rows[0]!, rows[1]!, cand("CVR-3-4", "Jakob Bech Benediktson Holm")], "person", "Bech Benediktson").map((c) => c.id), ["CVR-3-2", "CVR-3-4"], "ingen præcis: alle der indeholder ordene");
  // Flere med samme fulde navn: alle præcise bliver (menu), de andre udgår.
  const twins = [cand("CVR-3-5", "Mette Holm"), cand("CVR-3-6", "Mette Holm"), cand("CVR-3-7", "Mette Holm Jensen")];
  assert.deepEqual(narrowToQuery(twins, "person", "Mette Holm").map((c) => c.id), ["CVR-3-5", "CVR-3-6", "CVR-3-7"]);
  assert.deepEqual(narrowToQuery(twins, "person", "Mette Holm Jensen").map((c) => c.id), ["CVR-3-7"]);
  const triples = [cand("CVR-3-11", "Mette Holm Jensen"), cand("CVR-3-12", "Mette Holm Jensen"), cand("CVR-3-13", "Mette Holm Jensen Berg")];
  assert.deepEqual(narrowToQuery(triples, "person", "Mette Holm Jensen").map((c) => c.id), ["CVR-3-11", "CVR-3-12"], "tre ord: kun de identiske, så menu"); 
  // Ingen indeholder alle ordene: uændret (modellen/menuen vælger). Id'er røres ikke.
  assert.equal(narrowToQuery(rows, "person", "Anne Kjær").length, 3);
  assert.equal(narrowToQuery(rows, "person", "CVR-3-1").length, 3);
  // Virksomheder: selskabsformen ses der bort fra.
  const co = (id: string, name: string) => ({ kind: "company" as const, id, name, subtitle: "" });
  assert.deepEqual(narrowToQuery([co("CVR-1-1", "Eksempel Byg A/S"), co("CVR-1-2", "Eksempel Byg Syd ApS")], "company", "Eksempel Byg ApS").map((c) => c.id), ["CVR-1-1", "CVR-1-2"], "to ord: præcis først, længere efter");
  assert.deepEqual(narrowToQuery([co("CVR-1-1", "Eksempel Byg Nord A/S"), co("CVR-1-2", "Eksempel Byg Nord Syd ApS")], "company", "Eksempel Byg Nord ApS").map((c) => c.id), ["CVR-1-1"]);
});

test("R: resolveEntity giver ét præcist match for et fuldt navn (demo: Gitte Prøve), og find_entity-teksten har én kandidat", async () => {
  const one = await resolveEntity(ctx, { kind: "person", query: "Gitte Prøve", limit: 5 });
  assert.equal(one.length, 1);
  assert.match(candidatesAsText("person", "Gitte Prøve", one), /^1 person for "Gitte Prøve"/);
  // Et efternavn alene har flere.
  assert.ok((await resolveEntity(ctx, { kind: "person", query: "Prøve", limit: 5 })).length >= 2);
});

test("personDescription: stifter og revisor er ikke roller i beskrivelsen (samme udvalg som netværket); andre roller står som egne ord", () => {
  const role = (companyName: string, r: string, kind: "founder" | "direction" | "owner" | "board" | "other" = "other", active = true) => ({ companyName, kind, role: r, active });
  const p = { lassoId: "CVR-3-1", name: "X", city: "Odense", birthYear: 1980, roles: [role("A ApS", "Stifter", "founder"), role("B ApS", "Revisor"), role("C ApS", "Adm. direktør", "direction"), role("D ApS", "Interessent")] };
  assert.equal(personDescription(p as never, "", 2026), "Adm. direktør og interessent, 46 år, Odense. 4 selskaber, bl.a. A ApS.");
  assert.doesNotMatch(personDescription(p as never, "", 2026), /[Ss]tifter|[Rr]evisor/);
  const onlyFounder = { ...p, roles: [role("A ApS", "Stifter", "founder")] };
  assert.equal(personDescription(onlyFounder as never, "", 2026), "46 år, Odense. 1 selskab, bl.a. A ApS.");
});
