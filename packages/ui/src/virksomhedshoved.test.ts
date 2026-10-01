import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, viewSpecSchema, type CompanyVM, type ContactPersonsVM, type ContactVM, type FinancialsVM, type ObservationsVM, type PersonVM } from "@lasso/spec";
import { CompanyHead } from "./components/CompanyHead.js";
import { PersonHead } from "./components/PersonHead.js";
import { HeadActions } from "./components/HeadActions.js";
import { SidePanel, SidePanelList } from "./components/SidePanel.js";
import { CompanyColumn } from "./components/LassoContactPersons.js";
import { LassoContactPersons } from "./components/LassoContactPersons.js";
import { contactChannelItems, LassoContact, liveState } from "./components/LassoContact.js";
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

test("08.1: konkurs med dato i mørk rød; intet binavn og ingen faktalinje (G9, kontrol r5 08.8)", () => {
  const out = html(h(CompanyHead, { company: energi }));
  assert.match(out, /lasso-company__status--warning">Under konkurs, siden 03\.06\.2026</);
  assert.doesNotMatch(out, /Binavn/);
  assert.doesNotMatch(out, /kurator: Advokat Eksempel/);
});

test("Runde 6: status i hovedet kun ved afvigelse (Aktiv/Normal = navnet alene), i farvegruppen, i alle varianter", () => {
  const variants = ["full", "compact", "line"] as const;
  for (const variant of variants) {
    for (const status of ["Aktiv", "Normal", "NORMAL"]) {
      const out = html(h(CompanyHead, { company: { ...byg, status }, variant }));
      assert.doesNotMatch(out, /lasso-company__status|lasso-headcompact__status/, `${variant}/${status}: navnet står alene`);
    }
    const cases: [string, string][] = [
      ["Under konkurs", "warning"],
      ["Tvangsopløst", "warning"],
      ["Under frivillig likvidation", "liquidation"],
      ["Fremtid", "liquidation"],
      ["Ophørt", "inactive"],
      ["Slettet", "inactive"],
    ];
    for (const [status, tone] of cases) {
      const out = html(h(CompanyHead, { company: { ...byg, status, statusKind: undefined }, variant }));
      assert.match(out, new RegExp(`lasso-company__status--${tone}">${status}<`), `${variant}/${status}`);
      // Status efter navnet.
      assert.ok(out.indexOf(status) > out.indexOf("Eksempel Byg A/S"));
    }
  }
  // Personhovedet har ingen status (kun navnet) i alle varianter.
  for (const variant of variants) {
    const out = html(h(PersonHead, { person: { id: "CVR-3-1", name: "Bo Eksempel", roles: [] } as unknown as PersonVM, variant }));
    assert.doesNotMatch(out, /Aktiv|__status/);
  }
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

test("G9 (kontrol r5, 30.3): ingen observationslinje under navnet, heller ikke ved observationer på 50+", () => {
  assert.doesNotMatch(html(h(CompanyHead, { company: byg, risk: obs([25, 0]) })), /lasso-headrisk/);
  const out = html(h(CompanyHead, { company: byg, risk: obs([50, 25, 25]), onSeeRisk: noop }));
  assert.doesNotMatch(out, /lasso-headrisk|Se risiko/);
  assert.doesNotMatch(html(h(CompanyHead, { company: byg, risk: obs([100]) })), /vigtig observation/);
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

test("08.5: kun udgåede numre markeres (ingen verificeringsnoter); nummeret vises altid", () => {
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
  // Jakob 01.10: verificeringsnoterne ("Verificeret nu", "for N dage siden") vises ikke.
  assert.doesNotMatch(out, /Verificeret/);
  assert.match(out, /lasso-contact__value--struck">33 12 34 56</);
  assert.match(out, /Udgået, 12\.08\.2026/);
  assert.match(out, />Kopiér</);
  const stale = html(h(LassoContact, { contact: { ...contact, verifiedAt: "2026-09-26" }, now, foldExtra: false }));
  // 08.3 (standard): flere numre åbner "Se flere"-panelet; N er alle forskellige numre (som "Se N kontaktpersoner").
  assert.match(html(h(LassoContact, { contact, now })), />Se alle 2</);
  assert.doesNotMatch(stale, /Verificeret/);
  // Uden verifikation: handlingen "Ring" i stedet for en tilstand.
  assert.match(html(h(LassoContact, { contact: { lassoId: byg.lassoId, phone: "71747812" }, now })), /aria-label="Ring"/);
});

/* ---------- 08.6/08.7 Kontaktpersoner og "Se alle"-panelet ---------- */

const people: ContactPersonsVM = {
  lassoId: byg.lassoId,
  people: [
    { name: "Sofie Eksempel", role: "Salgschef", phone: "00000000", email: "a@eksempel.dk" },
    { name: "Mikkel Eksempel", role: "CTO", email: "b@eksempel.dk" },
    { name: "Jakob Eksempel", role: "CEO", phone: "00000001", email: "c@eksempel.dk", linkedin: "https://www.linkedin.com/in/eksempel", sources: [{ label: "CVR", text: "registreret direktør", date: "2012-05-14" }, { label: "Web", url: "https://eksempel.dk/om" }] },
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

test("08.7: panelet (Se flere, 2/3) grupperer stillinger pr. afdeling, markerer den valgte og viser kopiér og kilder", () => {
  const out = html(h(LassoContactPersons, { data: people, companyName: "Eksempel Byg A/S", onCopy: noop, defaultOpen: 0 }));
  assert.match(out, /role="dialog"/);
  assert.match(out, /lasso-sidepanel--flere/);
  assert.doesNotMatch(out, /lasso-sidepanel__scrim|lasso-sidepanel--aside/, "ingen mørk overlay og ingen kopi af virksomhedskolonnen: sidens første kolonne står synlig");
  assert.match(out, /lasso-sidepanel__subtitle">5 personer</);
  const groups = [...out.matchAll(/lasso-panellist__label">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(groups, ["Direktion", "Ledelse", "Salg", "IT-udvikling"]);
  // Listen viser stillingen (Paper L8Z-0); navnet står i detaljen.
  const rows = [...out.matchAll(/lasso-panellist__name">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(rows.slice(0, 2), ["CEO", "Økonomichef"]);
  assert.match(out, /lasso-panellist__row is-selected" aria-current="true"/);
  assert.match(out, /Kopiér telefonnummer/);
  assert.match(out, /Kopiér e-mailadresse/);
  // Kilderne vises i panelet (Jakob 01.10); stadig ingen Ring/Skriv/LinkedIn.
  assert.match(out, />Kilder</);
  assert.match(out, /CVR<\/span>, registreret direktør \(14\.05\.2012\)/);
  assert.match(out, /eksempel\.dk\/om/);
  assert.doesNotMatch(out, /LinkedIn|>Ring<|>Skriv</);
  assert.match(out, /lasso-sidepanel__close" aria-label="Luk"/);
  // Uden kopiér-handling (G1): kun værdien, ingen knap.
  const plain = html(h(LassoContactPersons, { data: people, defaultOpen: 0 }));
  assert.doesNotMatch(plain, /lasso-cpdetail__copy"/);
  assert.match(plain, /lasso-cpdetail__plain/);
});

test("08.7: virksomhedskolonnen med Live Nummer, telefonnumre, e-mailadresser og genveje kun med funktion", () => {
  const contact = { lassoId: byg.lassoId, phone: "71747812", email: "kontakt@lasso.dk", emails: ["contact@lassox.com"], website: "https://lassox.com", verifiedNumbers: [{ phoneNumber: "71747812", score: 95, callable: true, sources: ["Website"] }] };
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


/* ---------- "Se flere"-panelet for telefonnumre og e-mails (Jakob 01.10) ---------- */

test("Se flere: telefonnumre og e-mails grupperes efter kilde (Fra CVR, Fra hjemmeside, Verificeret af Lasso)", () => {
  const contact: ContactVM = {
    lassoId: "CVR-1-34580820",
    phone: "71747812",
    email: "kontakt@lasso.dk",
    website: "https://lassox.com",
    channels: [
      { kind: "phone", value: "71747812", source: "cvr" },
      { kind: "email", value: "kontakt@lasso.dk", source: "cvr" },
      { kind: "phone", value: "+45 71 74 78 12", source: "hjemmeside", url: "https://lassox.com/kontakt" },
      { kind: "email", value: "kontakt@lasso.dk", source: "hjemmeside" },
      { kind: "email", value: "contact@lassox.com", source: "hjemmeside" },
    ],
    verifiedNumbers: [{ phoneNumber: "33123456", callable: true, sources: ["Website"] }],
  };
  const phones = contactChannelItems(contact, "phone");
  assert.deepEqual(phones.map((p) => `${p.source}:${p.value}`), ["cvr:71747812", "hjemmeside:+45 71 74 78 12", "verificeret:33123456"]);
  const emails = contactChannelItems(contact, "email");
  assert.deepEqual(emails.map((e) => `${e.source}:${e.value}`), ["cvr:kontakt@lasso.dk", "hjemmeside:kontakt@lasso.dk", "hjemmeside:contact@lassox.com"]);
  // Samme nummer fra CVR og hjemmesiden tæller én gang: 2 numre og 2 adresser.
  const out = html(h(LassoContact, { contact }));
  assert.match(out, />Se alle 2</);
  assert.equal(out.match(/>Se alle 2</g)?.length, 2);
  // Kun ét nummer og én adresse: intet link (regel 9).
  const one = html(h(LassoContact, { contact: { lassoId: "CVR-1-1", phone: "71747812", email: "a@b.dk" } }));
  assert.doesNotMatch(one, /lasso-contact__more/);
  // Uden channels bygges listen af phone/email/emails.
  assert.deepEqual(contactChannelItems({ lassoId: "CVR-1-1", email: "a@b.dk", emails: ["c@b.dk"] }, "email").map((e) => e.source), ["cvr", "hjemmeside"]);
});

test("Se flere: SidePanel variant flere har ingen mørk overlay og fader ud ved luk", () => {
  const out = html(h(SidePanel, { open: true, variant: "flere", title: "Telefonnumre", onClose: noop, list: "liste", detail: "detalje" }));
  assert.match(out, /lasso-sidepanel-wrap lasso-sidepanel-wrap--flere/);
  assert.match(out, /lasso-sidepanel lasso-sidepanel--flere/);
  assert.doesNotMatch(out, /lasso-sidepanel__scrim|aria-modal/);
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /\.lasso-sidepanel\.is-closing[^{]*\{ animation: lasso-fade-out/);
  assert.match(css, /@keyframes lasso-flere-in \{ from \{ transform: translateX\(100%\); \}/);
});
