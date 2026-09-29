import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompanyEventsVM } from "@lasso/spec";
import { Announcements, Mergers, Publications } from "./components/CompanyEvents.js";
import { EntityUpdates } from "./components/EntityUpdates.js";
import { ReportBatches } from "./components/ReportBatches.js";
import { PersonSearchResults } from "./components/PersonSearchResults.js";

const ev: CompanyEventsVM = {
  lassoId: "CVR-1-1",
  updated: "2026-09-25",
  mergers: [{ date: "2022-07-01", type: "Fusion", from: [{ name: "Data Eksempel A/S", ceased: true }], to: [{ name: "Eksempel A/S", lassoId: "CVR-1-1" }] }],
  announcements: [{ date: "2026-08-12", type: "Dekret om konkurs", severity: "bankrupt", text: "Eksempel er erklæret konkurs." }],
  publications: [
    { published: "2026-04-11", year: 2025, periodEnd: "2025-12-31", kind: "Årsrapport", figure: { label: "Omsætning", value: 135_800_000 } },
    { published: "2025-08-14", year: 2024, periodEnd: "2024-12-31", kind: "Årsrapport", corrected: true, figure: { label: "Omsætning", value: 125_600_000, previous: 135_700_000 } },
  ],
};

test("28.6/26h.8: fusion som 'fra → til', fokus med koral kant, ophørt i muted, mini-tidslinjens sætning", () => {
  const html = renderToStaticMarkup(createElement(Mergers, { events: ev, company: { lassoId: "CVR-1-1", name: "Eksempel A/S", founded: "2012-05-14" }, demo: true }));
  assert.match(html, /01\.07\.2022[^]*Fusion/);
  assert.match(html, /is-ceased[^]*Data Eksempel A\/S[^]*ophørt ved fusionen/);
  assert.match(html, /is-focus[^]*Eksempel A\/S/);
  assert.match(html, /Data Eksempel A\/S \(ophørende\) fusioneret ind i denne virksomhed/);
  assert.match(html, /14\.05\.2012[^]*Stiftet/);
  const none = renderToStaticMarkup(createElement(Mergers, { events: { ...ev, mergers: [] } }));
  assert.match(none, /ingen registrerede fusioner eller spaltninger/);
});

test("28.8: Statstidende med alvorsfarvet type; udelades helt uden bekendtgørelser", () => {
  const html = renderToStaticMarkup(createElement(Announcements, { events: ev }));
  assert.match(html, /lasso-announce__type--bankrupt">Dekret om konkurs</);
  assert.match(html, /kreditoroplysninger/);
  assert.equal(renderToStaticMarkup(createElement(Announcements, { events: { ...ev, announcements: [] } })), "");
});

test("28.2: publicering med ny/korrigeret, udråbstegn og 'før …' under tallet", () => {
  const html = renderToStaticMarkup(createElement(Publications, { events: ev }));
  assert.match(html, /Årsrapport 2025, ny/);
  assert.match(html, /lasso-stmt__flag[^]*Årsrapport 2024, korrigeret/);
  assert.match(html, /125,6<\/span><span class="lasso-publications__before">før 135,7/);
  assert.doesNotMatch(html, /<s>|line-through/);
});

test("28.3: opdateringer med person/virksomhed som hoved, typen i muted og kun 'fjernet' farvet", () => {
  const html = renderToStaticMarkup(
    createElement(EntityUpdates, {
      items: [
        { id: "1", subject: "Mette Eksempel", subjectKind: "person" as const, type: "Person, ledelse" as const, text: "Rolle", from: "Bestyrelsesmedlem", to: "Formand", at: "2026-09-20" },
        { id: "2", subject: "Eksempel A/S", subjectKind: "company" as const, type: "P-enhed fjernet" as const, text: "Eksempelvej 4, 2600 Glostrup", at: "2026-09-21" },
      ],
    }),
  );
  assert.match(html, /lasso-entupd__type lasso-entupd__type--removed">P-enhed fjernet/);
  assert.match(html, /lasso-entupd__type">Person, ledelse/);
  assert.match(html, /Rolle: Bestyrelsesmedlem → Formand/);
});

test("28.4: batchstatus som ren tekst, fremdriftsbjælke ved kørsel og ét tekstlink pr. række", () => {
  const html = renderToStaticMarkup(
    createElement(ReportBatches, {
      batches: [
        { id: "a", name: "Kunder Q3", reportType: "Virksomhedsrapport", createdAt: "2026-09-20", status: "running" as const, done: 120, total: 480, owner: "Anne Eksempel" },
        { id: "b", name: "Leverandører", reportType: "Kreditrapport", createdAt: "2026-09-18", status: "failed" as const, errors: ["CVR 1 ukendt"] },
        { id: "c", name: "Planlagt", reportType: "Virksomhedsrapport", createdAt: "2026-09-25", status: "planned" as const },
      ],
      onAction: () => {},
    }),
  );
  assert.match(html, /Kører, 25,0 %, 120 af 480/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Færdig med fejl[^]*Se fejl/);
  assert.match(html, /lasso-batches__status--planned">Planlagt/);
  assert.match(html, /title="Bestilt af Anne Eksempel"/);
});

test("28.5: personresultat med by, to selskaber, 'og N flere' og 'Fundet via'", () => {
  const html = renderToStaticMarkup(createElement(PersonSearchResults, { rows: [{ lassoId: "CVR-3-1", name: "Mette Eksempel", city: "København", companies: ["Data Eksempel A/S", "Nordisk Eksempel ApS", "X"], totalCompanyCount: 5, foundVia: "binavn" }] }));
  assert.match(html, /København, Data Eksempel A\/S, Nordisk Eksempel ApS og 3 flere/);
  assert.match(html, /Fundet via binavn/);
  assert.doesNotMatch(html, /score|relevans/i);
});
