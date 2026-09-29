import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FieldDef } from "@lasso/spec";
import { FilterPanel } from "./components/FilterPanel.js";
import {
  ChoiceChips,
  DatePicker,
  effectText,
  FieldRow,
  IndustryField,
  ListField,
  MultiSelect,
  PersonaField,
  SegmentYesNo,
  TagInput,
  TechnologyField,
  TreePicker,
  YesNoChips,
} from "./components/Fields.js";
import { DB07_EXCERPT } from "./components/industries.js";

const noop = () => {};
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

test("03.1 Handlingslinjen: effekt, Annuller og + Tilføj / Opdater", () => {
  assert.equal(effectText(-28910), "Reducerer resultatet med 28.910");
  assert.equal(effectText(4120), "Udvider resultatet med 4.120");
  const add = render(h(FieldRow, { label: "Postnummer", info: "Firecifret postnummer.", pending: { mode: "add", delta: -28910, onCancel: noop, onConfirm: noop }, children: "x" }));
  assert.match(add, /Reducerer resultatet med 28\.910/);
  assert.match(add, /<svg[^>]*>.*<\/svg>Tilføj<\/button>/);
  assert.match(add, /role="tooltip"[^>]*>Firecifret postnummer\./);
  const upd = render(h(FieldRow, { label: "Kommune", pending: { mode: "update", delta: 4120, onCancel: noop, onConfirm: noop }, children: "x" }));
  assert.match(upd, />Opdater<\/button>/);
  assert.doesNotMatch(upd, /Tilføj til målgruppen/);
  // I ro: ingen handlingslinje, "Ryd" til højre
  const rest = render(h(FieldRow, { label: "Kommune", onClear: noop, children: "x" }));
  assert.doesNotMatch(rest, /lasso-field__foot/);
  assert.match(rest, />Ryd</);
});

test("02a.9/02b.11 Chips: valgt har flueben og aria-pressed, antal efter navnet", () => {
  const html = render(h(ChoiceChips, { options: [{ id: "Direktør", label: "Direktør", count: 1204 }, { id: "Økonomichef", label: "Økonomichef", count: 312 }], values: ["Direktør"], onChange: noop }));
  assert.match(html, /class="lasso-choice__chip is-on" aria-pressed="true"><svg/);
  assert.match(html, /lasso-choice__count">1\.204</);
});

test("02a.10 Ja/Nej som to chips, intet valgt = ingen aria-pressed true", () => {
  const none = render(h(YesNoChips, { value: null, onChange: noop }));
  assert.equal((none.match(/aria-pressed="true"/g) ?? []).length, 0);
  assert.match(none, />Ja<\/button>.*>Nej<\/button>/);
  const seg = render(h(SegmentYesNo, { value: true, onChange: noop }));
  assert.match(seg, /role="radio" aria-checked="true"[^>]*>Ja</);
});

test("02b.7 Dropdown, åben: søgefelt øverst, flueben, hjælpetekst, ingen <select>", () => {
  const opts = ["A/S", "ApS", "IVS", "I/S", "K/S", "P/S", "Fond", "Forening"];
  const html = render(h(MultiSelect, { options: opts, values: ["ApS"], onChange: noop, defaultOpen: true, help: "Vælg en eller flere. Tom = alle." }));
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /lasso-msel__search/);
  assert.match(html, /role="option" aria-selected="true"[^>]*>.*ApS/);
  assert.match(html, /Vælg en eller flere\. Tom = alle\./);
  assert.doesNotMatch(html, /<select/);
});

test("02a.13 Multivalg med loft: tæller 3 / 3 og Loftet er nået", () => {
  const html = render(h(TagInput, { values: ["Direktør", "Ejer", "Bestyrelse"], max: 3, onChange: noop }));
  assert.match(html, /3 \/ 3/);
  assert.match(html, /placeholder="Loftet er nået"/);
  assert.match(html, /disabled=""/);
});

test("02b.9 Indsæt liste: tekstområde med Annuller/Tilføj", () => {
  const html = render(h(ListField, { values: ["2100"], onChange: noop, defaultPasteOpen: true }));
  assert.match(html, /<textarea/);
  assert.match(html, />Annuller<.*>Tilføj</);
});

test("02b.10 Datovælger: mandag først, i dag markeret, måned og år som dropdown", () => {
  const html = render(h(DatePicker, { value: "2026-09-15", today: new Date(2026, 8, 29), onSelect: noop }));
  assert.match(html, /role="columnheader">Ma</);
  assert.match(html, /aria-current="date"[^>]*>29</);
  assert.match(html, /aria-selected="true"[^>]*>15</);
  assert.match(html, /september/);
  // september 2026 starter en tirsdag: én tom celle før den 1.
  assert.equal((html.match(/lasso-cal__empty/g) ?? []).length >= 1, true);
});

