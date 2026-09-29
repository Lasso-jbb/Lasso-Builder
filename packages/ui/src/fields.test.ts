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
  summarize,
  TagInput,
  TechnologyField,
  TechnologyRow,
  DateField,
  TreePicker,
  YesNoChips,
  ToggleField,
  FormPage,
} from "./components/Fields.js";
import { criterionSummary } from "./components/FilterSheet.js";
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

test("02a.9/02b.11 Chips: valgt har flueben og aria-pressed; med antal uden flueben, antal efter navnet", () => {
  const plain = render(h(ChoiceChips, { options: ["Hovedstaden", "Sjælland"], values: ["Sjælland"], onChange: noop }));
  assert.match(plain, /class="lasso-choice__chip is-on" aria-pressed="true"><svg/);
  const html = render(h(ChoiceChips, { options: [{ id: "Direktør", label: "Direktør", count: 122856 }, { id: "Økonomichef", label: "Økonomichef", count: 312 }], values: ["Direktør"], onChange: noop }));
  assert.match(html, /lasso-choice--count/);
  assert.match(html, /class="lasso-choice__chip is-on" aria-pressed="true">Direktør</);
  assert.match(html, /lasso-choice__count">122\.856</);
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

test("02b.9 Indsæt liste: operator, tekstområde og Vælg fra listen stablet, ingen knapper", () => {
  const html = render(h(ListField, { values: [], onChange: noop }));
  assert.match(html, />er en af</);
  assert.match(html, /<textarea[^>]*placeholder="Indsæt liste, fx 2100, 8000, 5000"/);
  assert.match(html, /Vælg fra listen/);
  assert.doesNotMatch(html, />Tilføj</);
  const old = render(h(ListField, { values: ["2100"], onChange: noop, defaultPasteOpen: true, variant: "inline" }));
  assert.match(old, />Annuller<.*>Tilføj</);
});

test("02b.10 Datovælger: ét bogstav pr. ugedag, i dag markeret, kort måned og år som dropdown", () => {
  const html = render(h(DatePicker, { value: "2026-09-15", today: new Date(2026, 8, 29), onSelect: noop }));
  assert.match(html, /role="columnheader" aria-label="mandag">M</);
  assert.match(html, /aria-current="date"[^>]*>29</);
  assert.match(html, /aria-selected="true"[^>]*>15</);
  assert.match(html, /sep\./);
  // september 2026 starter en tirsdag: 31. august står først i faint.
  assert.match(html, /lasso-cal__day is-out[^>]*>31</);
});

test("02a.12 Branchevælger: to navne og N flere, tomt = Vælg brancher, træ med koder", () => {
  const empty = render(h(IndustryField, { tree: DB07_EXCERPT, values: [], onChange: noop }));
  assert.match(empty, /Vælg brancher/);
  const some = render(h(IndustryField, { tree: DB07_EXCERPT, values: ["692000", "691000", "620100"], onChange: noop }));
  assert.match(some, /69\.20 Bogføring og revision; skatterådgivning, 69\.10 Juridisk bistand og 1 mere/);
  assert.match(some, /lasso-industryfield__icon/);
  const tree = render(h(TreePicker, { tree: DB07_EXCERPT, values: ["692000"], onChange: noop }));
  assert.match(tree, /role="tree"/);
  assert.match(tree, /Videnservice/);
});

test("02b.1 Persona og 03.2 Teknologi", () => {
  const roles = [{ id: "dir", label: "Direktør", count: 10 }, { id: "head", label: "Head of", count: 4 }];
  const p = render(h(PersonaField, { value: { roles: ["dir", "head"], departments: [], directPhone: true }, roles, departments: [{ id: "it", label: "IT", count: 4 }], onChange: noop, onRemove: noop, onAdd: noop }));
  assert.match(p, /lasso-personacard__title">Direktør eller Head of</);
  assert.match(p, /Alle afdelinger, skal have direkte telefonnummer/);
  assert.match(p, />Redigér</);
  assert.match(p, /aria-label="Fjern persona"/);
  assert.match(p, /Tilføj persona/);
  const f = render(h(PersonaField, { value: { roles: ["dir"], departments: [] }, roles, departments: [], onChange: noop, variant: "field" }));
  assert.match(f, /Direktør, alle afdelinger/);
  const t = render(h(TechnologyField, { label: "CMS", value: { on: true, mode: "any", values: [] }, onChange: noop }));
  assert.match(t, /role="switch" aria-checked="true"/);
  // 02b.2/03.3 (Jakob 29.09.2026): kun typen er et af tre valg i dropdown'en; ingen tekst foran.
  assert.match(t, /aria-expanded="false"[^>]*>Firmaer der benytter et CMS<\/button>/);
  assert.doesNotMatch(t, /lasso-field__fixed/);
  assert.doesNotMatch(t, /Søg efter flere/);
  assert.match(t, /Inkluder kun følgende[^]*Ekskluder følgende/);
  const ex = render(h(TechnologyField, { label: "CMS", value: { on: true, mode: "exclude", values: ["Umbraco"] }, onChange: noop }));
  assert.doesNotMatch(ex, /aria-expanded="false"[^>]*>Firmaer der benytter/);
  assert.match(ex, /Søg efter flere/);
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


test("02a.12 summarize: \"og N flere\" gennemgående, også ved én", () => {
  assert.equal(summarize(["A", "B"]), "A, B");
  assert.equal(summarize(["A", "B", "C"]), "A, B og 1 mere");
  assert.equal(summarize(["A", "B", "C", "D"]), "A, B og 2 flere");
  assert.equal(summarize(["A", "B", "C", "D"]), "A, B og 2 flere");
});

test("02b.6 FieldRow required: rød stjerne efter navnet", () => {
  const html = render(h(FieldRow, { label: "Kommune", required: true, error: "Vælg mindst én kommune.", children: "x" }));
  assert.match(html, /Kommune<span class="lasso-required" aria-label="påkrævet"> \*<\/span>/);
  assert.doesNotMatch(render(h(FieldRow, { label: "Kommune", children: "x" })), /lasso-required/);
});

test("03.4 TechnologyRow: Ryd kun når kontakten er til", () => {
  const off = render(h(TechnologyRow, { label: "Live chat", value: { on: false, mode: "any", values: [] }, onChange: noop, onClear: noop }));
  assert.doesNotMatch(off, />Ryd</);
  const on = render(h(TechnologyRow, { label: "E-commerce", value: { on: true, mode: "any", values: [] }, onChange: noop, onClear: noop }));
  assert.match(on, />Ryd</);
  assert.match(on, /Firmaer der benytter et E-commerce/);
});

test("02a.3/02a.6 enheden og \"og\" står i gruppe med feltet; DateField kan åbne kalenderen", () => {
  const html = render(h(DateField, { operator: "between", operators: ["after", "between"], values: ["01.01.2015", "31.12.2020"], onOperator: noop, onChange: noop, defaultOpen: true }));
  assert.match(html, /class="lasso-inputunit lasso-inputunit--date"><span class="lasso-unit">og<\/span>/);
  assert.match(html, /lasso-dateinput__pop/);
});

test("03.1 TagInput defaultText: indtastet tekst før den bliver til tags", () => {
  const html = render(h(TagInput, { values: [], onChange: noop, defaultText: "2100, 2200, 8000" }));
  assert.match(html, /value="2100, 2200, 8000"/);
});

test("02a/02b.14 Formularfelt: feltnavn over, hjælpetekst under, sammenklappet viser værdien", () => {
  const html = render(h(FieldRow, { label: "Navn", layout: "form", help: "Operatorer: indeholder", children: h("input", { className: "lasso-input" }) }));
  assert.match(html, /lasso-field--form/);
  assert.match(html, /lasso-field__helpline">Operatorer: indeholder</);
  const closed = render(h(FieldRow, { label: "Kommune", collapsible: true, open: false, summary: "Aarhus, Odense og 3 flere", children: h("span") }));
  assert.match(closed, /lasso-field__summary">Aarhus, Odense og 3 flere</);
});

test("02a.13/02a.8/02a.11 TagInput: Vælg N mere…, dropdown-chevron, søgeikon", () => {
  assert.match(render(h(TagInput, { values: ["A", "B"], max: 3, onChange: noop })), /placeholder="Vælg 1 mere…"/);
  assert.match(render(h(TagInput, { values: ["A"], dropdown: true, morePlaceholder: "Tilføj flere…", onChange: noop })), /placeholder="Tilføj flere…"[^]*lasso-tagfield__chevron/);
  const empty = render(h(TagInput, { values: [], searchIcon: true, onChange: noop }));
  assert.match(empty, /lasso-tagfield__icon/);
  assert.match(empty, /placeholder="Søg, eller indsæt en liste — fx 2100, 8000, 5000"/);
});

test("02b.3 ToggleField og 26a.8 FormPage", () => {
  const t = render(h(ToggleField, { label: "Skal have direkte telefonnummer", on: true, onChange: noop, help: "Slukket = tæller ikke med." }));
  assert.match(t, /lasso-togglefield__card/);
  assert.match(t, /role="switch" aria-checked="true"/);
  const p = render(h(FormPage, { title: "Kriterier (5)", action: { label: "Vis 1.243", onClick: noop }, children: h("div") }));
  assert.match(p, /Kriterier \(5\)/);
  assert.match(p, /lasso-formpage__action">Vis 1\.243</);
});

test("26c.8 Filterark: rækkens værdi uden feltnavn, Alle når tom", () => {
  assert.equal(criterionSummary(undefined), "Alle");
  assert.equal(criterionSummary({ field: "region", operator: "in", value: ["Hovedstaden"] }), "Hovedstaden");
});

test("02a.6/02b.10 Dato mellem: til-datoen kan ikke vælges før fra-datoen", async () => {
  const { dateRangeError } = await import("./components/Fields.js");
  const open = render(h(DateField, { operator: "between", operators: ["after", "between"], values: ["15.09.2026", ""], onOperator: noop, onChange: noop, defaultOpenTo: true, today: new Date(2026, 8, 29) }));
  // Dagene før fra-datoen er deaktiverede; fra-datoen selv og dagene efter kan vælges.
  assert.match(open, /aria-disabled="true" disabled=""[^>]*>14</);
  assert.doesNotMatch(open, /aria-disabled="true" disabled=""[^>]*>15</);
  assert.equal(dateRangeError(["15.09.2026", "14.09.2026"]), "Til-datoen kan ikke være før fra-datoen.");
  assert.equal(dateRangeError(["15.09.2026", "15.09.2026"]), null);
  const bad = render(h(DateField, { operator: "between", operators: ["between"], values: ["15.09.2026", "01.09.2026"], onOperator: noop, onChange: noop }));
  assert.match(bad, /role="alert">Til-datoen kan ikke være før fra-datoen\./);
});
