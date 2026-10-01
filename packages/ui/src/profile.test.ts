import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeCompany, emptyDataset, type CompanyVM, type ContactVM, type Dataset, type FinancialsVM, type OwnershipVM, type TextSectionsVM } from "@lasso/spec";
import { KeyValueList } from "./components/KeyValueList.js";
import { LassoContact } from "./components/LassoContact.js";
import { LassoRelations } from "./components/LassoRelations.js";
import { LassoTextSections, revealOf, segmentAction } from "./components/LassoTextSections.js";
import { LassoView } from "./LassoView.js";

const ID = "CVR-1-99000001";
const ADDRESS = { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" };
const COMPANY: CompanyVM = {
  lassoId: ID,
  cvr: "99000001",
  name: "Eksempel Byg A/S",
  status: "Aktiv",
  form: "A/S",
  founded: "1998-04-01",
  employees: 64,
  industryCode: "412000",
  industryText: "Opførelse af bygninger",
  address: ADDRESS,
  phone: "86123456",
  email: "kontakt@eksempelbyg.dk",
  website: "https://eksempelbyg.dk",
};
const OWNERSHIP: OwnershipVM = { lassoId: ID, owners: [{ name: "Eksempel Holding ApS", kind: "company", share: "100 %", lassoId: "CVR-1-99000010" }], auditor: { name: "Eksempel Revision Midt ApS", lassoId: "CVR-1-99000002", from: "2019-01-01" } };
const FINANCIALS: FinancialsVM = {
  lassoId: ID,
  currency: "DKK",
  years: [2024, 2025].map((year, i) => ({ year, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, published: `${year + 1}-04-11`, revenue: 135_800_000 + i, grossProfit: 52_200_000, profit: 4_700_000, equity: 34_000_000, employees: 64, ebitda: 17_500_000, soliditetsgrad: 54.1, assetsTotal: 62_800_000 })),
};

/** Nøgle-kolonnen i en nøgle-værdi-liste. */
const labels = (html: string) => [...html.matchAll(/lasso-kv-row__labeltext">([^<]*)</g)].map((m) => m[1]);
/** Synlig tekst uden tags. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

test("Virksomhedsoplysninger: Jakobs rækkefølge (01.10); under hovedet branchekode i stedet for branche", () => {
  const html = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true, hideContact: true }));
  assert.deepEqual(labels(html), ["Branchekode", "Kommune", "Regnskabsår", "Seneste regnskab udgivet", "Revisor", "Antal ansatte"]);
  assert.match(html, /412000/);
  // Uden kontaktblok på siden står telefon, e-mail og web stadig her (adressen står i hovedet).
  const noContact = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true }));
  assert.deepEqual(labels(noContact).slice(2, 5), ["Telefon", "E-mail", "Website"]);
  assert.ok(!labels(noContact).includes("Adresse"));
  // Ejerlisten på siden viser revisoren: listen gentager den ikke.
  const withOwners = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true, hideContact: true, hideAuditor: true }));
  assert.deepEqual(labels(withOwners), ["Branchekode", "Kommune", "Regnskabsår", "Seneste regnskab udgivet", "Antal ansatte"]);
  // Uden hoved (fx en render_view-spec uden LassoCompanyHead) står identiteten i listen.
  const alone = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company" }));
  for (const l of ["Stiftelsesdato", "Virksomhedsform", "Branche", "Antal ansatte", "CVR"]) assert.ok(labels(alone).includes(l), l);
  // Intet at vise ud over hovedet: tom tilstand, der siger hvorfor, aldrig en tom ramme.
  const bare = renderToStaticMarkup(createElement(KeyValueList, { company: { lassoId: ID, name: "X" }, variant: "company", hideIdentity: true }));
  assert.match(bare, /lasso-state--empty|flere oplysninger/);
});

test("Regnskab (financials) udelader nøgletallene fra kortene på siden", () => {
  const all = labels(renderToStaticMarkup(createElement(KeyValueList, { financials: FINANCIALS, variant: "financials" })));
  assert.ok(all.includes("Omsætning") && all.includes("Årets resultat") && all.includes("EBITDA"));
  const html = renderToStaticMarkup(createElement(KeyValueList, { financials: FINANCIALS, variant: "financials", exclude: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ansatte"] }));
  assert.deepEqual(labels(html), ["Regnskabsperiode", "Regnskab udgivet", "EBITDA", "Soliditetsgrad", "Overskudsgrad", "Likviditetsgrad", "Balancesum", "Gæld i alt"]);
});

const LONG = "Selskabet har haft en støt stigende bruttofortjeneste og et positivt resultat i alle år, og egenkapitalen er vokset hvert år. ";
const SECTIONS: TextSectionsVM = {
  lassoId: ID,
  title: "Virksomhedsprofil",
  sections: [
    { heading: "Branche", body: "Opførelse af bygninger", note: "NACE 412000" },
    { heading: "Formål", body: "At drive byggevirksomhed." },
    { heading: "Tegningsregler", body: "Direktøren alene." },
    {
      heading: "Regnskabsanalyse: konklusion",
      body: `Revideret af Eksempel Revision Midt ApS. Direktør Anne Eksempel. ${LONG.repeat(3)}`,
      segments: [
        { text: "Revideret af " },
        { text: "Eksempel Revision Midt ApS", lassoId: "CVR-1-99000002" },
        { text: ". Direktør " },
        { text: "Anne Eksempel", lassoId: "CVR-3-4000000001" },
        { text: `. ${LONG.repeat(3)}` },
      ],
      note: "Kilde: Lasso regnskabsanalyse",
    },
    ...["Resultat", "Likviditet", "Balance og kapitalforhold", "Branchestatistik", "Revisoroplysninger", "Spørgsmål til overvejelse"].map((heading) => ({
      heading,
      body: `${heading}: ${LONG}`,
      note: "Kilde: Lasso regnskabsanalyse",
    })),
  ],
};
const headings = (html: string) => [...html.matchAll(/lasso-textsection__heading">([^<]*)</g)].map((m) => m[1]);

test("Virksomhedsprofil (overblik): CVR-tekster uden branche plus konklusion, resultat og likviditet, ingen kildevisning (12.1)", () => {
  const html = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS }));
  // 12.1 (Jakob 01.10): afsnittene læses som én tekst; de første 440 tegn står, resten kommer med "Vis mere" (50 % ad gangen).
  const all = ["Formål", "Tegningsregler", "Regnskabsanalyse: konklusion", "Resultat", "Likviditet"];
  const first = headings(html);
  assert.ok(first.length >= 1 && first.length < all.length, first.join());
  assert.deepEqual(first, all.slice(0, first.length));
  assert.equal(count(html, " …"), 1, "teksten klippes kun ét sted");
  assert.doesNotMatch(html, /Kilde:/);
  assert.doesNotMatch(html, /NACE 412000/);
  // 12.1: ét "Vis mere" for hele sektionen.
  assert.equal(count(html, ">Vis mere<"), 1);
  assert.doesNotMatch(html, /Se hele regnskabsanalysen/);
  // Kun CVR-tekster: ingen analysekilde.
  const cvr = renderToStaticMarkup(createElement(LassoTextSections, { sections: { ...SECTIONS, sections: SECTIONS.sections.slice(0, 3) } }));
  assert.deepEqual(headings(cvr), ["Formål", "Tegningsregler"]);
  assert.doesNotMatch(cvr, /Kilde:/);
});

test("Regnskabsanalyse (19.3, LYO-0): foldbare afsnit med det første åbent, forbehold og feedback uden kildevisning (runde 6); ingen genereringslinje (G3) og ingen CVR-tekster", () => {
  const v = { ...SECTIONS, analysisGenerated: "2026-09-25T08:00:00Z", analysisBasis: "2021–2025", analysisHeadline: "Vækst i toplinjen", analysisSources: ["A", "B", "C", "D"] };
  const html = renderToStaticMarkup(createElement(LassoTextSections, { sections: v, variant: "analyse" }));
  assert.match(html, /<h3 class="lasso-section__title">Regnskabsanalyse<\/h3>/);
  assert.doesNotMatch(html, /Genereret af Lasso/);
  assert.match(html, /aria-expanded="true"[^>]*><span class="lasso-analysis19__title">Vækst i toplinjen</);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /lasso-analysis19__disclaimer">Forbehold: /);
  assert.match(html, /Var det brugbart\?/);
  assert.doesNotMatch(html, /Vis kild|Skjul kild/);
  // "Hent som PDF" kun med en handling (G1).
  assert.doesNotMatch(html, /Hent som PDF/);
  assert.match(renderToStaticMarkup(createElement(LassoTextSections, { sections: v, variant: "analyse", onPdf: () => {} })), /lasso-analysis19__pdf[^]*Hent som PDF/);
  assert.doesNotMatch(html, /lasso-sour/);
  assert.doesNotMatch(html, /Formål|Tegningsregler/);
  // Uden analyse: tom tilstand, der siger hvorfor.
  const none = renderToStaticMarkup(createElement(LassoTextSections, { sections: { ...SECTIONS, sections: SECTIONS.sections.slice(0, 3) }, variant: "analyse" }));
  assert.match(none, /ingen regnskabsanalyse/);
});

test("Navne med Lasso-ID i analysen er links med drill-down og ren tekst uden", () => {
  const withOpen = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS, variant: "analyse", onOpen: () => {} }));
  assert.match(withOpen, /<button type="button" class="lasso-link lasso-textsection__entity">Eksempel Revision Midt ApS<\/button>/);
  assert.match(withOpen, /<button type="button" class="lasso-link lasso-textsection__entity">Anne Eksempel<\/button>/);
  const without = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS, variant: "analyse" }));
  assert.doesNotMatch(without, /lasso-textsection__entity/);
  assert.match(without.replace(/<[^>]+>/g, ""), /Revideret af Eksempel Revision Midt ApS\. Direktør Anne Eksempel\./);
  // Virksomhed åbnes som virksomhed, person som person; uden Lasso-ID intet link.
  assert.deepEqual(segmentAction({ text: "Eksempel Revision Midt ApS", lassoId: "CVR-1-99000002" }), { kind: "open-company", lassoId: "CVR-1-99000002", name: "Eksempel Revision Midt ApS" });
  assert.deepEqual(segmentAction({ text: "Anne Eksempel", lassoId: "CVR-3-4000000001" }), { kind: "open-person", lassoId: "CVR-3-4000000001", name: "Anne Eksempel" });
  assert.equal(segmentAction({ text: "Nogen" }), null);
  // Foldet profil: segmenterne skæres ved 220 tegn med " …", navnene bevares som links.
  const profile = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS, onOpen: () => {} }));
  assert.match(profile, /lasso-textsection__entity">Anne Eksempel</);
  assert.match(profile, / …<\/p>/);
});

test("Kontaktblok: adressen udelades, når hovedet viser den; et verificeret CVR-nummer står én gang; én kildevisning", () => {
  const contact: ContactVM = {
    lassoId: ID,
    phone: "86123456",
    email: "kontakt@eksempelbyg.dk",
    website: "https://eksempelbyg.dk",
    address: ADDRESS,
    source: "CVR",
    updated: "2026-09-20",
    verifiedAt: "2026-09-20",
    verifiedNumbers: [
      { phoneNumber: "86 12 34 56", callable: true, sources: ["CVR"] },
      { phoneNumber: "20 30 40 50", callable: true, sources: ["Website"] },
    ],
  };
  const html = renderToStaticMarkup(createElement(LassoContact, { contact, omitAddress: true, foldExtra: false }));
  assert.doesNotMatch(html, /Prøvevej 1/);
  assert.equal(count(html, "86 12 34 56"), 1);
  assert.match(html, /20 30 40 50/);
  assert.equal(count(html, "Kilde:"), 0);
  assert.doesNotMatch(text(html), /Kilde:/, "G3: ingen kildevisning");
  // Uden hoved (alene i en render_view-spec) står adressen.
  assert.match(renderToStaticMarkup(createElement(LassoContact, { contact })), /Prøvevej 1/);
});

test("Relationer uden direktion og bestyrelse viser rollerne, CVR har (fx fuldt ansvarlig deltager)", () => {
  const html = renderToStaticMarkup(
    createElement(LassoRelations, { people: [{ name: "Mia Eksempel", role: "Fuldt ansvarlig deltager", from: "2023-01-30" }], ownership: { lassoId: ID, owners: [] } }),
  );
  assert.match(html, /lasso-relations__label">Fuldt ansvarlig deltager</);
  assert.match(html, /Mia Eksempel/);
  assert.doesNotMatch(html, /ingen registrerede relationer/);
});

/** Et fuldt datasæt som demoens Eksempel Byg: hoved, kontakt, ejere, regnskab, profil med analyse. */
function dataset(): Dataset {
  const ds = emptyDataset("demo");
  ds.companies[ID] = COMPANY;
  ds.ownership[ID] = OWNERSHIP;
  ds.people[ID] = [{ name: "Anne Eksempel", role: "Direktør", from: "2015-01-01" }];
  ds.financials[ID] = { ...FINANCIALS, years: [2021, 2022, 2023, 2024, 2025].map((year) => ({ ...FINANCIALS.years[1]!, year })) };
  ds.textSections[ID] = SECTIONS;
  ds.contact[ID] = { lassoId: ID, phone: COMPANY.phone, email: COMPANY.email, website: COMPANY.website, address: ADDRESS, source: "CVR" };
  ds.timeline[ID] = { lassoId: ID, events: [1, 2, 3, 4].map((i) => ({ date: `202${i}-04-15`, title: `Årsrapport 202${i} offentliggjort`, category: "Regnskab" })) };
  return ds;
}

test("LassoView: hver oplysning om identiteten står én gang på overblik, kontakt og risiko", () => {
  const ds = dataset();
  for (const focus of ["overblik", "kontakt", "risiko"] as const) {
    const spec = composeCompany(ID, ds, { focus, followUps: false });
    const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { drillDown: true }, onAction: () => {} }));
    const t = text(html);
    // Jakob 01.10: adressen er ikke i oplysningernes rækkefølge; den står kun i kontaktblokken.
    assert.ok(count(t, "Prøvevej 1") <= 1, `${focus}: adressen`);
    assert.equal(count(t, "99000001"), 1, `${focus}: CVR-nummeret`);
    // Overblikket viser oplysninger kompakt (rows 6, Paper 23.3 B3); rækkerne efter de 6 står under "Se alle oplysninger".
    const once = (n: number, what: string) => (focus === "overblik" ? assert.ok(n <= 1, `${focus}: ${what} ${n} gange`) : assert.equal(n, 1, `${focus}: ${what}`));
    once(count(t, "Opførelse af bygninger"), "branchen");
    once(count(t, "01.04.1998"), "stiftelsesdatoen");
    // G9 (Jakob 29.09): hovedet viser kun navnet; identiteten står i nøgle-værdi-listen, adressen én gang.
    assert.doesNotMatch(html, /lasso-company__facts/, focus);
  }
  // Overblikket: telefonen står i kontaktblokken, ikke også i listen, og analysens kilde én gang.
  const overblik = renderToStaticMarkup(createElement(LassoView, { spec: composeCompany(ID, ds, { followUps: false }), dataset: ds, host: {}, onAction: () => {} }));
  assert.equal(count(text(overblik), "eksempelbyg.dk"), 2, "e-mail og web, hver én gang");
  assert.equal(count(overblik, "Kilde: Lasso regnskabsanalyse"), 0, "12.1: ingen kildevisning");
  // 24/25/26g: i portalens sideskabelon (embedded) ingen rammeheader og ingen handlingslinje nederst.
  const spec = composeCompany(ID, ds, { followUps: false });
  const framed = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { save: true }, onAction: () => {} }));
  // MCP-rammen (Jakob 30.09): virksomhedens navn i hovedet er øverst; rammens eget hoved (logo, område, datastempel) er væk.
  assert.doesNotMatch(framed, /lasso-frame__header|lasso-frame__eyebrow|Data hentet/);
  assert.match(framed, /<h2 class="lasso-company__name"[^>]*>/);
  const embedded = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { save: true }, onAction: () => {}, embedded: true }));
  assert.doesNotMatch(embedded, /lasso-frame__header|lasso-frame__eyebrow|lasso-badge--demo/);
  assert.doesNotMatch(embedded, /lasso-actionbar|Gem visning/);
});

