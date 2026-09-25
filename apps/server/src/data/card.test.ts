import assert from "node:assert/strict";
import { test } from "node:test";
import { companyTemplate, emptyDataset, listTemplate, searchKey, searchQuerySchema, type Dataset } from "@lasso/spec";
import { textCard } from "./card.js";

// Opdigtede tal i samme form som Lassos rigtige svar.
const ID = "CVR-1-11111111";
function dataset(): Dataset {
  const ds = emptyDataset("live");
  ds.companies[ID] = {
    lassoId: ID,
    cvr: "11111111",
    name: "TESTFIRMA A/S",
    status: "Normal",
    statusKind: "active",
    form: "A/S",
    industryCode: "212000",
    industryText: "Fremstilling af farmaceutiske præparater",
    address: { street: "Testvej 1", zip: "2880", city: "Bagsværd", municipality: "Gladsaxe", region: "Hovedstaden" },
    founded: "1931-11-28",
    employees: 27279,
    phone: "44448888",
  };
  ds.financials[ID] = {
    lassoId: ID,
    currency: "DKK",
    years: [2023, 2024, 2025].map((year, i) => ({
      year,
      revenue: [232e9, 290e9, 309e9][i]!,
      grossProfit: [196e9, 245e9, 250e9][i]!,
      profit: [83e9, 101e9, -2e9][i]!,
      equity: [106e9, 143e9, 194e9][i]!,
      employees: [51046, 69480, 76343][i]!,
    })),
  };
  ds.people[ID] = [
    { name: "Anne Direktør", role: "Administrerende direktør", from: "2025-08-07" },
    { name: "Bo Formand", role: "Bestyrelsesformand", from: "2025-11-14" },
    { name: "Carla Medlem", role: "Bestyrelsesmedlem", from: "2020-01-01" },
    { name: "Dan Tidligere", role: "Bestyrelsesmedlem", from: "2010-01-01", to: "2020-01-01" },
  ];
  ds.ownership[ID] = {
    lassoId: ID,
    owners: [{ name: "Holding A/S", share: "25–33,32 %", votes: "66,67–89,99 %", kind: "company" }],
    auditor: { name: "DELOITTE STATSAUTORISERET REVISIONSPARTNERSELSKAB" },
  };
  return ds;
}

test("tekstkortet har samme bredde på alle linjer og alle sektioner", () => {
  const card = textCard(companyTemplate(ID, { chartMetric: "omsaetning", years: 10 }), dataset())!;
  const lines = card.split("\n");
  for (const l of lines) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  for (const part of ["TESTFIRMA A/S", "● Normal · A/S · Bagsværd", "STAMOPLYSNINGER", "CVR          11111111", "2880 Bagsværd", "präparater".replace("ä", "æ"), "28.11.1931", "27.279 (CVR)", "44 44 88 88", "Adm. dir.    Anne Direktør", "Formand      Bo Formand", "Bestyrelse   2 inkl. formand", "66,67–89,99 % stemmer", "REGNSKAB 2025 · ÆNDRING FRA 2024", "▲  6,6 %", "OMSÆTNING, MIA. KR.", "2025 ████████████████████   309,0"]) {
    assert.ok(card.includes(part), `mangler "${part}":\n${card}`);
  }
  // Negativt resultat får pil ned; fratrådte personer er ikke med.
  assert.match(card, /Resultat\s+-2 mia\.\s+▼/);
  assert.ok(!card.includes("Dan Tidligere"));
});

test("tekstkortet viser kun de valgte sektioner", () => {
  const card = textCard(companyTemplate(ID, { sections: ["header", "noegletal", "graf"] }), dataset())!;
  assert.ok(!card.includes("LEDELSE"));
  assert.ok(card.includes("BRUTTOFORTJENESTE, MIA. KR."));
});

test("tekstkort for en søgeliste", () => {
  const search = searchQuerySchema.parse({ query: "test", limit: 2, sort: { field: "omsaetning" } });
  const ds = emptyDataset("live");
  ds.searches[searchKey(search)] = {
    key: searchKey(search),
    total: 722,
    rows: [
      { lassoId: "CVR-1-1", name: "Et meget langt virksomhedsnavn til test ApS", city: "Aarhus C", revenue: 12_500_000 },
      { lassoId: "CVR-1-2", name: "Kort A/S", city: "Vejle", revenue: null },
    ],
  };
  const card = textCard(listTemplate(search, { title: "Søgning: test" }), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38);
  assert.ok(card.includes("722 virksomheder · viser 2"));
  assert.ok(card.includes("Aarhus C · 12,5 mio."));
  assert.ok(card.includes("NAVN · BY · OMSÆTNING"));
});

test("lange selskabsnavne forkortes og deles ved efterled", () => {
  const card = textCard(companyTemplate(ID), dataset())!;
  assert.ok(card.includes("Revisor      DELOITTE STATSAUT."), card);
  assert.ok(card.includes("             REVISIONSPARTNER-"), card);
  assert.ok(card.includes("             SELSKAB "), card);
});

test("uden omsætning i de seneste år viser kortet bruttofortjeneste, og linjerne holder bredden", () => {
  const ds = dataset();
  ds.financials[ID]!.years = [2018, 2019, 2024, 2025].map((year, i) => ({
    year,
    revenue: i < 2 ? 3_900_000 + i * 2_900_000 : null,
    grossProfit: [5e6, 7e6, 17.5e6, 18.8e6][i]!,
    profit: [1e5, 2e5, 113_000, -201_000][i]!,
    equity: 3.2e6,
    employees: 19,
  }));
  const card = textCard(companyTemplate(ID, { chartMetric: "omsaetning", years: 10 }), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  assert.ok(card.includes("BRUTTOFORTJENESTE, MIO. KR."), card);
  assert.ok(card.includes("2025 ████████████████████"), card);
  assert.match(card, /Bruttofortj\.\s+18,8 mio\./);
});