test("02a.12 Branchevælger: to navne og N flere, tomt = Vælg brancher, træ med koder", () => {
  const empty = render(h(IndustryField, { tree: DB07_EXCERPT, values: [], onChange: noop }));
  assert.match(empty, /Vælg brancher/);
  const some = render(h(IndustryField, { tree: DB07_EXCERPT, values: ["692000", "691000", "620100"], onChange: noop }));
  assert.match(some, /Bogføring og revision; skatterådgivning, Juridisk bistand og 1 flere/);
  const tree = render(h(TreePicker, { tree: DB07_EXCERPT, values: ["692000"], onChange: noop }));
  assert.match(tree, /role="tree"/);
  assert.match(tree, /Videnservice/);
});

test("02b.1 Persona og 03.2 Teknologi", () => {
  const p = render(h(PersonaField, { value: { roles: ["dir"], departments: [] }, roles: [{ id: "dir", label: "Direktør", count: 10 }], departments: [{ id: "it", label: "IT", count: 4 }], onChange: noop }));
  assert.match(p, /Direktør, alle afdelinger/);
  assert.match(p, />Redigér</);
  const t = render(h(TechnologyField, { label: "CMS", value: { on: true, mode: "any", values: [] }, onChange: noop }));
  assert.match(t, /role="switch" aria-checked="true"/);
  assert.match(t, /Firmaer der benytter/);
  assert.match(t, /Et CMS/);
  const ex = render(h(TechnologyField, { label: "CMS", value: { on: true, mode: "exclude", values: ["Umbraco"] }, onChange: noop }));
  assert.doesNotMatch(ex, /Firmaer der benytter/);
  assert.match(ex, /Ekskluder følgende/);
  assert.match(ex, /Umbraco/);
  const off = render(h(TechnologyField, { label: "Live chat", value: { on: false, mode: "any", values: [] }, onChange: noop }));
  assert.doesNotMatch(off, /lasso-select/);
});

test("FilterPanel: bagudkompatibel, redigering pr. felt uden browserens select", () => {
  const criteria = [
    { field: "region", operator: "in" as const, value: ["Midtjylland"] },
    { field: "navn", operator: "contains" as const, value: "Eksempel" },
    { field: "stiftet", operator: "after" as const, value: "2015-03-01" },
  ];
  const closed = render(h(FilterPanel, { criteria, editable: true, onApply: noop }));
  assert.match(closed, /Region: Midtjylland/);
  assert.match(closed, /Redigér filtre/);
  const open = render(h(FilterPanel, { criteria, editable: true, onApply: noop, defaultOpen: true, intro: "Filtrene gælder hovedadressen." }));
  assert.doesNotMatch(open, /<select/);
  assert.doesNotMatch(open, /Tilføj til målgruppen/);
  // Chips uden operator foran
  assert.match(open, /aria-pressed="true"><svg[^]*?Midtjylland/);
  assert.doesNotMatch(open, /er en af<\/button>[^]*?Midtjylland/);
  // Fritekstens operator
  assert.match(open, /aria-haspopup="menu"[^>]*>indeholder</);
  // Dato med datovælger
  assert.match(open, /value="01\.03\.2015"/);
  assert.match(open, /Åbn kalender/);
  assert.match(open, /lasso-fieldsec__intro">Filtrene gælder hovedadressen\./);
  assert.match(open, /Tilføj filter/);
});

test("FilterPanel: procent- og Ja/Nej-felter fra et udvidet katalog", () => {
  const fields: FieldDef[] = [
    { key: "soliditetsgrad", label: "Soliditetsgrad", type: "percent", description: "Egenkapital i procent af balancen." },
    { key: "boersnoteret", label: "Er børsnoteret", type: "boolean", description: "Aktier handles på en børs." },
    { key: "telefon", label: "Skal have telefonnummer", type: "boolean", control: "toggle", description: "Kun beslutningstagere med telefon." },
  ];
  const criteria = [
    { field: "soliditetsgrad", operator: "gte" as const, value: 30 },
    { field: "boersnoteret", operator: "eq" as const, value: true },
    { field: "telefon", operator: "eq" as const, value: true },
  ];
  const html = render(h(FilterPanel, { criteria, fields, editable: true, onApply: noop, defaultOpen: true }));
  assert.match(html, /value="30"[^>]*>(?:<\/input>)?<span class="lasso-unit">%<\/span>/);
  assert.match(html, /aria-pressed="true"><svg[^]*?Ja<\/button>/);
  assert.match(html, /role="switch" aria-checked="true"/);
});