/* ---------- Spørgsmålets data pr. element: only, year, rows, roles, role, kinds ---------- */

test("Regnskab med only og year: kun de spurgte nøgletal for det spurgte år; findes året ikke, seneste år med en note", () => {
  const html = renderToStaticMarkup(createElement(KeyValueList, { financials: FINANCIALS, variant: "financials", only: ["soliditetsgrad", "egenkapital"], year: 2024 }));
  assert.deepEqual(labels(html), ["Regnskabsperiode", "Regnskab udgivet", "Soliditetsgrad", "Egenkapital"]);
  assert.match(html, /aria-selected="true"[^>]*class="lasso-tab is-on"[^>]*>2024<\/button>/);
  assert.match(html, /01\.01 – 31\.12/);
  assert.doesNotMatch(text(html), /intet offentliggjort regnskab for/);
  const missing = renderToStaticMarkup(createElement(KeyValueList, { financials: FINANCIALS, variant: "financials", only: ["omsaetning"], year: 2019 }));
  assert.match(text(missing), /Kilde: regnskabet for 2025; der er intet offentliggjort regnskab for 2019/);
  // Kortene på siden: listen udelader stadig deres nøgletal.
  const both = renderToStaticMarkup(createElement(KeyValueList, { financials: FINANCIALS, variant: "financials", only: ["soliditetsgrad", "egenkapital"], exclude: ["egenkapital"] }));
  assert.deepEqual(labels(both), ["Regnskabsperiode", "Regnskab udgivet", "Soliditetsgrad"]);
});

