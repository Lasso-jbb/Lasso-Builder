import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { statusKind, type CompanyEventsVM } from "@lasso/spec";
import { statusTone } from "./primitives.js";
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
  assert.match(html, /Data Eksempel A\/S \(ophørende\) fusioneret ind i Eksempel A\/S/); // 28.6: navnene, ikke "denne virksomhed"
  assert.match(html, /14\.05\.2012[^]*Stiftet/);
  const none = renderToStaticMarkup(createElement(Mergers, { events: { ...ev, mergers: [] } }));
  assert.match(none, /ingen registrerede fusioner eller spaltninger/);
});

test("28.8: Statstidende med alvorsfarvet type; udelades helt uden bekendtgørelser", () => {
  const html = renderToStaticMarkup(createElement(Announcements, { events: ev }));
  assert.match(html, /lasso-announce__type--bankrupt">Dekret om konkurs</);
  assert.doesNotMatch(html, /lasso-source/, "kildelinjen står pr. bekendtgørelse, ikke samlet");
  assert.equal(renderToStaticMarkup(createElement(Announcements, { events: { ...ev, announcements: [] } })), "");
});

test("28.2: publicering med ny/korrigeret, udråbstegn og 'før …' under tallet", () => {
  const html = renderToStaticMarkup(createElement(Publications, { events: ev }));
  assert.match(html, />Årsrapport, ny</);
  assert.match(html, />Korrigeret<span class="lasso-stmt__flag"/, "flaget står efter ordet");
  assert.match(html, /125,6 mio\. kr\.<\/span><span class="lasso-publications__before">før 135,7 mio\. kr\./);
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
  // 28.3 (Jakob 29.09): intet efter personnavnet.
  assert.doesNotMatch(html, /lasso-entupd__type">Person, /);
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
  assert.match(html, /Kører, 25 %, 120 af 480/); // 28.4: hele procent som i Paper
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Færdig med fejl[^]*se 1 fejl/);
  assert.match(html, /lasso-batches__status--planned">Planlagt/);
  assert.match(html, /title="Bestilt af Anne Eksempel"/);
});

test("28.5: personresultat med by, to selskaber, 'og N flere' og 'Fundet via'", () => {
  const html = renderToStaticMarkup(createElement(PersonSearchResults, { rows: [{ lassoId: "CVR-3-1", name: "Mette Eksempel", city: "København", companies: ["Data Eksempel A/S", "Nordisk Eksempel ApS", "X"], totalCompanyCount: 5, foundVia: "binavn" }] }));
  assert.match(html, /Person, København<[^]*Data Eksempel A\/S, Nordisk Eksempel ApS og 3 flere/);
  const withBar = renderToStaticMarkup(createElement(PersonSearchResults, { rows: [], query: "jakob bech company:lasso", summary: "2 personer fundet" }));
  assert.match(withBar, /value="jakob bech company:lasso"[^]*>Virksomheder<[^]*>Personer<[^]*2 personer fundet/);
  assert.match(html, /Fundet via binavn/);
  assert.doesNotMatch(html, /score|relevans/i);
});

test("28.1: status-værdilisten klassificeres ens for live- og demodata", () => {
  assert.equal(statusKind("Normal"), "active");
  assert.equal(statusKind("Aktiv"), "active");
  assert.equal(statusKind("Tvangsopløst"), "warning");
  assert.equal(statusKind("Under reassumering"), "warning");
  assert.equal(statusKind("Under rekonstruktion"), "warning");
  assert.equal(statusKind("Under konkurs"), "warning");
  assert.equal(statusKind("Opløst efter konkurs"), "inactive");
  assert.equal(statusKind("Ophørt"), "inactive");
  assert.equal(statusTone("Under frivillig likvidation", statusKind("Under frivillig likvidation")), "liquidation");
  assert.equal(statusTone("Ny", statusKind("Ny")), "new");
});

test("28.9: reelle ejere i tre særlige tilstande og 'via rolle' i den almindelige liste", async () => {
  const { LassoBeneficialOwners } = await import("./components/LassoBeneficialOwners.js");
  const r = (ownership: Parameters<typeof LassoBeneficialOwners>[0]["ownership"]) => renderToStaticMarkup(createElement(LassoBeneficialOwners, { ownership }));
  const mgmt = r({ lassoId: "x", special: { kind: "management", fallback: "management", reason: "Ledelsen er indsat som reelle ejere." }, owners: [{ name: "Anne", role: "Direktør" }] });
  assert.match(mgmt, /lasso-bo__reason[^>]*>Ledelsen er indsat som reelle ejere\.</);
  assert.match(mgmt, /Anne[^]*lasso-bo__role">Direktør</);
  const exempt = r({ lassoId: "x", owners: [], special: { kind: "exempt", reason: "Undtaget.", caveat: "Forbehold." } });
  assert.match(exempt, /Undtaget\.[^]*lasso-bo__caveat">Forbehold\./);
  assert.doesNotMatch(exempt, /lasso-state/);
  const unid = r({ lassoId: "x", owners: [], special: { kind: "unidentified", reason: "Registreret i CVR." }, gaps: [{ reason: "dublet" }] });
  assert.match(unid, /lasso-bo__alert[^]*Registreret i CVR\.[^]*Indgår som observation i risikovurderingen/);
  assert.match(unid, /Kilde: CVR/);
  assert.doesNotMatch(unid, /dublet/);
  const via = r({ lassoId: "x", owners: [{ name: "Bo", throughRole: true, share: "25 %" }] });
  assert.match(via, /Bo<span class="lasso-bo__via">, via rolle<\/span>/);
});

test("28.7/26h.9: regnskabsoplysninger og kapital som to kort; fravalgt revision i warning; profil med branchechips og formål", async () => {
  const { Registration } = await import("./components/Registration.js");
  const company = {
    lassoId: "CVR-1-1",
    name: "Prøve A/S",
    industryCode: "631000",
    industryText: "Databehandling",
    auditExempt: true,
    auditExemptSince: 2024,
    accountingClass: "B",
    altIndustries: [{ code: "620200", text: "It-rådgivning" }],
    registeredCapital: { amount: 500000, currency: "DKK", classes: ["A-aktier 400.000 DKK", "B-aktier 100.000 DKK"] },
    listed: false,
  };
  const texts = { lassoId: "CVR-1-1", sections: [{ heading: "Formål", body: "At drive it-virksomhed." }, { heading: "Tegningsregler", body: "Direktøren alene." }] };
  const html = renderToStaticMarkup(createElement(Registration, { company, texts }));
  assert.match(html, /lasso-section__title">Regnskabsoplysninger<[^]*lasso-section__title">Kapital og vedtægter</);
  assert.match(html, /lasso-reg__warn">Fravalgt<\/span><span class="lasso-reg__muted">, siden regnskabsåret 2024</);
  assert.match(html, />A-aktier 400\.000 DKK<\/span><span>B-aktier 100\.000 DKK</);
  assert.match(html, /Børsnoteret[^]*Nej/);
  const profile = renderToStaticMarkup(createElement(Registration, { company, texts, variant: "profile" }));
  assert.match(profile, /lasso-reg__chip">631000 Databehandling, hoved</);
  assert.match(profile, /Formål[^]*At drive it-virksomhed\./);
  assert.match(profile, />Vis tegningsregel og vedtægter</);
});

test("28.4: bestillingsformular med de fire rapporttyper, PDF | Zip og 'Bestil N rapporter'; koral links", async () => {
  const { ReportBatches: RB } = await import("./components/ReportBatches.js");
  const html = renderToStaticMarkup(
    createElement(RB, {
      order: { count: 142, listName: "Kunder", onOrder: () => {} },
      batches: [{ id: "a", name: "Kunder Q3", reportType: "Revision", createdAt: "2026-09-29", status: "done" as const, count: 142, format: "Zip" as const }],
      onAction: () => {},
    }),
  );
  assert.match(html, /Bestil rapporter[^]*Batchnavn[^]*Rapporttype[^]*<option selected="">Revision<\/option><option>Finans<\/option><option>Reelle ejere<\/option><option>Revision udvidet<\/option>/);
  assert.match(html, />PDF<[^]*>Zip</);
  assert.match(html, />Bestil 142 rapporter</);
  assert.match(html, /142 virksomheder, Zip/);
  assert.match(html, /lasso-batches__action">Hent zip</);
});
