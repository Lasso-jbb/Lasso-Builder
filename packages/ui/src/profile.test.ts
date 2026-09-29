import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeCompany, emptyDataset, type CompanyVM, type ContactVM, type Dataset, type FinancialsVM, type OwnershipVM, type TextSectionsVM } from "@lasso/spec";
import { KeyValueList } from "./components/KeyValueList.js";
import { LassoContact } from "./components/LassoContact.js";
import { LassoRelations } from "./components/LassoRelations.js";
import { LassoTextSections, segmentAction } from "./components/LassoTextSections.js";
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

test("Virksomhedsoplysninger under hovedet: ingen stiftet, form, branche, ansatte eller adresse, men branchekode, kommune og region", () => {
  const html = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true, hideContact: true }));
  assert.deepEqual(labels(html), ["Revisor", "Seneste revisorskift", "Regnskabsperiode", "Branchekode", "Kommune", "Region"]);
  assert.match(html, /412000/);
  // Uden kontaktblok på siden står telefon, e-mail og web stadig her (adressen står i hovedet).
  const noContact = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true }));
  assert.deepEqual(labels(noContact).slice(-3), ["Telefon", "E-mail", "Web"]);
  assert.ok(!labels(noContact).includes("Adresse"));
  // Ejerlisten på siden viser revisoren: listen gentager den ikke.
  const withOwners = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company", hideIdentity: true, hideContact: true, hideAuditor: true }));
  assert.deepEqual(labels(withOwners), ["Regnskabsperiode", "Branchekode", "Kommune", "Region"]);
  // Uden hoved (fx en render_view-spec uden LassoCompanyHead) står identiteten i listen.
  const alone = renderToStaticMarkup(createElement(KeyValueList, { company: COMPANY, ownership: OWNERSHIP, financials: FINANCIALS, variant: "company" }));
  for (const l of ["Stiftet", "Virksomhedsform", "Branche", "Ansatte", "Adresse"]) assert.ok(labels(alone).includes(l), l);
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

test("Virksomhedsprofil (overblik): CVR-tekster uden branche plus konklusion, resultat og likviditet, én kildelinje", () => {
  const html = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS }));
  assert.deepEqual(headings(html), ["Formål", "Tegningsregler", "Regnskabsanalyse: konklusion", "Resultat", "Likviditet"]);
  assert.equal(count(html, "Kilde: Lasso regnskabsanalyse"), 1);
  assert.doesNotMatch(html, /NACE 412000/);
  // 12.1: lange afsnit foldes hver for sig, men der er ét "Vis hele" for hele sektionen.
  assert.equal(count(html, ">Vis hele<"), 1);
  assert.doesNotMatch(html, /Se hele regnskabsanalysen/);
  // Kun CVR-tekster: ingen analysekilde.
  const cvr = renderToStaticMarkup(createElement(LassoTextSections, { sections: { ...SECTIONS, sections: SECTIONS.sections.slice(0, 3) } }));
  assert.deepEqual(headings(cvr), ["Formål", "Tegningsregler"]);
  assert.doesNotMatch(cvr, /Kilde:/);
});

test("Regnskabsanalyse (oekonomi): konklusionen og ét link til hele analysen, én kildelinje, ingen CVR-tekster", () => {
  const html = renderToStaticMarkup(createElement(LassoTextSections, { sections: SECTIONS, variant: "analyse" }));
  assert.match(html, /<h3 class="lasso-section__title">Regnskabsanalyse<\/h3>/);
  assert.deepEqual(headings(html), ["Konklusion"]);
  assert.match(html, /aria-expanded="false"[^>]*>Se hele regnskabsanalysen \(7 afsnit\)<\/button>/);
  assert.equal(count(html, "Kilde: Lasso regnskabsanalyse"), 1);
  assert.doesNotMatch(html, /Formål|Tegningsregler|Branchestatistik/);
  // Ét link: konklusionen har ikke sit eget "Vis hele" ved siden af.
  assert.doesNotMatch(html, />Vis hele</);
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

test("Kontaktblok: adressen udelades, når hovedet viser den; et verificeret CVR-nummer står én gang; én kildelinje", () => {
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
  const html = renderToStaticMarkup(createElement(LassoContact, { contact, omitAddress: true }));
  assert.doesNotMatch(html, /Prøvevej 1/);
  assert.equal(count(html, "86 12 34 56"), 1);
  assert.match(html, /20 30 40 50/);
  assert.equal(count(html, "Kilde:"), 1);
  assert.match(text(html), /Kilde: CVR og Lasso live number, opdateret 20\.09\.2026/);
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
    assert.equal(count(t, "Prøvevej 1"), 1, `${focus}: adressen`);
    assert.equal(count(t, "99000001"), 1, `${focus}: CVR-nummeret`);
    assert.equal(count(t, "Opførelse af bygninger"), 1, `${focus}: branchen`);
    assert.equal(count(t, "01.04.1998"), 1, `${focus}: stiftelsesdatoen`);
    assert.ok(!labels(html).some((l) => ["Stiftet", "Virksomhedsform", "Branche", "Ansatte", "Adresse"].includes(l!)), focus);
  }
  // Overblikket: telefonen står i kontaktblokken, ikke også i listen, og analysens kilde én gang.
  const overblik = renderToStaticMarkup(createElement(LassoView, { spec: composeCompany(ID, ds, { followUps: false }), dataset: ds, host: {}, onAction: () => {} }));
  assert.equal(count(text(overblik), "eksempelbyg.dk"), 2, "e-mail og web, hver én gang");
  assert.equal(count(overblik, "Kilde: Lasso regnskabsanalyse"), 1);
  // 24/25/26g: i portalens sideskabelon (embedded) ingen rammeheader og ingen handlingslinje nederst.
  const spec = composeCompany(ID, ds, { followUps: false });
  const framed = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { save: true }, onAction: () => {} }));
  assert.match(framed, /lasso-frame__header/);
  const embedded = renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host: { save: true }, onAction: () => {}, embedded: true }));
  assert.doesNotMatch(embedded, /lasso-frame__header|lasso-frame__eyebrow|lasso-badge--demo/);
  assert.doesNotMatch(embedded, /lasso-actionbar|Gem visning/);
});