test("Virksomhedsoplysninger med rows: kun revisor, revisorskift og regnskabsperiode; uden revisor siger den tomme tilstand det", () => {
  const html = renderToStaticMarkup(
    createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", title: "Revisor", hideIdentity: true, rows: ["revisor", "revisorskift", "regnskabsperiode"] }),
  );
  assert.deepEqual(labels(html), ["Revisor", "Seneste revisorskift", "Regnskabsperiode"]);
  assert.match(html, /Eksempel Revision Midt ApS/);
  const none = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, variant: "company", hideIdentity: true, rows: ["revisor", "revisorskift"] }));
  assert.match(text(none), /ikke registreret en revisor/);
});

test("LassoView: personliste med roles, personroller med role og tidslinje med kinds", () => {
  const ds = emptyDataset("demo");
  ds.people[ID] = [
    { name: "Anne Eksempel", role: "Adm. direktør", from: "2015-01-01" },
    { name: "Bo Eksempel", role: "Bestyrelsesformand", from: "2012-05-01" },
  ];
  ds.timeline[ID] = { lassoId: ID, events: [{ date: "2024-03-15", title: "Carla Prøve er indtrådt", category: "Ledelse" }, { date: "2025-04-15", title: "Årsrapport 2024 offentliggjort", category: "Regnskab" }] };
  const PID = "CVR-3-4000000002";
  ds.persons[PID] = {
    lassoId: PID,
    name: "Bo Eksempel",
    roles: [
      { companyId: ID, companyName: "Eksempel Byg A/S", kind: "board", role: "Bestyrelsesformand", from: "2012-05-01", active: true },
      { companyId: "CVR-1-99000010", companyName: "Eksempel Holding ApS", kind: "direction", role: "Direktør", from: "2005-01-01", active: true },
    ],
  };
  const spec = {
    version: 2 as const,
    kind: "custom" as const,
    title: "x",
    layout: "stack" as const,
    criteria: [],
    components: [
      { type: "LassoPersonList" as const, company: ID, show: "current" as const, roles: "direktion" as const },
      { type: "LassoTimeline" as const, company: ID, kinds: ["ledelse" as const] },
      { type: "LassoTimeline" as const, company: ID, kinds: ["status" as const] },
      { type: "LassoPersonRoles" as const, person: PID, show: "current" as const, role: "bestyrelse" as const },
    ],
  };
  const html = text(renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: {}, onAction: () => {} })));
  assert.match(html, /Direktion[\s\S]*?Anne Eksempel/);
  assert.doesNotMatch(html, /Bo Eksempel \(formand\)/);
  assert.match(html, /Ledelsesændringer .*Carla Prøve er indtrådt/);
  assert.doesNotMatch(html, /Årsrapport 2024 offentliggjort/);
  assert.match(html, /Statusændringer .*Ingen statusændringer registreret\./);
  assert.match(html, /Bestyrelsesposter[\s\S]*?Eksempel Byg A\/S/);
  assert.doesNotMatch(html, /Eksempel Holding ApS/);
});

test("12.1 (Jakob 01.10): 'Vis mere' kun med mindst 50 % mere at vise; hvert klik viser 50 % mere", () => {
  assert.equal(revealOf(500, 440), 500, "under 50 % tilbage: hele teksten");
  assert.equal(revealOf(660, 440), 440, "præcis 50 % tilbage: Vis mere");
  assert.equal(revealOf(2000, 660), 660);
  assert.equal(revealOf(1200, 990), 1200);
});
