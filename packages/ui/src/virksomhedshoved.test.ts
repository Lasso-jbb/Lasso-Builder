import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, viewSpecSchema, type CompanyVM, type ContactPersonsVM, type ContactVM, type FinancialsVM, type ObservationsVM, type PersonVM } from "@lasso/spec";
import { CompanyHead } from "./components/CompanyHead.js";
import { PersonHead } from "./components/PersonHead.js";
import { HeadActions } from "./components/HeadActions.js";
import { SidePanel, SidePanelList } from "./components/SidePanel.js";
import { CompanyColumn } from "./components/LassoContactPersons.js";
import { LassoContactPersons } from "./components/LassoContactPersons.js";
import { LassoContact, liveState } from "./components/LassoContact.js";
import { Shortcuts } from "./components/Shortcuts.js";
import { KeyFigureCards } from "./components/KeyFigureCards.js";
import { KeyValueList } from "./components/KeyValueList.js";
import { PersonRisk } from "./components/PersonRisk.js";
import { ModuleBar } from "./components/ModuleBar.js";
import { LassoView } from "./LassoView.js";
import { personRolesCsv } from "./csv.js";

const noop = () => undefined;
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const byg: CompanyVM = { lassoId: "CVR-1-99000001", cvr: "99000001", name: "Eksempel Byg A/S", status: "Aktiv", statusKind: "active", form: "A/S", founded: "1998-04-01", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg" }, employees: 64, industryText: "Opførelse af bygninger" };
const energi: CompanyVM = { lassoId: "CVR-1-99000011", cvr: "99000011", name: "Eksempel Energi A/S", status: "Under konkurs", statusKind: "warning", statusDate: "2026-06-03", curator: "Advokat Eksempel & Co.", secondaryNames: ["Eksempel Vind"], form: "A/S", address: { city: "Esbjerg" } };
const cafe: CompanyVM = { lassoId: "CVR-1-99000009", cvr: "99000009", name: "Eksempel Café I/S", status: "Ophørt", statusKind: "inactive", statusDate: "2024-09-30", address: { city: "Skanderborg" } };

/* ---------- 08.1 Virksomhedshoved ---------- */

test("08.1: handlinger som 32 px ikonknapper i rækkefølgen Overvåg, Gem, Eksportér, Flere; aldrig fyldte knapper", () => {
  const out = html(
    h(CompanyHead, {
      company: byg,
      actions: { monitor: { monitoring: false, onClick: noop }, save: { saved: false, onClick: noop }, exportItems: [{ id: "pdf", label: "Virksomhedsrapport (PDF)" }], more: [{ id: "link", label: "Kopiér link" }] },
    }),
  );
  const order = [...new Set([...out.matchAll(/aria-label="(Overvåg|Gem på din liste|Virksomhedsrapport \(PDF\)|Flere handlinger)"/g)].map((m) => m[1]))];
  assert.deepEqual(order, ["Overvåg", "Gem på din liste", "Virksomhedsrapport (PDF)", "Flere handlinger"]);
  assert.match(out, /class="lasso-headbtn lasso-headbtn--monitor" aria-pressed="false"/);
  assert.doesNotMatch(out, /lasso-btn--primary/);
  // G9 (Jakob 29.09): navnet står alene; ingen faktalinje og ingen skillestreg under hovedet.
  assert.doesNotMatch(out, /lasso-company__facts|CVR 99000001/);
  assert.doesNotMatch(out, /·/);
});

test("08.1: Overvåger er samme knap i valgt tilstand (aria-pressed, udfyldt ikon), med ord i varianten med ord", () => {
  const out = html(h(HeadActions, { labels: true, monitor: { monitoring: true, onClick: noop }, save: { saved: true, onClick: noop }, exportItems: [{ id: "pdf", label: "PDF" }] }));
  assert.match(out, /lasso-headbtn--monitor is-on lasso-headbtn--label" aria-pressed="true"[^>]*><svg[^>]*fill="currentColor"[^>]*>.*<span>Overvåger<\/span>/);
  // Varianten med ord: Eksportér, Gem, Overvåger (den vigtigste yderst til højre).
  assert.deepEqual([...out.matchAll(/<span>(Eksportér|Gemt|Overvåger)<\/span>/g)].map((m) => m[1]), ["Eksportér", "Gemt", "Overvåger"]);
});

test("08.1: konkurs med dato i mørk rød og binavn i muted; ingen faktalinje (G9)", () => {
  const out = html(h(CompanyHead, { company: energi }));
  assert.match(out, /lasso-company__status--warning">Under konkurs, siden 03\.06\.2026</);
  assert.match(out, /lasso-company__alias">Binavn: Eksempel Vind</);
  assert.doesNotMatch(out, /kurator: Advokat Eksempel/);
});

test("08.1: ophørt har ingen Overvåg; handlingen er 'Se historik'", () => {
  const out = html(h(CompanyHead, { company: cafe, actions: { monitor: { monitoring: false, onClick: noop }, save: { saved: false, onClick: noop } }, onHistory: noop }));
  assert.doesNotMatch(out, /lasso-headbtn--monitor/);
  assert.match(out, />Se historik</);
  assert.match(out, /Ophørt 30\.09\.2024/);
});

test("08.1/30: kompakt 56 px og linje 40 px", () => {
  const compact = html(h(CompanyHead, { company: byg, variant: "compact", actions: { monitor: { monitoring: false, onClick: noop }, save: { saved: false, onClick: noop } } }));
  assert.match(compact, /<header class="lasso-headcompact/);
  assert.doesNotMatch(compact, /CVR 99000001|64 ansatte/, "G9: kun navnet");
  assert.match(compact, /lasso-headbtn--monitor/);
  assert.doesNotMatch(compact, /lasso-headbtn--save/, "kompakt: kun Overvåg");
  const line = html(h(CompanyHead, { company: byg, variant: "line" }));
  assert.match(line, /<header class="lasso-headline/);
  assert.doesNotMatch(line, /lasso-headline__facts/, "30.1/G9: kun navnet");
  assert.doesNotMatch(line, /lasso-headactions/);
  const ceased = html(h(CompanyHead, { company: cafe, variant: "compact", onHistory: noop }));
  assert.match(ceased, /is-ceased/);
  assert.match(ceased, /Se historik/);
});

const obs = (sev: (0 | 25 | 50 | 100)[]): ObservationsVM => ({ lassoId: byg.lassoId, observations: sev.map((severity, i) => ({ id: `o${i}`, severity, title: i === 0 ? "Soliditetsgrad 17,3 % er under branchemedianen på 34 %" : `Observation ${i}` })) });

test("24.4: 'Se risiko'-linjen kun ved en observation på 50+, med ikon, ord og link", () => {
  assert.doesNotMatch(html(h(CompanyHead, { company: byg, risk: obs([25, 0]) })), /lasso-headrisk/);
  const out = html(h(CompanyHead, { company: byg, risk: obs([50, 25, 25]), onSeeRisk: noop }));
  assert.match(out, /1 mulig vigtig observation: soliditetsgrad 17,3 % er under branchemedianen på 34 %\. 2 til orientering\./);
  assert.match(out, /lasso-sev-icon--50/);
  assert.match(out, />Se risiko</);
  assert.match(html(h(CompanyHead, { company: byg, risk: obs([100]) })), /1 vigtig observation/);
});

test("08.2: sektionsfaner under hovedet via LassoView.headTabs", () => {
  const ds = emptyDataset("demo");
  ds.companies[byg.lassoId] = byg;
  const spec = viewSpecSchema.parse({ kind: "company", title: "X", components: [{ type: "LassoCompanyHead", company: byg.lassoId }] });
  const out = html(h(LassoView, { spec, dataset: ds, host: {}, onAction: noop, headTabs: { items: [{ id: "a", label: "Overblik" }, { id: "b", label: "Nøgletal" }], value: "a", onChange: noop } }));
  const head = out.slice(out.indexOf('<header class="lasso-company'));
  assert.match(head.slice(0, head.indexOf("</header>")), /role="tablist"/);
});

test("LassoView: Overvåg og Eksportér i hovedet efter værtens kapabiliteter", () => {
  const ds = emptyDataset("demo");
  ds.companies[byg.lassoId] = byg;
  ds.monitoredIds = [byg.lassoId];
  const spec = viewSpecSchema.parse({ kind: "company", title: "X", components: [{ type: "LassoCompanyHead", company: byg.lassoId }] });
  const none = html(h(LassoView, { spec, dataset: ds, host: {}, onAction: noop }));
  assert.doesNotMatch(none, /lasso-headbtn/);
  const all = html(h(LassoView, { spec, dataset: ds, host: { monitor: true, savePage: true, export: true, refresh: true }, onAction: noop }));
  assert.match(all, /lasso-headbtn--monitor is-on" aria-pressed="true"/);
  // Ét eksportformat (PDF-rapporten): direkte knap; flere formater giver menuen "Eksportér".
  assert.match(all, /class="lasso-headbtn lasso-headbtn--export" aria-label="Virksomhedsrapport \(PDF\)"/);
  // Opdatér flytter ind under "…" i hovedet; rammens footer gentager den ikke.
  assert.doesNotMatch(all.slice(all.indexOf('<footer class="lasso-actionbar"')), /Opdatér/);
});

/* ---------- 16.1 Personhoved ---------- */

const bo: PersonVM = {
  lassoId: "CVR-3-4000000002",
  name: "Bo Eksempel",
  city: "Silkeborg",
  roles: [{ companyId: "CVR-1-99000001", companyName: "Eksempel Byg A/S", role: "Bestyrelsesformand", kind: "board", from: "2012-05-01", active: true }],
  pep: { match: false, checkedAt: "2026-09-25" },
  strawman: { level: "possible", detail: "Direktør i 3 selskaber uden ejerskab (eksempel)." },
};

test("16.1: kun navnet og handlingerne; intet 'Person', ingen faktalinje, tællerlinje eller observationslinje", () => {
  const out = html(h(PersonHead, { person: bo, actions: { monitor: { monitoring: false, onClick: noop }, save: { saved: false, onClick: noop } }, onSeeRisk: noop, riskLine: true }));
  assert.match(out, /lasso-company__name">Bo Eksempel</);
  assert.match(out, /lasso-headbtn--monitor/);
  assert.doesNotMatch(out, /lasso-personhead__kind|lasso-personhead__obs|lasso-personhead__facts|lasso-personhead__counts|lasso-personhead__mobsub|Silkeborg/);
  assert.doesNotMatch(out, /lasso-headrisk/);
  assert.doesNotMatch(out, /initial|avatar/);
});

test("16.4: personrisiko som fire fliser: PEP, stråmand, konkurser i netværket, sanktionslister", () => {
  const out = html(h(PersonRisk, { person: bo, onUpgrade: noop }));
  const titles = [...out.matchAll(/lasso-personrisk__title">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(titles, ["PEP, politisk eksponeret", "Stråmandsindikator", "Konkurser i netværket", "Sanktionslister"]);
  assert.match(out, /tjekket 25\.09\.2026/);
  assert.match(out, /lasso-personrisk__item--locked[^]*>Opgrader</);
  assert.match(out, /lasso-personrisk__word--50">Mulig</);
  // Uden opslag: "Ikke tjekket", aldrig "Nej".
  const unknown = html(h(PersonRisk, { person: { ...bo, pep: undefined, strawman: undefined } }));
  assert.match(unknown, /Ikke tjekket/);
  assert.match(unknown, /Ikke beregnet/);
});

/* ---------- 08.4 Genveje ---------- */

test("08.4: højst seks genveje med koral ikon; resten under 'Flere'", () => {
  const items = ["A", "B", "C", "D", "E", "F", "G"].map((x) => ({ id: x, label: `Værktøj ${x}`, icon: "trend" as const, onSelect: noop }));
  const out = html(h(Shortcuts, { items }));
  assert.equal((out.match(/class="lasso-shortcut"/g) ?? []).length, 6);
  assert.match(out, /lasso-shortcut lasso-shortcut--more/);
  assert.match(out, /lasso-shortcut__icon/);
});

/* ---------- 08.5 Live-nummer ---------- */

test("08.5: live-tilstande: nu (60 sek.), N dage siden, udgået; nummeret vises altid", () => {
  const now = Date.parse("2026-09-29T10:00:00Z");
  assert.deepEqual(liveState("2026-09-29T09:59:30Z", undefined, now), { kind: "now" });
  assert.deepEqual(liveState("2026-09-29T09:58:00Z", undefined, now), { kind: "stale", days: 0 });
  assert.deepEqual(liveState("2026-09-26", undefined, now), { kind: "stale", days: 3 });
  assert.deepEqual(liveState("2026-09-26", "2026-08-12", now), { kind: "expired", date: "2026-08-12" });
  const contact: ContactVM = {
    lassoId: byg.lassoId,
    phone: "71747812",
    email: "kontakt@eksempel.dk",
    verifiedAt: "2026-09-29T09:59:40Z",
    verifiedNumbers: [
      { phoneNumber: "71747812", callable: true, sources: ["CVR"] },
      { phoneNumber: "33123456", callable: false, sources: ["Website"], expired: "2026-08-12" },
    ],
  };
  const out = html(h(LassoContact, { contact, now, onCopy: noop, foldExtra: false }));
  assert.match(out, /Verificeret nu/);
  assert.match(out, /lasso-contact__value--struck">33 12 34 56</);
  assert.match(out, /Udgået, 12\.08\.2026/);
  assert.match(out, />Kopiér</);
  const stale = html(h(LassoContact, { contact: { ...contact, verifiedAt: "2026-09-26" }, now, foldExtra: false }));
  // 08.3 (standard): ekstra numre foldes bag "Se N telefonnumre".
  assert.match(html(h(LassoContact, { contact, now })), />Se 1 telefonnummer</);
  assert.match(stale, /Verificeret for 3 dage siden/);
  // Uden verifikation: handlingen "Ring" i stedet for en tilstand.
  assert.match(html(h(LassoContact, { contact: { lassoId: byg.lassoId, phone: "71747812" }, now })), /aria-label="Ring"/);
});

/* ---------- 08.6/08.7 Kontaktpersoner og "Se alle"-panelet ---------- */

const people: ContactPersonsVM = {
  lassoId: byg.lassoId,
  people: [
    { name: "Sofie Eksempel", role: "Salgschef", phone: "00000000", email: "a@eksempel.dk" },
    { name: "Mikkel Eksempel", role: "CTO", email: "b@eksempel.dk" },
    { name: "Jakob Eksempel", role: "CEO", phone: "00000001", email: "c@eksempel.dk", linkedin: "https://www.linkedin.com/in/eksempel", sources: [{ label: "CVR", text: "registreret direktør", date: "2012-05-14" }] },
    { name: "Anders Eksempel", role: "Key Account Manager", phone: "00000002" },
    { name: "Camilla Eksempel", role: "Økonomichef" },
  ],
  source: "Eksempeldata",
  updated: "2026-09-25",
};

test("08.6: blokken viser 3 (Direktion først) + 'Se N kontaktpersoner', der åbner panelet (ingen udfoldning på stedet)", () => {
  const out = html(h(LassoContactPersons, { data: people }));
  const names = [...out.matchAll(/lasso-row__name">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(names, ["Jakob Eksempel", "Camilla Eksempel", "Sofie Eksempel"]);
  assert.match(out, /aria-haspopup="dialog"[^>]*>Se 5 kontaktpersoner</);
  assert.doesNotMatch(out, /aria-expanded/);
  assert.doesNotMatch(out, /lasso-contactpersons__icon--muted/, "G2: intet ikon, når kanalen mangler");
});

test("08.7: panelet grupperer stillinger pr. afdeling, markerer den valgte og viser kopiér-handlinger og kilder", () => {
  const out = html(h(LassoContactPersons, { data: people, companyName: "Eksempel Byg A/S", onCopy: noop, defaultOpen: 0 }));
  assert.match(out, /role="dialog" aria-modal="true"/);
  assert.match(out, /lasso-sidepanel--seeall/);
  assert.match(out, /lasso-sidepanel__subtitle">5 personer</);
  const groups = [...out.matchAll(/lasso-panellist__label">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(groups, ["Direktion", "Ledelse", "Salg", "IT-udvikling"]);
  // Listen viser stillingen (Paper L8Z-0); navnet står i detaljen.
  const rows = [...out.matchAll(/lasso-panellist__name">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(rows.slice(0, 2), ["CEO", "Økonomichef"]);
  assert.match(out, /lasso-panellist__row is-selected" aria-current="true"/);
  assert.match(out, /Kopiér telefonnummer/);
  assert.match(out, /Kopiér e-mailadresse/);
  // Ingen Ring/Skriv/LinkedIn og ingen kildebeskrivelse, CVR-linje eller "Opdateret" (08.11, G3).
  assert.doesNotMatch(out, /LinkedIn|>Ring<|>Skriv<|registreret direktør|lasso-cpdetail__updated|lasso-cpdetail__sourcetext/);
  assert.match(out, /lasso-sidepanel__close" aria-label="Luk"/);
  // Uden kopiér-handling (G1): kun værdien, ingen knap.
  const plain = html(h(LassoContactPersons, { data: people, defaultOpen: 0 }));
  assert.doesNotMatch(plain, /lasso-cpdetail__copy"/);
  assert.match(plain, /lasso-cpdetail__plain/);
});

test("08.7: virksomhedskolonnen med Live Nummer, telefonnumre, e-mailadresser og genveje kun med funktion", () => {
  const contact = { lassoId: byg.lassoId, phone: "71747812", email: "kontakt@lasso.dk", emails: ["contact@lassox.com"], website: "https://lassox.com", verifiedNumbers: [{ phoneNumber: "71747812", score: 95 }] };
  const out = html(h(CompanyColumn, { company: byg, contact, shortcuts: [{ id: "nyheder", label: "Nyheder", icon: "news", onSelect: noop }] }));
  assert.match(out, /Live Nummer/);
  assert.match(out, />Telefonnumre</);
  assert.match(out, /kontakt@lasso\.dk.*contact@lassox\.com/s);
  assert.match(out, />Nyheder</);
  assert.doesNotMatch(out, /Se detaljer/, "G1: uden handling intet link");
  assert.match(html(h(CompanyColumn, { company: byg, contact, onLiveDetails: noop })), /Se detaljer/);
  const panel = html(h(SidePanel, { open: true, variant: "seeall", title: "Kontaktpersoner", onClose: noop, list: "liste", aside: "Virksomhed" }));
  assert.match(panel, /lasso-sidepanel--seeall lasso-sidepanel--aside/);
});

test("SidePanel: lukket tegnes intet; kun liste uden detalje; 'Vis N flere' efter grænsen", () => {
  assert.equal(html(h(SidePanel, { open: false, title: "X", onClose: noop, list: "liste" })), "");
  const listOnly = html(h(SidePanel, { open: true, title: "P-enheder", onClose: noop, list: h(SidePanelList, { groups: [{ items: Array.from({ length: 10 }, (_, i) => ({ id: String(i), title: `Enhed ${i}` })) }], onSelect: noop, limit: 4 }) }));
  assert.match(listOnly, /lasso-sidepanel--list-only/);
  assert.equal((listOnly.match(/lasso-panellist__row/g) ?? []).length, 4);
  assert.match(listOnly, /Vis 6 flere/);
});

/* ---------- 09 Nøgletalskort og nøgle-værdi-liste ---------- */

const fin: FinancialsVM = {
  lassoId: byg.lassoId,
  currency: "DKK",
  years: [2023, 2024, 2025].map((year, i) => ({ year, grossProfit: 10_000_000 + i * 1_000_000, profit: 1_000_000, equity: 5_000_000 + i * 100_000, employees: 17 + i })),
  benchmark: { change: { bruttofortjeneste: 3.1 } },
  quality: { ansatte: "Ansatte i regnskabet afviger fra CVR (eksempel)." },
};

test("09.1: kun pil + procent (ingen \"fra ÅÅÅÅ\", ingen branche-procent) og kvalitetsflag med tooltip, aldrig som pille", () => {
  const out = html(h(KeyFigureCards, { financials: fin, metrics: ["bruttofortjeneste", "ansatte"] }));
  assert.match(out, /lasso-kpi__delta"><span class="lasso-up"><span class="lasso-arrow">▲<\/span> 9,1 %<\/span><\/div>/);
  assert.doesNotMatch(out, /branche|lasso-kpi__year/);
  assert.match(out, /class="lasso-qflag__btn" aria-label="Mulig fejl: Ansatte i regnskabet afviger fra CVR \(eksempel\)\."/);
  assert.match(out, /role="tooltip"[^>]*>Ansatte i regnskabet afviger/);
});

test("09.2: info-ikon ved begreber og handlingslinks med ikon", () => {
  const out = html(h(KeyValueList, { financials: fin, variant: "financials", links: [{ label: "Se hele regnskabet", icon: "document", onClick: noop }] }));
  assert.match(out, /aria-label="Hvad er soliditetsgrad\?"/);
  assert.doesNotMatch(out, /Hvad er regnskab udgivet/);
  assert.match(out, /class="lasso-kv-link"><svg[^>]*>.*?<\/svg><span>Se hele regnskabet<\/span>/);
});

/* ---------- 24.3 Modulbjælke ---------- */

test("24.3: modulbjælkens handling med punkter åbner en menu (Eksportér ▾)", () => {
  const out = html(h(ModuleBar, { modules: [{ id: "o", label: "Overblik" }], value: "o", onChange: noop, actions: [{ id: "x", label: "Eksportér", items: [{ id: "csv", label: "Tal som CSV" }] }, { id: "g", label: "Gem" }, { id: "m", label: "Overvåg", tone: "accent" }] }));
  assert.match(out, /aria-haspopup="menu"[^>]*>.*Eksportér/);
  assert.equal((out.match(/lasso-modulebar__action/g) ?? []).length >= 3, true);
});

test("16.1: personens roller som CSV til Eksportér i personhovedet (uden adresse)", () => {
  const csv = personRolesCsv({ lassoId: "CVR-3-1", name: "Test Person", city: "Aarhus", roles: [{ companyName: "Eksempel A/S", cvr: "1", kind: "direction", role: "Direktør", from: "2020-01-01", active: true }] } as PersonVM);
  assert.match(csv, /Selskab;CVR;Rolle/);
  assert.match(csv, /Eksempel A\/S;1;Direktør;;2020-01-01;;Ja/);
  assert.doesNotMatch(csv, /Aarhus/);
});
