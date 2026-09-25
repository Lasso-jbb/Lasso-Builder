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
  assert.deepEqual(found.alternatives.map((r) => r.cvr), ["10582989", "40220771", "38180045"]);
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
