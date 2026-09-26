import assert from "node:assert/strict";
import { test } from "node:test";
import type { CompanyRowVM } from "@lasso/spec";
import { findCompany, isCompanyRef, normalizeCompanyName, pickCompany } from "./lookup.js";
import type { DataProvider } from "./provider.js";

const row = (name: string, cvr: string, statusKind: CompanyRowVM["statusKind"] = "active"): CompanyRowVM => ({ lassoId: `CVR-1-${cvr}`, cvr, name, statusKind });

test("normalizeCompanyName fjerner selskabsform og tegn", () => {
  assert.equal(normalizeCompanyName("NOVO NORDISK A/S"), "novo nordisk");
  assert.equal(normalizeCompanyName("Eksempel Byg ApS."), "eksempel byg");
  assert.equal(normalizeCompanyName("Novo Nordisk Fonden"), "novo nordisk fonden");
});

test("pickCompany foretrækker præcist navn frem for Lassos rækkefølge", () => {
  // Rækkefølgen, Lasso gav for "Novo Nordisk" 25.09.2026 (A/S'en var ikke i top 5).
  const rows = [
    row("NOVO NORDISK FONDEN", "10582989"),
    row("Novo Nordisk Kunstforening", "40220771"),
    row("Novo Nordisk Denmark A/S", "38180045"),
    row("NOVO NORDISK A/S", "24256790"),
  ];
  const found = pickCompany("Novo Nordisk", rows)!;
  assert.equal(found.pick.cvr, "24256790");
  // Blandt alternativerne står selskabet (A/S) før fonden og foreningen.
  assert.deepEqual(found.alternatives.map((r) => r.cvr), ["38180045", "10582989", "40220771"]);
});

test("pickCompany tager aktive før ophørte og ellers Lassos rækkefølge", () => {
  const found = pickCompany("Tømrer Hansen", [row("Tømrer Hansen ApS", "11111111", "inactive"), row("Tømrer Hansen A/S", "22222222")])!;
  assert.equal(found.pick.cvr, "22222222");
  assert.equal(pickCompany("x", []), null);
});

test("isCompanyRef skelner CVR og Lasso-ID fra navne", () => {
  assert.ok(isCompanyRef("24256790"));
  assert.ok(isCompanyRef("2425 6790"));
  assert.ok(isCompanyRef("CVR-1-24256790"));
  assert.ok(!isCompanyRef("Novo Nordisk"));
  assert.ok(!isCompanyRef("3F"));
});

test("findCompany søger også med selskabsform, når Lasso ikke har selskabet i toppen", async () => {
  const calls: string[] = [];
  const provider = {
    async findCompanies(name: string) {
      calls.push(name);
      return name === "Novo Nordisk A/S"
        ? [row("NOVO NORDISK A/S", "24256790"), row("NOVO NORDISK FONDEN", "10582989")]
        : [row("Novo Nordisk Akademikerforening", "40539050"), row("NOVO NORDISK FONDEN", "10582989")];
    },
  } as unknown as DataProvider;
  const found = (await findCompany(provider, "Novo Nordisk"))!;
  assert.equal(found.pick.cvr, "24256790");
  assert.deepEqual(calls, ["Novo Nordisk", "Novo Nordisk A/S"]);
  assert.deepEqual(found.alternatives.map((r) => r.cvr), ["40539050", "10582989"]);
});

test("pickCompany: selskab med selskabsform vinder over forening med præcis samme navn (Danske Bank)", () => {
  // Rækkefølgen fra Lasso 26.09.2026: foreningen "Danske Bank" (Odense, 3 ansatte) først.
  const rows = [
    { ...row("Danske Bank", "23569914"), employees: 3 },
    { ...row("DANSKE BANK A/S", "61126228"), employees: 21000 },
    { ...row("Danske Bank Pensionistforening", "11111111"), employees: 0 },
  ];
  const found = pickCompany("Danske Bank", rows)!;
  assert.equal(found.pick.cvr, "61126228");
  assert.equal(found.alternatives[0]!.cvr, "23569914");
});

test("pickCompany: ved samme navn og form vinder flest ansatte, derefter bruttofortjeneste", () => {
  const a = pickCompany("Hansen Byg", [
    { ...row("Hansen Byg ApS", "11111111"), employees: 2 },
    { ...row("HANSEN BYG A/S", "22222222"), employees: 40 },
  ])!;
  assert.equal(a.pick.cvr, "22222222");
  const b = pickCompany("Hansen Byg", [
    { ...row("Hansen Byg ApS", "11111111"), grossProfit: 1_000_000 },
    { ...row("HANSEN BYG A/S", "22222222"), grossProfit: 9_000_000 },
  ])!;
  assert.equal(b.pick.cvr, "22222222");
});

test("pickCompany: konkursramte og ophørte kommer efter aktive", () => {
  const found = pickCompany("Tiga", [row("TIGA ApS", "10048702", "warning"), row("Tiga A/S", "33333333")])!;
  assert.equal(found.pick.cvr, "33333333");
});

test("findCompany søger med selskabsform, når det præcise navn kun er en forening", async () => {
  const calls: string[] = [];
  const provider = {
    async findCompanies(name: string) {
      calls.push(name);
      return name === "Danske Bank A/S" ? [{ ...row("DANSKE BANK A/S", "61126228"), employees: 21000 }] : [{ ...row("Danske Bank", "23569914"), employees: 3 }];
    },
  } as unknown as DataProvider;
  const found = (await findCompany(provider, "Danske Bank"))!;
  assert.equal(found.pick.cvr, "61126228");
  assert.deepEqual(calls, ["Danske Bank", "Danske Bank A/S"]);
});
