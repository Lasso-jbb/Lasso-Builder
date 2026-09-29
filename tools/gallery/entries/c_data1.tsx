import { useState, type ReactNode } from "react";
import type { GalleryEntry } from "../types.js";
import type { CompanyVM, ContactPersonVM, ContactVM, FinancialsVM, ScoreVM } from "@lasso/spec";
import { formatAmount, formatDate, formatNumber, formatPercent, groupContactPersons } from "@lasso/spec";
import {
  CompanyHead,
  DataState,
  Delta,
  Icon,
  KeyFigureCards,
  LassoContact,
  LassoContactPersons,
  ScoreGauge,
  Section,
  SidePanel,
  SidePanelList,
  Sparkline,
  Tabs,
} from "@lasso/ui";

/* ---------- Hjælpere ---------- */

const B = "CVR-1-99000001";
const co = (title: string, components: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ kind: "company", title, components, ...extra });

function Stack({ children, gap = 28 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="lasso-small" style={{ color: "var(--lasso-text-muted)" }}>{label}</div>
      {children}
    </div>
  );
}
const noop = () => undefined;
/** Skærmbilledet tages, mens panelets 200 ms indglidning kan være i gang; slå den fra i galleriet. */
const NoAnim = () => <style>{".lasso-sidepanel{animation:none!important}"}</style>;

/* ---------- Eksempeldata til rene UI-elementer ---------- */

const BYG: CompanyVM = {
  lassoId: B,
  cvr: "99000001",
  name: "Eksempel Byg A/S",
  status: "Aktiv",
  statusKind: "active",
  form: "A/S",
  industryCode: "412000",
  industryText: "Opførelse af bygninger",
  address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" },
  founded: "1998-04-01",
  employees: 64,
};
const ENERGI: CompanyVM = {
  lassoId: "CVR-1-99000011",
  cvr: "99000011",
  name: "Eksempel Energi A/S",
  status: "Under konkurs",
  statusKind: "warning",
  statusDate: "2026-06-03",
  curator: "Advokat Eksempel & Co.",
  secondaryNames: ["Eksempel Vind"],
  form: "A/S",
  industryText: "Produktion af elektricitet",
  address: { street: "Vindvej 9", zip: "6700", city: "Esbjerg" },
  founded: "2012-08-01",
  employees: 8,
};
const CAFE: CompanyVM = {
  lassoId: "CVR-1-99000009",
  cvr: "99000009",
  name: "Eksempel Café I/S",
  status: "Ophørt",
  statusKind: "inactive",
  statusDate: "2024-09-30",
  form: "I/S",
  industryText: "Caféer og barer",
  address: { street: "Torvet 1", zip: "8660", city: "Skanderborg" },
  founded: "2015-05-01",
  employees: 0,
};
const headActions = (monitoring: boolean) => ({
  monitor: { monitoring, onClick: noop },
  save: { saved: false, onClick: noop },
  exportItems: [{ id: "pdf", label: "Eksportér som PDF", onSelect: noop }],
  more: [{ id: "share", label: "Del link", onSelect: noop }],
});

const PERSONS: ContactPersonVM[] = [
  {
    name: "Anne Eksempel",
    role: "Direktør",
    phone: "86123456",
    email: "anne@eksempelbyg.dk",
    phoneNote: "Direkte, eksempelnummer",
    emailNote: "Eksempeladresse",
    linkedin: "https://www.linkedin.com/in/eksempel",
    sources: [
      { label: "eksempelbyg.dk/om-os", url: "https://eksempelbyg.dk/om-os", text: "rolle og navn", date: "2026-09-20" },
      { label: "CVR", text: "registreret direktør", date: "2015-01-01" },
    ],
  },
  { name: "Bo Eksempel", role: "Bestyrelsesformand", phone: "86123457", sources: [{ label: "CVR", text: "registreret bestyrelsesformand", date: "2012-05-01" }] },
  { name: "Carla Prøve", role: "Bestyrelsesmedlem", email: "carla@eksempelbyg.dk" },
  { name: "Dan Prøve", role: "Salgschef" },
  { name: "Eva Prøve", role: "Økonomichef", phone: "86123458", email: "eva@eksempelbyg.dk" },
  { name: "Frank Eksempel", role: "Projektleder", phone: "86123459", email: "frank@eksempelbyg.dk" },
  { name: "Gustav Prøve", role: "Key Account Manager", phone: "86123460", email: "gustav@eksempelbyg.dk" },
  { name: "Hanne Eksempel", role: "CTO", group: "IT-udvikling", email: "hanne@eksempelbyg.dk" },
] as ContactPersonVM[];
const PERSONS_DATA = { lassoId: B, people: PERSONS, source: "Eksempeldata", updated: "2026-09-20" };

