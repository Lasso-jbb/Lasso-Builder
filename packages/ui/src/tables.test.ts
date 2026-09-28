import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompanyRowVM, PersonSearchResultVM, SearchResultVM } from "@lasso/spec";
import { CompanyTable, cardFigures, statusTone } from "./components/CompanyTable.js";
import { PersonTable, personSub, rolesText } from "./components/PersonTable.js";
import { BulkBar, Pagination, pageItems } from "./components/TableKit.js";
import { rowsToCsv } from "./csv.js";

const noop = () => {};
const rows: CompanyRowVM[] = Array.from({ length: 30 }, (_, i) => ({
  lassoId: `CVR-1-${10000000 + i}`,
  cvr: String(10000000 + i),
  name: `Eksempel ${i} ApS`,
  city: "Aarhus C",
  status: i === 1 ? "Under konkurs" : i === 2 ? "Under likvidation" : i === 3 ? "Ophørt" : "Aktiv",
  statusKind: i === 1 || i === 2 ? "warning" : i === 3 ? "inactive" : "active",
  employees: i === 4 ? null : i,
  grossProfit: 1_000_000 * (30 - i),
  score: i === 0 ? 42 : undefined,
}));
const result: SearchResultVM = { key: "k", total: 1243, rows };

test("Virksomhedstabel (15.1): værktøjslinje, afkrydsning, 25 rækker og paginering", () => {
  const html = renderToStaticMarkup(
    createElement(CompanyTable, { result, columns: ["navn", "status", "ansatte"], onAction: noop, canDrillDown: true, canExport: true, criteria: [{ field: "region", operator: "eq", value: "Region Midtjylland" }], onApplyCriteria: noop }),
  );
  assert.match(html, /role="toolbar"/);
  assert.match(html, /Søg i resultatet/);
  assert.match(html, /Filtre \(1\)/);
  assert.match(html, /Kolonner/);
  assert.match(html, /Eksportér/);
  assert.equal((html.match(/<tr[^>]*data-clickable/g) ?? []).length, 25);
  assert.match(html, /Viser 1–25 af 1\.243 virksomheder/);
  assert.match(html, /class="lasso-pager__page is-on" aria-current="page">1</);
  // Status som ren tekst med tone, aldrig pille
  assert.match(html, /lasso-status--warning">Under konkurs/);
  assert.match(html, /lasso-status--liquidation">Under likvidation/);
  assert.match(html, /lasso-status--inactive">Ophørt/);
  assert.match(html, /Ikke oplyst/);
  assert.match(html, /type="checkbox"[^>]*aria-label="Markér alle på siden"/);
  // Mobilkort: navn, CVR og by, tre nøgletal og score
  assert.match(html, /lasso-ccard__sub">CVR 10000000, Aarhus C/);
  assert.match(html, /<dt>Score<\/dt><dd>42<\/dd>/);
  // Aktive filtre som fjernbare chips (mobil)
  assert.match(html, /aria-label="Fjern Region/);
});

test("Tilstande står inde i tabelrammen, og hovedet bliver stående", () => {
  for (const props of [{}, { error: "Lasso svarer ikke" }, { result: { key: "k", rows: [] } }]) {
    const html = renderToStaticMarkup(createElement(CompanyTable, { ...props, onAction: noop, canDrillDown: false, onRetry: noop }));
    assert.match(html, /lasso-table-frame/);
    assert.match(html, /<thead>/);
    assert.doesNotMatch(html, /lasso-pager/);
  }
  const err = renderToStaticMarkup(createElement(CompanyTable, { error: "Lasso svarer ikke", onAction: noop, canDrillDown: false, onRetry: noop }));
  assert.match(err, /Data kunne ikke hentes/);
  assert.match(err, /Prøv igen/);
  const empty = renderToStaticMarkup(createElement(CompanyTable, { result: { key: "k", rows: [] }, onAction: noop, canDrillDown: false }));
  assert.match(empty, /Ingen virksomheder matcher kriterierne/);
});

test("Massehandlinger (15.2): antal, vælg alle, handlinger og luk", () => {
  const html = renderToStaticMarkup(
    createElement(BulkBar, { count: 2, total: 1243, allSelected: false, onSelectAll: noop, onClear: noop, actions: [{ id: "e", label: "Eksportér", onSelect: noop }, { id: "r", label: "Fjern", destructive: true, onSelect: noop }] }),
  );
  assert.match(html, /2 markeret/);
  assert.match(html, /vælg alle 1\.243/);
  assert.match(html, /lasso-bulkbar__danger">Fjern/);
  assert.match(html, /aria-label="Ryd markering"/);
});

test("Paginering: første, sidste og siderne omkring den aktive", () => {
  assert.deepEqual(pageItems(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageItems(2, 50), [1, 2, 3, 4, "…", 50]);
  assert.deepEqual(pageItems(25, 50), [1, "…", 24, 25, 26, "…", 50]);
  assert.deepEqual(pageItems(50, 50), [1, "…", 47, 48, 49, 50]);
  const html = renderToStaticMarkup(createElement(Pagination, { page: 2, pageSize: 25, count: 1243, total: 1243, onPage: noop }));
  assert.match(html, /Viser 26–50 af 1\.243/);
});

test("Hjælpere: statustone, mobilkortets tal og CSV", () => {
  assert.equal(statusTone({ status: "Under likvidation", statusKind: "warning" }), "liquidation");
  assert.equal(statusTone({ status: "Aktiv", statusKind: "active" }), "active");
  assert.deepEqual(cardFigures(["navn", "omsaetning", "udvikling"]), ["omsaetning", "bruttofortjeneste", "resultat"]);
  const csv = rowsToCsv(rows.slice(0, 1), ["navn", "cvr", "udvikling"]);
  assert.equal(csv.split("\r\n")[0], "﻿Lasso-ID;Navn;CVR");
});

const persons: PersonSearchResultVM = {
  key: "k",
  query: "Eksempel",
  total: 2,
  rows: [
    {
      lassoId: "CVR-3-1",
      name: "Mette Eksempel",
      birthYear: 1978,
      city: "København",
      bankruptcies: 1,
      roles: [
        { companyName: "Data Eksempel A/S", role: "direktør" },
        { companyName: "Nordisk Eksempel ApS", role: "bestyrelsesmedlem" },
        { companyName: "Eksempel Holding ApS", role: "ejer 100 %" },
      ],
    },
    { lassoId: "CVR-3-2", name: "Prøve Person", bankruptcies: 0, roles: [] },
  ],
};

test("Persontabel (15.3): navn alene, 2 roller + 'og n flere', konkurser kun > 0", () => {
  assert.equal(rolesText(persons.rows[0]!), "Direktør, Data Eksempel A/S og bestyrelsesmedlem, Nordisk Eksempel ApS og 1 flere");
  assert.equal(personSub(persons.rows[0]!), "f. 1978, København");
  const html = renderToStaticMarkup(createElement(PersonTable, { result: persons, onAction: noop, canDrillDown: true }));
  assert.match(html, /Mette Eksempel/);
  assert.match(html, /lasso-ptable__bankrupt">1</);
  assert.match(html, /Ingen aktive roller/);
  assert.match(html, /Viser 1–2 af 2 personer/);
  assert.doesNotMatch(html, /lasso-avatar|initial/);
  const loading = renderToStaticMarkup(createElement(PersonTable, { onAction: noop, canDrillDown: false }));
  assert.match(loading, /<thead>/);
  assert.match(loading, /aria-busy="true"/);
});
