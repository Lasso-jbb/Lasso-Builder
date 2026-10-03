import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDataset, type Dataset, type ViewSpec } from "@lasso/spec";
import { summarizeView } from "./summary.js";

const ID = "CVR-1-22222222";
const spec = (components: unknown[]): ViewSpec => ({ version: 2, kind: "company", title: "T", layout: "dashboard", criteria: [], components }) as unknown as ViewSpec;

function dataset(): Dataset {
  const ds = emptyDataset("live");
  ds.companies[ID] = { lassoId: ID, cvr: "22222222", name: "TESTFIRMA A/S", status: "Normal", statusKind: "active" } as never;
  ds.companyHistories[ID] = {
    lassoId: ID,
    source: "history",
    fields: [],
    relations: [
      { group: "direktion", name: "Mette Holm", role: "Adm. dir", current: true },
      { group: "bestyrelse", name: "Ole Berg", role: "Formand", current: true },
      { group: "bestyrelse", name: "Pia Dal", current: true },
      { group: "bestyrelse", name: "Gammel Person", current: false },
    ],
  };
  ds.ownership[ID] = { lassoId: ID, owners: [], auditor: { name: "Revisor Nord ApS" } } as never;
  ds.timeline[ID] = { lassoId: ID, events: [1, 2, 3].map((n) => ({ date: `2025-0${n}-01`, title: `Begivenhed ${n}`, category: "status" })) };
  ds.news[ID] = { lassoId: ID, items: [1, 2, 3].map((n) => ({ source: "Lasso News", headline: `Nyhed ${n}`, time: `2025-0${n}-05T10:00:00` })) } as never;
  ds.valuations = { [ID]: { lassoId: ID, state: "unavailable", reason: "HTTP 404" } } as never;
  return ds;
}

const comps = [{ type: "LassoRelations", company: ID }, { type: "LassoKeyValueList", company: ID }, { type: "LassoTimeline", company: ID }, { type: "LassoNews", company: ID }];

test("chat-resumé: direktion og bestyrelse (kun nuværende), revisor, de to seneste begivenheder og nyheder; højst ca. 160 tegn pr. linje", () => {
  const text = summarizeView(spec(comps), dataset(), { host: "chat" });
  assert.match(text, /Relationer: direktion Mette Holm \(Adm\. dir\); bestyrelse Ole Berg \(Formand\), Pia Dal\./);
  assert.doesNotMatch(text, /Gammel Person/);
  assert.match(text, /Revisor: Revisor Nord ApS\./);
  assert.match(text, /Historik \(seneste 2 af 3\): .*Begivenhed 1; .*Begivenhed 2\./);
  assert.doesNotMatch(text, /Begivenhed 3/);
  assert.match(text, /Nyheder \(seneste 2\): .*Nyhed 1; .*Nyhed 2\./);
  assert.doesNotMatch(text, /Nyhed 3/);
  const extra = text.split("\n").filter((l) => /^(Relationer|Revisor|Historik|Nyheder)/.test(l));
  assert.equal(extra.length, 4);
  assert.ok(extra.every((l) => l.length <= 160), extra.join("|"));
  assert.ok(extra.join("\n").length <= 400);
  // Fejlsøgningslinjen udgår for chatten.
  assert.doesNotMatch(text, /Ikke vist:/);
});

test("mcp-resumé: uændret (ingen ekstralinjer; 'Ikke vist' står stadig)", () => {
  const text = summarizeView(spec(comps), dataset(), { host: "mcp" });
  assert.doesNotMatch(text, /Relationer:|Revisor:|Historik \(|Nyheder \(/);
  assert.match(text, /Ikke vist: værdiansættelse: HTTP 404/);
});

test("chat-resumé: revisor gentages ikke, når ejerlisten allerede har den; lange relationer afkortes", () => {
  const ds = dataset();
  ds.companyHistories[ID]!.relations = Array.from({ length: 8 }, (_, i) => ({ group: "bestyrelse" as const, name: `Bestyrelsesmedlem Med Et Langt Navn ${i}`, current: true }));
  const text = summarizeView(spec([{ type: "LassoOwnerList", company: ID }, { type: "LassoRelations", company: ID }, { type: "LassoKeyValueList", company: ID }]), ds, { host: "chat" });
  assert.equal(text.split("\n").filter((l) => l.startsWith("Revisor: ")).length, 1);
  const rel = text.split("\n").find((l) => l.startsWith("Relationer: "))!;
  assert.ok(rel.length <= 160 && rel.endsWith("…"));
});