/* 08.7–08.11: Papers eksempel (L75-0): LASSO X A/S med 16 kontaktpersoner i seks afdelinger. */
const LASSO_X: CompanyVM = {
  lassoId: "CVR-1-34580820",
  cvr: "34580820",
  name: "LASSO X A/S",
  status: "Aktiv",
  statusKind: "active",
  form: "A/S",
  address: { street: "Toldbodgade 37B", zip: "1253", city: "København K" },
  founded: "2012-07-01",
  employees: 16,
};
const LASSO_X_CONTACT: ContactVM = {
  lassoId: "CVR-1-34580820",
  phone: "71747812",
  email: "kontakt@lasso.dk",
  emails: ["contact@lassox.com"],
  website: "https://lassox.com",
  address: LASSO_X.address,
  verifiedNumbers: [{ phoneNumber: "71747812", score: 95, callable: true }],
  verifiedAt: "2026-09-20",
};
const src = [{ label: "lassox.com", url: "https://lassox.com/om-os/lasso-x" }];
const LX_PEOPLE: ContactPersonVM[] = [
  { name: "Jakob Bech Benediktson", role: "CEO", group: "Direktion", phone: "60409090", email: "jbb@lassox.com", sources: src },
  { name: "Anders Eksempel", role: "COO", group: "Direktion", phone: "60409091", email: "ae@lassox.com", sources: src },
  { name: "Jeppe Eksempel", role: "CTO", group: "Direktion", email: "je@lassox.com", sources: src },
  { name: "Mette Eksempel", role: "Markedschef for B2B", group: "Ledelse", phone: "60409092", email: "me@lassox.com" },
  { name: "Sara Eksempel", role: "Customer Success Manager", group: "Salg", email: "se@lassox.com" },
  { name: "Emil Eksempel", role: "Customer Success Manager", group: "Salg", phone: "60409093", email: "em@lassox.com" },
  { name: "Christian Eksempel", role: "Markedschef", group: "Salg", phone: "60409094", email: "ce@lassox.com" },
  { name: "Abed Eksempel", role: "Sales Lead", group: "Salg", phone: "60409095", email: "ab@lassox.com" },
  { name: "Bo Eksempel", role: "Back-End Udvikler", group: "IT-udvikling", email: "bo@lassox.com" },
  { name: "Cecilie Eksempel", role: "Front-End Udvikler", group: "IT-udvikling", email: "cc@lassox.com" },
  { name: "Dennis Eksempel", role: "Lead Developer", group: "IT-udvikling", email: "de@lassox.com" },
  { name: "Freja Eksempel", role: "Senior Front-End Udvikler", group: "IT-udvikling", email: "fe@lassox.com" },
  { name: "Gorm Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "ge@lassox.com" },
  { name: "Hans Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "he@lassox.com" },
  { name: "Ida Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "ie@lassox.com" },
  { name: "Karin Eksempel", role: "Office Manager", group: "Øvrige", email: "ke@lassox.com" },
];
const LX_DATA = { lassoId: "CVR-1-34580820", people: LX_PEOPLE };
const LX_SHORTCUTS = [
  { id: "tvillinger", label: "Tvillinger", icon: "users" as const, onSelect: noop },
  { id: "nyheder", label: "Nyheder", icon: "news" as const, onSelect: noop },
];

function SeeAllPanel({ view = "detail", minHeight = 940 }: { view?: "list" | "detail"; minHeight?: number }) {
  // Præsentation: laget følger galleriets højde (ikke skærmbilledets 800 px), og fokusrammen fra
  // åbningen (fokus på den valgte række) tegnes ikke på det statiske billede.
  return (
    <div style={{ minHeight }}>
      <NoAnim />
      <style>{`.lasso-layer{position:absolute!important;height:${minHeight}px!important}.lasso-sidepanel-wrap{position:absolute!important}.lasso-panellist__row:focus-visible{outline:none!important}`}</style>
      <LassoContactPersons
        data={LX_DATA}
        companyName="LASSO X A/S"
        company={LASSO_X}
        contact={LASSO_X_CONTACT}
        shortcuts={LX_SHORTCUTS}
        onLiveDetails={noop}
        defaultOpen={0}
        defaultView={view}
        onCopy={noop}
        onOpenLink={noop}
      />
    </div>
  );
}

/* ---------- Indgange ---------- */

export const entries: GalleryEntry[] = [
  // 08 Virksomhed
  { nr: "08.1", title: "Virksomhedshoved", node: "I4C-0", spec: co("Eksempel Byg A/S", [{ type: "LassoCompanyHead", company: B }]) },
  { nr: "08.2", title: "Sektionsfaner", node: "9S7-0", render: () => <SectionTabs />, note: "Fanerne leveres af værten (LassoView.headTabs); her tegnet med CompanyHead + Tabs niveau 1 med 8 faner." },
  { nr: "08.3", title: "Kontaktblok", node: "9SV-0", spec: co("Eksempel Byg A/S", [{ type: "LassoContact", company: B }]) },
  { nr: "08.4", title: "Genveje", node: "9TL-0", spec: co("Eksempel Byg A/S", [{ type: "LassoShortcuts", company: B }]) },
  { nr: "08.5", title: "Live-nummer (kontaktblok med realtidsverifikation)", node: "BJJ-0", render: () => <LiveNumberStates /> },
  { nr: "08.6", title: "Kontaktpersoner, blok på siden", node: "I6B-0", spec: co("Eksempel Byg A/S", [{ type: "LassoContactPersons", company: B }]) },
  {
    nr: "08.7",
    title: "Se alle-panel",
    node: "L75-0",
    render: () => <SeeAllPanel />,
    only: "desktop",
    note: "Paper L75-0: tre kolonner i portalens ramme (virksomheden | stillinger pr. afdeling | valgt person). Tvillinger/Nyheder og 'Se detaljer' vises kun, når værten kan åbne dem (G1).",
  },
  {
    nr: "08.8",
    title: "Hovedvarianter (status og overvåger-tilstand)",
    node: "I50-0",
    render: () => (
      <Stack>
        <Labelled label="Konkurs/likvidation">
          <CompanyHead company={ENERGI} actions={headActions(false)} />
        </Labelled>
        <Labelled label="Overvåger-tilstand">
          <CompanyHead company={BYG} actions={headActions(true)} />
        </Labelled>
        <Labelled label="Kompakt (56 px)">
          <CompanyHead company={BYG} variant="compact" actions={headActions(false)} />
        </Labelled>
        <Labelled label="Ophørt (kompakt række)">
          <CompanyHead company={CAFE} variant="compact" actions={headActions(false)} onHistory={noop} />
        </Labelled>
      </Stack>
    ),
  },
  { nr: "08.9", title: "Se alle-panel, tablet 768", node: "MCE-0", render: () => <SeeAllPanel minHeight={760} />, only: "desktop", desktopWidth: 768 },
  { nr: "08.10", title: "Se alle-ark, mobil liste", node: "MES-0", render: () => <SeeAllPanel view="list" minHeight={760} />, only: "mobile" },
  { nr: "08.11", title: "Se alle-ark, mobil detalje", node: "MGT-0", render: () => <SeeAllPanel minHeight={760} />, only: "mobile" },

  // 09 Nøgletal
  { nr: "09.1", title: "Nøgletalskort", node: "9UM-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyFigureCards", company: B }]) },
  { nr: "09.2", title: "Nøgle-værdi-liste", node: "9VU-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyValueList", company: B, variant: "company" }]) },
  { nr: "09.3", title: "Talformat", node: "9XW-0", render: () => <NumberFormats />, note: "Tegnet med formatAmount/formatPercent/formatNumber/formatDate fra @lasso/spec." },
  {
    nr: "09.4",
    title: "Nøgletalskort, varianter",
    node: "BKI-0",
    note: "Henter: skeletterne er i bevægelse (et lyst skær glider fra venstre mod højre, 1,6 s; stille ved prefers-reduced-motion). Billedet her er statisk.",
    render: () => (
      <Stack>
        <Labelled label="Med sparkline, branche og kvalitetsflag (ansatte)">
          <KeyFigureCards financials={FIN_FULL} />
        </Labelled>
        <Labelled label="Henter">
          <KeyFigureCards />
        </Labelled>
        <Labelled label="Ikke oplyst (klasse B uden omsætning)">
          <KeyFigureCards financials={FIN_MISSING} metrics={["omsaetning", "bruttofortjeneste", "resultat", "ansatte"]} />
        </Labelled>
      </Stack>
    ),
  },
  {
    nr: "09.5",
    title: "Nøgle-værdi-liste med årsvælger",
    node: "9WR-0",
    spec: co("Eksempel Byg A/S", [{ type: "LassoKeyValueList", company: B, variant: "financials" }]),
    note: "Med årsrapportens PDF-link i datasættet: 'Hent regnskabet' øverst i elementet og 'Se alle' under listen (Jakob 29.09).",
    mutate: (ds) => {
      ds.financialStatements[B] = { lassoId: B, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [], pdfUrl: "https://example.com/aarsrapport.pdf" };
    },
  },

  // 10 Score og tabeller
  { nr: "10.1", title: "Scoremåler", node: "9ZT-0", spec: co("Eksempel Byg A/S", [{ type: "LassoScoreGauge", company: B, width: "half" }]), note: "Måleren i en ½-kolonne som i Paper (ca. 540 px)." },
  { nr: "10.2", title: "Flerårstabel", node: "A0Q-0", spec: co("Eksempel Byg A/S", [{ type: "LassoMultiYearTable", company: B, metrics: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"], years: 5 }]) },
  {
    nr: "10.3",
    title: "Datatilstande",
    node: "A2H-0",
    render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <Labelled label="Beregnes på forespørgsel">
          <DataState state="ondemand" reason="Risikovurderingen beregnes, når du beder om den." cost="Koster 1 kredit, tager 5–45 sekunder" actionLabel="Beregn risiko" onAction={noop} />
        </Labelled>
        <Labelled label="Henter, skelet">
          <DataState state="loading" lines={4} height={140} framed />
        </Labelled>
        <Labelled label="Ingen data">
          <DataState state="empty" look="panel" title="Ingen nyheder endnu" reason="Der er ikke fundet artikler om virksomheden." checkedAt="2026-09-28" action={{ label: "Overvåg og få besked", onClick: noop }} />
        </Labelled>
      </div>
    ),
  },
  { nr: "10.4", title: "Scoremåler, tilstande", node: "BGZ-0", render: () => <ScoreStates /> },

  // 11 Personer og ejere
  {
    nr: "11.1",
    title: "Rolleliste, kompakt",
    node: "A3I-0",
    spec: co("Eksempel Byg A/S", [{ type: "LassoRelations", company: B }]),
    note: "Eksempel: flere ejere end tre, reelle ejere uden adgang og én produktionsenhed (tilstandene i Paper).",
    mutate: (ds) => {
      const own = ds.ownership[B];
      if (own) {
        const base = own.owners[0]!;
        own.owners = [...own.owners, ...["Prøve Invest ApS", "Carla Prøve", "Dan Prøve", "Eva Prøve"].map((name) => ({ ...base, name, lassoId: undefined }))];
      }
      ds.errors[`beneficialOwnership:${B}`] = "Reelle ejere kræver adgang (403).";
      ds.productionUnits[B] = { lassoId: B, units: [], total: 1 };
    },
  },
  { nr: "11.2", title: "Personliste, udfoldet", node: "A4F-0", gridWidth: 564, spec: co("Eksempel Byg A/S", [{ type: "LassoPersonList", company: B, show: "all" }]) },
  { nr: "11.3", title: "Ejerliste", node: "A5X-0", spec: co("Eksempel Byg A/S", [{ type: "LassoOwnerList", company: B }]) },
  { nr: "11.4", title: "Reelle ejere", node: "B33-0", spec: co("Eksempel Byg A/S", [{ type: "LassoBeneficialOwners", company: B }]) },

  // 12 Tekst og historik
  { nr: "12.1", title: "Tekstsektioner", node: "A83-0", spec: co("Eksempel Byg A/S", [{ type: "LassoTextSections", company: B }]) },
  {
    nr: "12.2",
    title: "Resumé",
    node: "A8H-0",
    spec: co("Eksempel Byg A/S", [
      {
        type: "LassoSummary",
        title: "Vurdering",
        source: "Lasso, regnskab 2024 og CVR",
        updated: "2026-09-28",
        text:
          "Eksempel Byg A/S er en sund, mellemstor entreprenør med stabil vækst. Bruttofortjenesten er steget med 7 % om året de seneste fem år og var 38 mio. kr. i 2024, mens resultatet efter skat steg til 4,2 mio. kr.\n\nSoliditetsgraden ligger over branchens median, og egenkapitalen er vokset hvert år, fordi overskuddet i vid udstrækning er blevet i selskabet. Likviditeten er tilfredsstillende, men arbejdskapitalen er bundet i igangværende arbejder, som er typisk for branchen.\n\nEjerkredsen er stabil: Eksempel Holding ApS ejer mellem 66,67 og 89,99 %, og direktøren Anne Eksempel ejer resten. Der er ingen risikoobservationer over 50, og revisor har afgivet en blank påtegning.\n\nSamlet set er virksomheden en lav-risiko samarbejdspartner. Hold øje med ordrebeholdningen, da byggeriet generelt har vist faldende aktivitet i 2026.",
      },
    ]),
  },
  { nr: "12.3", title: "Tidslinje (CVR-ændringer)", node: "A8Z-0", spec: co("Eksempel Byg A/S", [{ type: "LassoTimeline", company: B }]) },
  { nr: "12.4", title: "Nyhedsliste", node: "AAG-0", spec: co("Eksempel Byg A/S", [{ type: "LassoNews", company: B, limit: 3 }]) },

  // 13 Grafer
  { nr: "13.1", title: "Seriefarver (palet)", node: "ABI-0", render: () => <Palette /> },
  { nr: "13.2", title: "Søjlegraf", node: "9YI-0", spec: co("Eksempel Byg A/S", [{ type: "LassoBarChart", company: B, metric: "bruttofortjeneste", years: 5 }]) },
  {
    nr: "13.3",
    title: "Rangliste (vandrette søjler)",
    node: "BFK-0",
    spec: { title: "Bruttofortjeneste", components: [{ type: "LassoRanking", companies: [B, "CVR-1-99000004", "CVR-1-99000008", "CVR-1-99000007", "CVR-1-99000005", "CVR-1-99000002"], metric: "bruttofortjeneste" }] },
  },
  { nr: "13.4", title: "Grupperede søjler", node: "ACE-0", spec: co("Eksempel Byg A/S", [{ type: "LassoGroupedBarChart", company: B, metrics: ["omsaetning", "bruttofortjeneste", "resultat"], years: 5 }]), note: "Hover-tilstanden (tooltip) kan ikke vises statisk på desktop; mobilen viser det faste valgfelt." },
  { nr: "13.5", title: "Stablede søjler (balance)", node: "ADW-0", spec: co("Eksempel Byg A/S", [{ type: "LassoStackedBarChart", company: B, years: 5 }]) },
  { nr: "13.6", title: "Linjegraf med benchmark", node: "AF3-0", spec: co("Eksempel Byg A/S", [{ type: "LassoLineChart", company: B, metric: "bruttofortjeneste", years: 5, benchmark: "CVR-1-99000008" }]), note: "Hover med hårlinje kan ikke vises statisk på desktop." },
  { nr: "13.7", title: "Vandfald", node: "AGI-0", spec: co("Eksempel Byg A/S", [{ type: "LassoWaterfallChart", company: B }]) },
  { nr: "13.8", title: "Fordeling (donut + andelsbjælker)", node: "AHT-0", spec: co("Eksempel Byg A/S", [{ type: "LassoShareBars", company: B, variant: "ejerkreds" }]) },
  { nr: "13.9", title: "Sparklines", node: "AJ2-0", render: () => <Sparklines /> },
  { nr: "13.10", title: "Nøgletalsmåler (interval med branchemærke)", node: "AJY-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyFigureGauge", company: B }]) },
  { nr: "13.11", title: "Heatmap", node: "AKQ-0", spec: { title: "Aktivitet i Kunder", components: [{ type: "LassoHeatmap", list: "Kunder", months: 12 }] } },
  { nr: "13.12", title: "Kort", node: "AMO-0", spec: co("Eksempel Byg A/S", [{ type: "LassoMap", company: B }]) },
];
