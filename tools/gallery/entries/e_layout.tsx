// Gruppe E: guide (23), eksempelsider (24, 25), responsiv (26–26h), A4-rapport (27),
// øvrige datatyper (28), fanebjælker (29) og layout (30).
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  formatAmount,
  FOCUSES,
  FOCUS_LABELS,
  PERSON_FOCUSES,
  PERSON_FOCUS_LABELS,
  composeCompany,
  composePerson,
  composePersonProbe,
  composeProbe,
  mainMetric,
  parseViewSpec,
  STATUS_GROUPS,
  statusKind,
  type CompanyRowVM,
  type Dataset,
  type Metric,
  type ViewSpec,
} from "@lasso/spec";
import {
  AppShell,
  CompanyTable,
  CreditConfirmDialog,
  EntityUpdates,
  LassoBeneficialOwners,
  LassoView,
  Menu,
  ModuleBar,
  ModuleToolbar,
  PersonSearchResults,
  PushBanner,
  LineChart,
  MultiYearTable,
  ReportA4,
  StatementsReportA4,
  PersonReportA4,
  AnalysisReportA4,
  ANALYSIS_DISCLAIMER,
  ReportBatches,
  Section,
  ShellIcon,
  SnapshotPicker,
  statusTone,
  TabPanel,
  Tabs,
  ValueRow,
  ToastProvider,
  Toasts,
  type AppShellMobile,
  type HostCapabilities,
  type ModuleAction,
  type RailGroup,
  type StripTab,
  type TabItem,
} from "@lasso/ui";
import { MobileFilterSheet, MobileForm } from "./felter_mobil.js";
import { DefaultPageGuide, ElementTable, GridModel } from "./e_grid.js";

import type { GalleryEntry } from "../types.js";
import { DatatypeTable, LookupTable, StatesAndFormat, WidthAndPaper } from "./e_guide.js";

/* ---------- Fælles ---------- */

const C = "CVR-1-99000001"; // Eksempel Byg A/S (fuld)
const P = "CVR-3-4000000002"; // Bo Eksempel (flest roller)
const IS_NODE = typeof window === "undefined";
const noop = () => undefined;

/** Datasættet til denne indgang (bygges i node fra `spec`, læses her fra galleriets data). */
function ownData(): Dataset | null {
  const w = window as unknown as { __GALLERY_DATA__?: Record<string, Dataset> };
  const id = new URLSearchParams(window.location.search).get("id") ?? "0";
  return w.__GALLERY_DATA__?.[id] ?? null;
}

/**
 * Indgang, der skal tegnes af en ren komponent (fx AppShell eller ReportA4) med demodata:
 * i node har den en `spec`, så build.ts henter datasættet; i browseren har den kun `render`,
 * som læser datasættet for sit eget id.
 */
function dataEntry(e: Omit<GalleryEntry, "spec" | "render"> & { probe: ViewSpec | Record<string, unknown>; draw: (ds: Dataset) => ReactNode }): GalleryEntry {
  const { probe, draw, ...rest } = e;
  return {
    ...rest,
    ...(IS_NODE ? { spec: probe as Record<string, unknown> } : {}),
    render: () => {
      const ds = ownData();
      return ds ? draw(ds) : <p className="lasso-small">Demodata mangler</p>;
    },
  };
}

const muted: CSSProperties = { color: "var(--lasso-muted)" };
const caption = (t: string) => (
  <div className="lasso-small" style={{ ...muted, marginBottom: 8 }}>
    {t}
  </div>
);
const stack = (gap = 24): CSSProperties => ({ display: "grid", gap });
const placeholder = (label: string, height = 120): ReactNode => (
  <div
    style={{
      height,
      border: "1px dashed var(--lasso-border-strong)",
      borderRadius: "var(--lasso-radius)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--lasso-muted)",
      fontSize: "var(--lasso-fs-sm)",
      background: "var(--lasso-surface)",
    }}
  >
    {label}
  </div>
);

/* ---------- Portalens ramme (AppShell) med en komponeret side ---------- */

// Samme regler som apps/view/src/portal/portal.css (kun tokens); galleriet indlæser kun styles.css.
const PORTAL_CSS = `.e-portal{display:flex;flex-direction:column;background:var(--lasso-chrome);margin:-24px}
.e-portal .lasso-page .lasso-frame:not(.lasso-frame--bare){padding:var(--lasso-space-5)}
.e-portal-body{padding:var(--lasso-space-5)}
.e-portal .lasso-bottomnav,.e-portal .lasso-shell > .lasso-bottomnav,.e-portal .lasso-mobilebar{position:static}
.e-screen{min-height:100vh}.e-screen > .lasso-shell{flex:1}
@container lasso (max-width:560px){.e-portal .lasso-page .lasso-frame:not(.lasso-frame--bare){padding:var(--lasso-space-4)}.e-portal-body{padding:var(--lasso-space-4)}}`;

const COMPANY_MODULES: readonly TabItem[] = FOCUSES.map((f) => ({ id: f, label: FOCUS_LABELS[f] }));
const PERSON_MODULES: readonly TabItem[] = PERSON_FOCUSES.map((f) => ({ id: f, label: PERSON_FOCUS_LABELS[f] }));

function railGroups(active: string): RailGroup[] {
  const letter = "letter" as const;
  return [
    {
      id: "vaerktoejer",
      label: "Værktøjer",
      items: [
        { id: "search", label: "Søgning", icon: <ShellIcon name="search" />, active: active === "search" },
        { id: "saved", label: "Gemte sider", icon: <ShellIcon name="list" />, active: active === "saved" },
      ],
    },
    {
      id: "firmaer",
      label: "Firmaer",
      items: [
        { id: C, label: "Eksempel Byg A/S", icon: letter, active: active === C },
        { id: "CVR-1-99000005", label: "Eksempel Software ApS", icon: letter },
        { id: "CVR-1-99000002", label: "Eksempel Revision", icon: letter },
      ],
      footer: { label: "Se alle gemte", icon: "none" },
    },
    {
      id: "personer",
      label: "Personer",
      items: [
        { id: P, label: "Bo Eksempel", icon: letter, active: active === P },
        { id: "CVR-3-4000000001", label: "Anne Eksempel", icon: letter },
      ],
      footer: { label: "Se alle gemte", icon: "none" },
    },
  ];
}

function stripTabs(active: "company" | "person" | "search", companyName = "Eksempel Byg A/S", personName = "Bo Eksempel"): StripTab[] {
  return [
    { id: "c", label: companyName, active: active === "company" },
    { id: "p", label: personName, icon: <ShellIcon name="user" />, active: active === "person" },
    { id: "s", label: "Søgning", icon: <ShellIcon name="search" />, active: active === "search" },
  ];
}

const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 560;

/** Portalens værtskapabiliteter (apps/view/src/portal/data.ts entityHost): Gem i modulbjælken på desktop, i hovedet på mobil. */
const entityHost = (): HostCapabilities => ({ savePage: isMobile(), save: true, refine: false, drillDown: true, refresh: true, export: true, back: false, openSection: true });

function moduleActions(): ModuleAction[] {
  return [
    {
      id: "eksport",
      label: "Eksportér",
      items: [
        { id: "del", label: "Del link", icon: <ShellIcon name="copy" size={16} />, onSelect: noop },
        { id: "csv", label: "Tal som CSV", icon: <ShellIcon name="download" size={16} />, onSelect: noop },
      ],
    },
    { id: "gem", label: "Gem", icon: <ShellIcon name="bookmark" />, onSelect: noop },
    { id: "overvaag", label: "Overvåg", icon: <ShellIcon name="rss" />, tone: "accent", onSelect: noop },
  ];
}

function Shell({
  kind,
  title,
  modules,
  value,
  children,
  panel,
  sheetOpen,
  screen,
  moduleBar = true,
}: {
  kind: "company" | "person" | "search";
  title: string;
  modules?: readonly TabItem[];
  value?: string;
  children: ReactNode;
  panel?: ReactNode;
  sheetOpen?: boolean;
  /** Fylder hele skærmen (ark og faste lag kommer med i billedet). */
  screen?: boolean;
  /** Modulbjælken over siden (standard). Under 1024 px står modulerne i stedet under hovedet (26f.1/26.3). */
  moduleBar?: boolean;
}) {
  const [focus, setFocus] = useState(value ?? "overblik");
  const mobile: AppShellMobile = {
    title,
    subtitle: modules?.find((m) => m.id === focus)?.label,
    sections: modules,
    activeSection: focus,
    onSelectSection: setFocus,
    sheetOpen,
    onBell: noop,
    unread: 0,
    moreItems: [
      { id: "save", label: "Gem på din liste", icon: <ShellIcon name="bookmark" size={16} />, onSelect: noop },
      { id: "share", label: "Del link", icon: <ShellIcon name="copy" size={16} />, onSelect: noop },
    ],
    nav: [
      { id: "soeg", label: "Søg", icon: <ShellIcon name="search" size={20} />, active: true },
      { id: "lister", label: "Lister", icon: <ShellIcon name="list" size={20} /> },
      { id: "overvaagning", label: "Overvågning", icon: <ShellIcon name="bell" size={20} /> },
      { id: "konto", label: "Konto", icon: <ShellIcon name="user" size={20} /> },
    ],
  };
  return (
    <div className={`lasso-root lasso-portal e-portal${screen ? " e-screen" : ""}`} data-theme="light">
      <style>{PORTAL_CSS}</style>
      <AppShell
        rail={{ groups: railGroups(kind === "company" ? C : kind === "person" ? P : "search"), onToggleGroup: noop, onLogo: noop }}
        tabs={{ tabs: stripTabs(kind, kind === "company" ? title : undefined, kind === "person" ? title : undefined), onSelect: noop, onClose: noop, onAdd: noop, onBell: noop, unread: isNarrow() ? 0 : 3, onFeedback: noop, onAccount: noop }}
        mobile={mobile}
        panel={panel}
      >
        {modules && moduleBar ? <ModuleBar id="e-mod" modules={modules} value={focus} onChange={setFocus} actions={moduleActions()} ariaLabel="Fokus" /> : null}
        {children}
      </AppShell>
    </div>
  );
}

function companySpec(ds: Dataset, followUps = false): ViewSpec {
  return composeCompany(C, ds, { focus: "overblik", name: ds.companies[C]?.name, chartMetric: mainMetric(ds.financials[C]?.years ?? []), followUps });
}
function personSpec(ds: Dataset, followUps = false): ViewSpec {
  return composePerson(P, ds, { focus: "overblik", name: ds.persons[P]?.name, followUps });
}

/** Under 1024 px (tablet 26f.1, mobil 26.3): ingen modulbjælke; modulerne som faner under hovedet (tablet 5 + "Mere"). */
const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 1024;
function narrowTabs(items: readonly TabItem[], value: string, onChange: (id: string) => void) {
  return isMobile() ? { items, value, onChange, ariaLabel: "Moduler", maxVisible: items.length } : { items, value, onChange, ariaLabel: "Moduler", maxVisible: 6, moreLabel: "Mere" };
}

function CompanyPage({ ds }: { ds: Dataset }) {
  const spec = companySpec(ds);
  const [focus, setFocus] = useState("overblik");
  const narrow = isNarrow();
  return (
    <Shell kind="company" title={ds.companies[C]?.name ?? "Eksempel Byg A/S"} modules={COMPANY_MODULES} value="overblik" moduleBar={!narrow}>
      <LassoView
        spec={spec}
        dataset={ds}
        host={narrow ? { ...entityHost(), savePage: true, monitor: true } : entityHost()}
        headTabs={narrow ? narrowTabs(COMPANY_MODULES, focus, setFocus) : undefined}
        onAction={noop}
        theme="light"
        frameless
        page
      />
    </Shell>
  );
}


/* ---------- 24, 25 og 26g: eksempelsiderne som i Paper ---------- */

/** 24.1: skinnen på virksomhedssiden (Værktøjer, Firmaer = gemte lister, Personer sammenfoldet); intet punkt er aktivt. */
const paperRailCompany = (): RailGroup[] => [
  {
    id: "vaerktoejer",
    label: "Værktøjer",
    items: [
      { id: "udtraek", label: "Dataudtræk", icon: <ShellIcon name="download" /> },
      { id: "ejendomme", label: "Ejendomme", icon: <ShellIcon name="home" /> },
      { id: "maalgruppe", label: "Målgruppesøgning", icon: <ShellIcon name="target" /> },
      { id: "overvaagning", label: "Overvågning", icon: <ShellIcon name="bell" /> },
      { id: "risiko", label: "Risikovurdering", icon: <ShellIcon name="alert" /> },
      { id: "flere", label: "Flere", icon: <ShellIcon name="chevron-down" /> },
    ],
  },
  {
    id: "firmaer",
    label: "Firmaer",
    items: [
      { id: "overvaager", label: "Overvåger", icon: <ShellIcon name="rss" /> },
      { id: "advisory", label: "Advisory Board", icon: "letter" },
      { id: "kunder", label: "Kunder", icon: "letter" },
      { id: "salgspartnere", label: "Salgspartnere", icon: "letter" },
      { id: "flere", label: "Flere", icon: <ShellIcon name="chevron-down" /> },
    ],
    footer: { label: "Opret ny liste", icon: "plus" },
  },
  { id: "personer", label: "Personer", collapsed: true, items: [] },
];

/** 25.2: personsidens skinne er sektionerne (Overblik aktiv) med Lasso-bundlinje. */
const paperRailPerson = (): RailGroup[] => [
  {
    id: "sektioner",
    label: "Sektioner",
    items: ["Overblik", "Roller over tid", "Selskaber", "Ejerskab", "Netværk", "Risiko", "Historik"].map((l, i) => ({ id: `s${i}`, label: l, active: i === 0 })),
  },
];

/** 24.3: modulbjælkens handlinger, siden er gemt (fyldt koral bogmærke) og kan overvåges. */
const paperModuleActions = (): ModuleAction[] => [
  { id: "eksport", label: "Eksportér", items: [{ id: "pdf", label: "PDF-rapport", icon: <ShellIcon name="download" size={16} />, onSelect: noop }, { id: "csv", label: "Tal som CSV", icon: <ShellIcon name="download" size={16} />, onSelect: noop }] },
  { id: "gem", label: "Gemt", icon: <ShellIcon name="bookmark" filled />, tone: "accent", onSelect: noop },
  { id: "overvaag", label: "Overvåg", icon: <ShellIcon name="rss" />, tone: "accent", onSelect: noop },
];

/** Hovedet i Paper har Overvåg, Gem, Eksportér og Flere (24.4, 25.3). */
const paperHost = (): HostCapabilities => ({ ...entityHost(), savePage: true, monitor: true });

function PaperShell({ kind, title, company, children }: { kind: "company" | "person"; title: string; company: string; children: ReactNode }) {
  const [focus, setFocus] = useState("overblik");
  const tabs: StripTab[] =
    kind === "company"
      ? [
          { id: "c", label: company, icon: <ShellIcon name="company" />, active: true },
          { id: "s", label: "Søgning", icon: <ShellIcon name="search" /> },
          { id: "o", label: "Overvågning", icon: <ShellIcon name="bell" /> },
        ]
      : [
          { id: "c", label: company, icon: <ShellIcon name="company" /> },
          { id: "p", label: title, icon: <ShellIcon name="user" />, active: true },
          { id: "s", label: "Søgning", icon: <ShellIcon name="search" /> },
        ];
  const mobile: AppShellMobile = {
    title,
    sections: kind === "company" ? COMPANY_MODULES : PERSON_MODULES,
    activeSection: focus,
    onSelectSection: setFocus,
    // 26g.1/26g.2: entitetssiden har "‹ Navn" med del-ikon og burger i topbjælken.
    back: { onBack: noop, onShare: noop },
    nav: [
      { id: "soeg", label: "Søg", icon: <ShellIcon name="search" size={20} />, active: true },
      { id: "lister", label: "Lister", icon: <ShellIcon name="list" size={20} /> },
      { id: "overvaagning", label: "Overvågning", icon: <ShellIcon name="bell" size={20} /> },
      { id: "konto", label: "Konto", icon: <ShellIcon name="user" size={20} /> },
    ],
  };
  return (
    <div className="lasso-root lasso-portal e-portal" data-theme="light">
      <style>{PORTAL_CSS}</style>
      <AppShell
        rail={
          kind === "company"
            ? { groups: paperRailCompany(), onToggleGroup: noop, onLogo: noop }
            : { groups: paperRailPerson(), onToggleGroup: noop, logo: false, bottom: {} }
        }
        tabs={{ tabs, onSelect: noop, onBell: noop, onAccount: noop }}
        mobile={mobile}
      >
        {kind === "company" && !isNarrow() ? <ModuleBar id="e-mod" modules={COMPANY_MODULES} value={focus} onChange={setFocus} actions={paperModuleActions()} maxVisible={8} ariaLabel="Moduler" /> : null}
        {children}
      </AppShell>
    </div>
  );
}

/** 26g.2: personfanerne under hovedet på mobil (Paper EPB-0/FOV-0). */
const PAPER_PERSON_TABS: readonly TabItem[] = [
  { id: "roller", label: "Roller" },
  { id: "netvaerk", label: "Netværk" },
  { id: "risiko", label: "Risiko" },
  { id: "historik", label: "Historik" },
  { id: "nyheder", label: "Nyheder" },
];

function PaperCompanyPage({ ds }: { ds: Dataset }) {
  const name = ds.companies[C]?.name ?? "Eksempel Byg A/S";
  const [focus, setFocus] = useState("overblik");
  const narrow = isNarrow();
  return (
    <PaperShell kind="company" title={name} company={name}>
      <LassoView
        spec={companySpec(ds)}
        dataset={ds}
        host={paperHost()}
        headTabs={narrow ? narrowTabs(COMPANY_MODULES, focus, setFocus) : undefined}
        sectionCards
        onAction={noop}
        theme="light"
        frameless
        page
      />
    </PaperShell>
  );
}

function PaperPersonPage({ ds }: { ds: Dataset }) {
  const [tab, setTab] = useState("roller");
  return (
    <PaperShell kind="person" title={ds.persons[P]?.name ?? "Bo Eksempel"} company={ds.companies[C]?.name ?? "Eksempel Byg A/S"}>
      <LassoView
        spec={personSpec(ds)}
        dataset={ds}
        host={paperHost()}
        headTabs={isMobile() ? { items: PAPER_PERSON_TABS, value: tab, onChange: setTab, ariaLabel: "Personfaner", maxVisible: PAPER_PERSON_TABS.length } : undefined}
        sectionCards
        onAction={noop}
        theme="light"
        frameless
        page
      />
    </PaperShell>
  );
}

/** Probe med risikoobservationerne, så hovedets observationslinje ("Se risiko", 24.4) har data. */
const paperCompanyProbe = (): ViewSpec => {
  const p = composeProbe(C, "overblik");
  return { ...p, components: [...p.components, { type: "LassoRiskObservations", company: C }].slice(0, 12) as ViewSpec["components"] };
};

const companyProbe = () => composeProbe(C, "overblik");
const PAPER_COMPANY_NOTE =
  "Rammen som i Paper (skinne med Værktøjer/Firmaer/Personer, faner uden luk/+/badge, modulbjælke med 7 moduler + Flere og Gemt/Overvåg, hoved med fire ikonknapper og observationslinje) om show_company-kompositionen (composeCompany, overblik) for Eksempel Byg A/S. Sidens moduler bestemmes af compose.ts (se rapporten).";
const PAPER_PERSON_NOTE =
  "Rammen som i Paper (faner uden luk/+/badge, skinne med sektioner og Lasso-bundlinje, ingen modulbjælke, hoved med fire ikonknapper) om show_person-kompositionen (composePerson, overblik) for Bo Eksempel. Sidens moduler bestemmes af composePerson.ts (se rapporten).";
const personProbe = () => composePersonProbe(P, "overblik");

const COMPANY_PAGE_NOTE =
  "Portalens ramme (AppShell: skinne, fanebjælke, modulbjælke) med show_company-kompositionen (composeCompany, focus overblik, followUps fra) for Eksempel Byg A/S i stedet for LASSO X A/S.";

/* ---------- 23 Guide ---------- */

function Table({ head, rows }: { head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  return (
    <div className="lasso-table-frame">
      <div className="lasso-table-wrap">
        <table className="lasso-table">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const guide: GalleryEntry[] = [
  { nr: "23.1", title: "Trin 1: Gridmodel - bånd og stakke på 12 kolonner", node: "KA2-0", only: "desktop", desktopWidth: 1440, note: "Gitter, højdeklasser, bånd/stakke, pakkealgoritme, udligning og verifikation. Skitserne tegnes af packBands (packages/spec/src/grid.ts) med de målte højder (e_grid.tsx).", render: () => <GridModel /> },
  { nr: "23.2", title: "Trin 2: Elementtabel", node: "KA5-0", only: "desktop", desktopWidth: 1440, note: "Én række pr. komponenttype fra GRID_RULES (catalog.ts) og MEASURED_HEIGHTS (grid.ts = measure/heights.json).", render: () => <ElementTable /> },
  dataEntry({ nr: "23.3", title: "Trin 3: Default-side og spørgsmål", node: "L26-0", only: "desktop", desktopWidth: 1440, note: "A default-siden som skitse (packBands) og B spørgsmålets princip med tre eksempler; C default-siden tegnet af composeCompany + LassoView med demodata.", probe: companyProbe(), draw: (ds) => <DefaultPageGuide ds={ds} company={C} /> }),
  { nr: "23.4", title: "Trin 4: Datatype → element (mappingtabel)", node: "CNC-0", only: "desktop", note: "Papers opslagstabel Datatype | Element | Artboard.", render: () => <DatatypeTable /> },
  { nr: "23.5", title: "Trin 5: Tjek tilstande og talformat", node: "CPU-0", only: "desktop", note: "Papers tre kort: fem tilstande, talformat (ægte minus) og tjeklisten 'Aflever aldrig uden' (21 punkter).", render: () => <StatesAndFormat /> },
  { nr: "23.6", title: "Trin 6: Tænk bredden og papiret med", node: "DT7-0", only: "desktop", note: "Papers to kort Responsiv (26) og Eksport og print (27).", render: () => <WidthAndPaper /> },
];

/* ---------- 24 og 25: eksempelsider ---------- */

const pages: GalleryEntry[] = [
  dataEntry({
    nr: "24.1–24.11",
    title: "Eksempel · Virksomhedsoverblik (skinne, faner, modulbjælke, hoved, nøgletal, graf, oplysninger, ledelse, kontakt, ejere, nyheder)",
    node: "JT5-0",
    only: "desktop",
    desktopWidth: 1440,
    note: PAPER_COMPANY_NOTE,
    probe: paperCompanyProbe(),
    draw: (ds) => <PaperCompanyPage ds={ds} />,
  }),
  dataEntry({
    nr: "25.1–25.6",
    title: "Eksempel · Personside (fanebjælke, skinne, personhoved, roller, netværk, personrisiko)",
    node: "D3A-0",
    only: "desktop",
    desktopWidth: 1440,
    note: PAPER_PERSON_NOTE,
    probe: personProbe(),
    draw: (ds) => <PaperPersonPage ds={ds} />,
  }),
];

/* ---------- 26 Responsiv ---------- */

const responsive: GalleryEntry[] = [
  {
    nr: "26.1",
    title: "Brudpunktsregler: ≥ 1200 desktop, 768–1199 tablet, < 768 mobil",
    node: "DH5-0",
    only: "desktop",
    note: "Papers intro DH4-0 og brudpunktstabel DH5-0 (live 29.09, efter Fables oprydning): tre brudpunkter, foldning efter gridmodellen 23.1. Tegnet med Lasso-tabellen.",
    render: () => (
      <div style={stack(16)}>
        <p style={{ margin: 0, maxWidth: 940, fontSize: 15, lineHeight: "23px", color: "var(--lasso-text-3)" }}>
          Samme elementer, tre brudpunkter: desktop ≥ 1200, tablet 768–1199, mobil &lt; 768. Foldningen følger gridmodellen (23.1): under 1200 bliver 9+3 og 8+4 til 12+12 og 4+4+4 til
          6+6+12, mens 6+6 holder til 768; under 768 bliver alt én kolonne. Tablet beholder skabelonens midte, men skinnen bliver en 64 px ikonskinne under en 56 px topbjælke, og
          panelet falder ned under midten; 236 px-skinnen og panelet ved siden af midten kommer først fra 1200. Mobil stabler alt i én kolonne, tabeller bliver kortlister og
          ejerdiagrammet bliver en liste. Intet element må have en egen mobiludgave - kun brudpunktsregler.
        </p>
        <Table
          head={["Element", "≥ 1200, desktop", "768–1199, tablet", "< 768, mobil"]}
          rows={[
            ["Sideskabelon (06)", "Skinne 236 + midte + panel 336 (fra 1200); indhold 1152 = 12 kolonner à 74, gutter 24", "Topbjælke 56 + ikonskinne 64 + midte; panelet falder ned under midten", "Skinne bag \"Sektioner\"-knap i topbjælken; panel nederst; padding 16"],
            ["Virksomhedshoved (08)", "Kun navn + status venstre, 32 px ikonknapper højre (ingen faktalinje, G9)", "Som desktop: navn 24 px, knapper højre på samme linje", "Navn 20 px alene; handlinger som 40 px ikonknapper under navnet, Overvåg med koral ikon"],
            ["Sektionsfaner (08)", "Alle faner, \"Flere\" ved > 8", "Vandret scroll, ingen \"Flere\"", "Vandret scroll med fade i kanten, aktiv fane rulles ind"],
            ["Nøgletalskort (09)", "3–5 på række", "4 på række, sparkline skjules", "2 × 2 grid, tal 20 px, udvikling på én linje"],
            ["Nøgle-værdi-liste (09)", "Nøgle 190 px + værdi på samme linje", "Uændret", "Nøgle over værdi (2 linjer, 12/14), række 52 px"],
            ["Grafer (13)", "⅓, ½, ⅔ eller fuld bredde; højde 300", "½ holder (6+6); ⅓ bliver ½; ⅔ bliver fuld", "Fuld bredde, maks 5 datapunkter synlige, resten ved swipe; tooltip fast under grafen"],
            ["Tabel (15)", "Alle kolonner", "Navn fast, resten vandret scroll; kolonnevalg", "Kortliste: navn + 2 vigtigste værdier + status; filtre i bundark; massehandlinger som bundbjælke"],
            ["Ejerdiagram (14)", "Lærred med panel", "Lærred, panel som bundark", "Indrykket liste: ejere over, fokus, datterselskaber under; \"Åbn diagram\" fuldskærm i landskab"],
            ["Gitter og bånd (23.1)", "12 kolonner à 74 px, gutter 24; bånd = 12 | 6+6 | 8+4 | 9+3 | 4+4+4 | 3+3+6 | 3+3+3+3; stakke strækkes til båndets bund", "Indhold 720 px, 12 kolonner à 38 px, gutter 24; 6+6 holder, 8+4 og 9+3 stables til 12+12, 4+4+4 bliver 6+6+12; ¼ og ⅓ bliver ½", "Én kolonne på 358 px (padding 16): hver stak i rækkefølge fra venstre; intet element ændrer rækkefølge, kun foldning"],
            ["Bredder pr. element (23.2)", "Standard- og minimumsbredde pr. type: ¼ 270, ⅓ 368, ½ 564, ⅔ 760, ¾ 858, 1/1 1152; aldrig under minimum", "Minimum følger med: elementer med min ½ står i ½ (348 px) eller fuld; min ⅔ og 1/1 står altid fuld", "Alle elementer fuld bredde; høje elementer får loft (rows/limit) og \"Se alle\""],
            ["Kontaktblok og genveje (08)", "Kontakt ⅓ (261) i stak ved siden af højt element; genveje ½, fylder rest i en stak", "Kontakt ½ eller fuld; genveje som vandret række, wrap til 2 linjer", "Kontakt som 48 px rækker med handling til højre (Kort, Ring, Kopiér); genveje som vandret scroll af sekundære knapper"],
            ["Tekstsektioner og resumé (12)", "½ (590) eller fuld; klip efter N linjer + \"Vis mere\"", "½ eller fuld; samme klip", "Fuld bredde, klip efter 5 linjer, \"Vis mere\" som 44 px tekstknap"],
            ["Tidslinje og nyheder (12)", "½ standard, limit 3–5 med \"Se alle\"", "½ side om side (6+6) eller fuld", "Fuld bredde, limit 3, kilde og tid 12 px, \"Vis flere\" nederst"],
            ["Regnskab (19)", "Kompakt (2 år + ændring) i ½–¾; fuldt regnskab (5 år + værktøjslinje) kun i 1/1", "Kompakt i ½ eller fuld; fuldt regnskab 3 år synlige, resten vandret scroll", "Segmentkontrol Resultat / Balance / Pengestrøm, år i dropdown, 2 talkolonner (år + Δ), kvalitetsflag foran tallet"],
            ["Personside (16)", "Personhoved fuld (kun navn); roller som tidsbånd ⅔; netværk ½; risiko ½", "Tidsbånd fuld, færre etiketter; netværk og risiko 6+6", "Én kolonne: hoved, faner, tidsbånd (én 10 px bjælke pr. rolle), roller som 60 px rækker, netværk som kort"],
            ["Dialoger og menuer (07)", "Dialog 480–560 centreret; menu ved knappen", "Dialog 560 centreret; menu ved knappen", "Dialog bliver bundark med greb; menu bliver handlingsark; luk altid × (G8)"],
            ["Navigation (06, 26a)", "Skinne 236 + fanebjælke 56 + modulbjælke 56", "Topbjælke 56 + ikonskinne 64; faner ruller vandret", "Topbjælke 52 + bundnavigation 56 (Søg, Lister, Overvågning, Konto); sektioner i ark bag burger"],
            ["Touch-mål og typografi", "Rækker 40–44, ikonknapper 32, felter 36; brødtekst 14/18", "Rækker 44, ikonknapper 36, felter 40; brødtekst 14/18", "Rækker 44, ikonknapper 40, felter og primære knapper 48; brødtekst 14/20, tal i kort 20 px"],
            ["Tilstande (10.3, 15.4, 26h)", "Skelet i indholdets mål, i bevægelse; tom/fejl i samme kortramme", "Samme som desktop", "Skelet formet som mobilkortene; samme værktøjslinje (søg + Filter) i alle tilstande; tom og fejl i samme kortramme"],
            ["Print og PDF (27)", "A4 fra \"Hent som PDF\" på siden, fanen eller elementet: samme elementer, uden interaktion", "Samme", "Samme; deles fra bundark"],
          ].map(([el, ...rest]) => [<span key="e" style={{ fontWeight: 500, color: "var(--lasso-text)" }}>{el}</span>, ...rest])}
        />
      </div>
    ),
  },
  dataEntry({
    nr: "26.2",
    title: "Sideskabelon, tablet 768: topbjælke + 64 px ikonskinne + midte, panel falder ned",
    node: "DIJ-0",
    only: "desktop",
    desktopWidth: 768,
    note: `Paper DIJ-0 + note MII-0: tablet (768–1199) med topbjælke 56 + 64 px ikonskinne + midte; default-siden (23.3) foldet efter gridmodellen: hoved og nøgletalskort som fuldbånd (4 på række, sparkline skjult), 6+6 holder, 3+6+3 bliver 6+6+12, genveje som stakfyld, panelet falder ned som sidste fuldbånd. Hovedet viser kun navn og status (G9); ikonknapper kun med funktion (G1). Tegnet med koden: ${COMPANY_PAGE_NOTE} Båndenes indhold og rækkefølge kommer fra compose.ts + båndpakningen (se rapporten ved afvigelser fra Papers skitse).`,
    probe: companyProbe(),
    draw: (ds) => <CompanyPage ds={ds} />,
  }),
  dataEntry({
    nr: "26.3",
    title: "Sideskabelon, mobil 390: én kolonne, padding 16, skinne bag knap",
    node: "DKS-0",
    only: "mobile",
    note: `Paper DKS-0 + note MIJ-0: mobil (< 768) med topbjælke 52 og "Sektioner"-knap (skinnen bag knap) + søg + klokke, én kolonne på 358 px (padding 16), bundnavigation 56. Alle bånd bliver 12 (hver stak i rækkefølge fra venstre); nøgletalskort 2×2 med pil + procent uden ord; nøgle-værdi-lister med nøgle over værdi; tabeller som kortlister; ejerdiagram som indrykket liste. Hovedet viser kun navn og status (G9). Tegnet med koden: ${COMPANY_PAGE_NOTE}`,
    probe: companyProbe(),
    draw: (ds) => <CompanyPage ds={ds} />,
  }),
];

/* ---------- 26a Mobil: navigation, hoved, felter og overlays ---------- */

function MobileFrame({ sheetOpen, children }: { sheetOpen?: boolean; children?: ReactNode }) {
  return (
    <Shell kind="company" title="Eksempel Byg A/S" modules={COMPANY_MODULES} value="overblik" sheetOpen={sheetOpen} screen>
      <div className="e-portal-body" style={stack(16)}>
        {children ?? (
          <>
            {placeholder("Sidens indhold", 160)}
            {placeholder("", 160)}
            {placeholder("", 160)}
          </>
        )}
      </div>
    </Shell>
  );
}


/** 15.2 mobil (Paper LOA-0): listen "Kunder" med to markerede kort og massehandlingerne i bundbjælken. */
const BULK_ROWS: CompanyRowVM[] = [
  { lassoId: "CVR-1-99000001", cvr: "99000001", name: "Eksempel Byg A/S", city: "Silkeborg", status: "Aktiv", statusKind: "active", employees: 64, grossProfit: 38_000_000, profit: 4_200_000, score: 18 },
  { lassoId: "CVR-1-99000004", cvr: "99000004", name: "Eksempel Software ApS", city: "Aarhus", status: "Aktiv", statusKind: "active", employees: 22, grossProfit: 14_100_000, profit: 1_900_000, score: 24 },
  { lassoId: "CVR-1-99000005", cvr: "99000005", name: "Eksempel Transport A/S", city: "Kolding", status: "Aktiv", statusKind: "active", employees: 41, grossProfit: 21_300_000, profit: -600_000, score: 47 },
];
function BulkMobile({ moreOpen = false }: { moreOpen?: boolean }) {
  return (
    <Shell kind="search" title="Kunder" screen>
      <div className="e-portal-body">
        <CompanyTable
          title="Kunder"
          result={{ key: "kunder", total: 1243, rows: BULK_ROWS }}
          criteria={[{ field: "status", operator: "eq", value: "Aktiv" }]}
          onApplyCriteria={noop}
          onAction={noop}
          canDrillDown
          canSavePage
          canExport
          canPrompt
          preview={{ selected: ["CVR-1-99000001", "CVR-1-99000004"], moreOpen }}
        />
      </div>
    </Shell>
  );
}

function TabsDemo({ level, items, value, ariaLabel, maxVisible }: { level: 1 | 2 | 3; items: readonly TabItem[]; value: string; ariaLabel: string; maxVisible?: number }) {
  const [v, setV] = useState(value);
  return <Tabs level={level} items={items} value={v} onChange={setV} ariaLabel={ariaLabel} maxVisible={maxVisible} />;
}

function OpenMenu() {
  return (
    <div style={{ minHeight: 800 }}>
      <Menu
        trigger={<ShellIcon name="more" size={20} />}
        triggerClassName="lasso-sr-only"
        triggerLabel="Flere handlinger"
        label="Handlinger"
        defaultOpen
        context={{ title: "Store IT-selskaber", subtitle: "Gemt liste, 1.243 virksomheder" }}
        items={[
          { id: "rename", label: "Omdøb", icon: <ShellIcon name="edit" size={16} />, onSelect: noop },
          { id: "export", label: "Eksportér", icon: <ShellIcon name="download" size={16} />, onSelect: noop },
          { id: "monitor", label: "Overvåg listen", icon: <ShellIcon name="bell" size={16} />, onSelect: noop },
          { id: "delete", label: "Slet", icon: <ShellIcon name="trash" size={16} />, destructive: true, onSelect: noop },
        ]}
      />
    </div>
  );
}

const mobileNav: GalleryEntry[] = [
  { nr: "26a.1", sortAs: "06.4", title: "Topbjælke og bundnavigation (mobil, 26a.1 + 26a.3)", node: "DTS-0", only: "mobile", note: "Kun mobil (intet desktop-modstykke), derfor ved 06. AppShell under 560 px: topbjælke med burger, titel + undertitel, klokke og '…' øverst; bundnavigationen (26a.3, DUY-0) nederst i samme ramme.", render: () => <MobileFrame /> },
  { nr: "26a.2", sortAs: "06.4", title: "Sektionsark (mobil)", node: "DUB-0", only: "mobile", note: "Kun mobil, derfor ved 06. AppShell med sheetOpen: sektionsarket fra burgeren, aktiv i koral-soft.", render: () => <MobileFrame sheetOpen /> },
  {
    nr: "26a.8",
    sortAs: "07.7",
    title: "Formularfelter (mobil)",
    node: "DXR-0",
    only: "mobile",
    note: "FormPage med felterne (feltnavn over feltet, 48 px), kontakt, valgchips og effektpanelet med to knapper.",
    render: () => <MobileForm />,
  },
  {
    nr: "26a.9",
    sortAs: "07.2",
    title: "Bundark (dialog på mobil)",
    node: "DZI-0",
    only: "mobile",
    note: "CreditConfirmDialog åben; under 600 px bliver dialogen bundark.",
    render: () => (
      <div style={{ minHeight: 800 }}>
        <CreditConfirmDialog open balance={38} onClose={noop} onConfirm={noop} description="LASSO X A/S, seneste vurdering er 13 dage gammel." title="Hent ny kreditvurdering?" />
      </div>
    ),
  },
  {
    nr: "15.2",
    sortAs: "15.2",
    title: "Massehandlinger, mobil: bundbjælke over bundnavigationen",
    node: "LOD-0",
    only: "mobile",
    note: "Paper LOA-0/LPJ-0: 2 markeret, Til liste og Eksportér som ikon + ord, Flere og ×; markerede kort uden flade eller kant (kun afkrydsningsboksen). 'Overvåg' som massehandling findes ikke i koden endnu (kræver en værtshandling).",
    render: () => <BulkMobile />,
  },
  {
    nr: "15.2",
    sortAs: "15.2",
    title: "Massehandlinger, mobil: Flere-ark",
    node: "LQP-0",
    only: "mobile",
    note: "Paper LT2-0: handlingsarket (26a.10) med antal og navne som kontekst, Sammenlign, Vælg alle 1.243, Fjern fra liste i rødt og Annuller.",
    render: () => <BulkMobile moreOpen />,
  },
  { nr: "26a.10", sortAs: "07.3", title: "Handlingsark (menu på mobil)", node: "E05-0", only: "mobile", note: "Menu med defaultOpen og kontekst.", render: () => <OpenMenu /> },
  {
    nr: "26a.11",
    sortAs: "07.5",
    title: "Besked / toast (mobil)",
    node: "E0W-0",
    only: "mobile",
    note: "ToastProvider med to beskeder over AppShells bundnavigation.",
    render: () => (
      <ToastProvider
        initial={[
          { text: "“Store IT-selskaber” er gemt", tone: "ok", action: { label: "Fortryd", onClick: noop } },
          { text: "Eksporten kunne ikke hentes", tone: "error", action: { label: "Prøv igen", onClick: noop } },
        ]}
      >
        <MobileFrame />
        <Toasts />
      </ToastProvider>
    ),
  },
];

/* ---------- 26b–26e Mobil: grafer, lister, person, enheder ---------- */

const one = (title: string, component: Record<string, unknown>, kind = "company") => ({ kind, title, components: [component] });


const mobileCharts: GalleryEntry[] = [
];

const mobileLists: GalleryEntry[] = [
  {
    nr: "26c.3",
    sortAs: "10.2",
    title: "Flerårstabel (mobil), variant A og B",
    node: "ED8-0",
    only: "mobile",
    note: "Mobilvarianterne af flerårstabellen (10.2): variant A (ED8-0) øverst, variant B (EEO-0, kort pr. nøgletal) under. B findes kun på mobil.",
    spec: {
      kind: "company",
      title: "Flerårsoversigt",
      components: [
        { type: "LassoMultiYearTable", company: C, title: "Flerårsoversigt", metrics: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"], variant: "A" },
        { type: "LassoMultiYearTable", company: C, title: "Flerårsoversigt, kort pr. nøgletal", metrics: ["bruttofortjeneste", "resultat"], variant: "B" },
      ],
    },
  },
  {
    nr: "26c.8",
    sortAs: "07.7",
    title: "Filterark (mobil)",
    node: "EM6-0",
    only: "mobile",
    note: "FilterSheet åben som bundark (åbnes fra tabellens værktøjslinje): valgchips, rækker med værdi og chevron, kontakt og “Vis N virksomheder”.",
    render: () => <MobileFilterSheet />,
  },
];

const mobilePerson: GalleryEntry[] = [
  { nr: "26d.4", sortAs: "16.2", title: "Aktive roller (mobil)", node: "EQZ-0", only: "mobile", note: "Kun mobil (aktive roller som liste); desktop-modstykket er tidsbåndene i 16.2.", spec: one("Aktive roller", { type: "LassoPersonRoles", person: P, show: "current" }, "person") },
  { nr: "26d.5", sortAs: "16.1", title: "Netværkstal-kort (mobil)", node: "ERR-0", only: "mobile", note: "Kun mobil; LassoPersonStats har ingen desktop-indgang i galleriet.", spec: one("Netværkstal", { type: "LassoPersonStats", person: P }, "person") },
];

const mobileUnits: GalleryEntry[] = [
  { nr: "26e.6", sortAs: "21.3", title: "Push-notifikation (systembanner)", node: "F2X-0", only: "mobile", render: () => <PushBanner event="Konkurs" company="Eksempel Energi A/S" time="nu" /> },
  // 26e.8 Revisor og uafhængighed (mobil) udgår sammen med 22.2 (Jakob 29.09).
];

/* ---------- 26f Tablet 768 ---------- */

const tablet: GalleryEntry[] = [
  dataEntry({ nr: "26f.1", title: "Sideskabelon, tablet 768", node: "F6K-0", only: "desktop", desktopWidth: 768, extraWidths: [834, 1024], note: COMPANY_PAGE_NOTE, probe: companyProbe(), draw: (ds) => <CompanyPage ds={ds} /> }),
  {
    nr: "26f.2",
    extraWidths: [834, 1024],
    title: "Tabel, tablet",
    node: "FAA-0",
    only: "desktop",
    desktopWidth: 768,
    // 26f.2: to aktive kriterier giver "Filter (2)" i kortets hoved.
    spec: {
      kind: "list",
      title: "Kunder",
      criteria: [{ field: "ansatte", operator: "gte", value: 1 }, { field: "status", operator: "eq", value: "aktiv" }],
      components: [{ type: "LassoCompanyTable", title: "Kunder", source: "search", search: { query: "", criteria: [{ field: "ansatte", operator: "gte", value: 1 }, { field: "status", operator: "eq", value: "aktiv" }], limit: 8 }, columns: ["navn", "status", "bruttofortjeneste", "resultat", "ansatte", "score"] }],
    },
  },
  { nr: "26f.3", extraWidths: [834, 1024], title: "Regnskab, tablet", node: "FCA-0", only: "desktop", desktopWidth: 768, spec: one("Regnskab", { type: "LassoFinancialStatements", company: C }) },
  { nr: "26f.4", extraWidths: [834, 1024], title: "Ejerdiagram, tablet", node: "FFB-0", only: "desktop", desktopWidth: 768, spec: one("Ejerdiagram", { type: "LassoOwnershipDiagram", company: C }) },
  { nr: "26f.5", extraWidths: [834, 1024], title: "Sammenligning, tablet", node: "FGO-0", only: "desktop", desktopWidth: 768, spec: one("Sammenligning", { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"] }, "custom") },
];

/* ---------- 26g Mobil: eksempelskærme ----------
   26g.1/26g.2 er taget ud af galleriet (runde 5): de tegner Papers gamle mobilsider (PaperCompanyPage/
   PaperPersonPage stablet), ikke gridmodellens foldning (bånd -> én kolonne i stakkens rækkefølge: hoved,
   nøgletal, profil, oplysninger, relationer, graf, kontakt, historik, nyheder, genveje). De afventer
   redesign i Paper (spor 1) sammen med 24/25. */

/* ---------- 26h Mobil: tilstande og småelementer ---------- */


const mobileStates: GalleryEntry[] = [
  {
    nr: "26h.5",
    sortAs: "14.4",
    title: "Historik-/snapshot-skifter (mobil)",
    node: "GE5-0",
    only: "mobile",
    render: () => <SnapshotPicker subject="Ejerdiagram" what="ejerskab" date="2023-12-31" today="2026-09-29" onChange={noop} />,
  },
];

/* ---------- 27 A4-rapport ---------- */

// Samme spec som apps/server/src/dev/render-preview.ts --report.
const REPORT_SPEC = {
  kind: "company",
  title: "Rapport",
  components: [
    { type: "LassoCompanyHead", company: C },
    { type: "LassoMultiYearTable", company: C, years: 5 },
    { type: "LassoIncomeStatement", company: C, years: 3 },
    { type: "LassoPersonList", company: C, show: "current" },
    { type: "LassoOwnerList", company: C },
    { type: "LassoBeneficialOwners", company: C },
    { type: "LassoScoreGauge", company: C },
    { type: "LassoRiskObservations", company: C },
    { type: "LassoContact", company: C },
    { type: "LassoProductionUnits", company: C },
  ],
};

/** Én side af en A4-rapport: kun side n vises (galleriet tegner hver side som sin egen indgang). */
function A4Only({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className={`e-a4-${n}`} style={{ margin: -24 }}>
      <style>{`.e-a4-${n} .lasso-a4 > .lasso-a4-page:not(:nth-child(${n})){display:none}`}</style>
      {children}
    </div>
  );
}

const A4_NOTE = "Samme A4-mekanisme i portal og chat (LassoView-overlay med Print, værtskapaciteten export). Ingen kildelinje (G3); 'Data pr.' i sidefoden.";

const report: GalleryEntry[] = [
  dataEntry({
    nr: "19.6",
    title: "Regnskabsanalyse som PDF (A4)",
    node: "LZM-0",
    only: "desktop",
    desktopWidth: 860,
    note: `AnalysisReportA4 (Paper LZP-0): det, 'Hent som PDF' i 19.3 laver. Hele analysen med alle afsnit foldet ud, navn, CVR og regnskabsår øverst, 'Tal der indgår i analysen' og forbeholdet til sidst. Lange analyser fortsætter på næste A4 ved udskrift. ${A4_NOTE}`,
    probe: { kind: "company", title: "Regnskabsanalyse", components: [{ type: "LassoCompanyHead", company: C }, { type: "LassoTextSections", company: C, variant: "analyse" }, { type: "LassoMultiYearTable", company: C, years: 5 }] },
    draw: (ds) => <AnalysisReportA4 company={C} dataset={ds} disclaimer={ANALYSIS_DISCLAIMER} generatedAt="2026-09-29T08:00:00Z" />,
  }),
  dataEntry({
    nr: "27.1",
    title: "Standard virksomhedsrapport, side 1 af 2: forside",
    node: "DOE-0",
    only: "desktop",
    desktopWidth: 860,
    note: `ReportA4 (Paper DOE-0): Risikoscore '52 af 100, lav', hovedtal og ansatte; indhold = 4 punkter på side 2. ${A4_NOTE}`,
    probe: REPORT_SPEC,
    draw: (ds) => (
      <A4Only n={1}>
        <ReportA4 company={C} dataset={ds} generatedAt="2026-09-29T08:00:00Z" />
      </A4Only>
    ),
  }),
  dataEntry({
    nr: "27.2",
    title: "Standard virksomhedsrapport, side 2 af 2: overblik (kun det relevante)",
    node: "DPI-0",
    only: "desktop",
    desktopWidth: 860,
    note: `ReportA4 side 2 (Paper DPK-0 + bånd MIT-0): nøgletal (pil + procent), bruttofortjeneste 5 år, ledelse og legale ejere, Risiko (score, måler, 2 vigtigste observationer) og Kontakt og oplysninger. ${A4_NOTE}`,
    probe: REPORT_SPEC,
    draw: (ds) => (
      <A4Only n={2}>
        <ReportA4 company={C} dataset={ds} generatedAt="2026-09-29T08:00:00Z" />
      </A4Only>
    ),
  }),
  dataEntry({
    nr: "27.3",
    title: "Rapport af det man står i: PDF af Regnskab-fanen (princip)",
    node: "FUE-0",
    only: "desktop",
    desktopWidth: 860,
    note: `StatementsReportA4 (Paper FUE-0): eksempel på princippet 'PDF af det man står i' (siden/fanen/elementet som det vises): Regnskab-fanen med sidehoved 'Regnskab, hentet …', side 1 af 1. Rækker uden data udelades. Samme mekanisme bruges af 'Hent som PDF' i regnskabsanalysen (19.3/19.6). ${A4_NOTE}`,
    probe: REPORT_SPEC,
    draw: (ds) => <StatementsReportA4 company={C} dataset={ds} generatedAt="2026-09-29T08:00:00Z" />,
  }),
  dataEntry({
    nr: "27.4",
    title: "Standard personrapport, 1 side",
    node: "FZF-0",
    only: "desktop",
    desktopWidth: 860,
    note: `PersonReportA4 (Paper FZH-0: persontal MK4-0, aktive roller MKS-0, tidligere roller MLF-0, 'Sidder sammen med' + 'Risiko' MLS-0) for Bo Eksempel. Navnet alene i sidehovedet (G9). Findes i personhovedets Eksportér-menu ('Personrapport (PDF)'). ${A4_NOTE}`,
    probe: personProbe(),
    draw: (ds) => <PersonReportA4 person={P} dataset={ds} generatedAt="2026-09-29T08:00:00Z" />,
  }),
];

/* ---------- 28 Øvrige datatyper ---------- */

/* 28.1: værdilisterne tegnes som Paper-dokumentationen: fire paneler og et mobilt filterark. */
const ENUM_CARD: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-card)", padding: 16, background: "var(--lasso-surface)", minWidth: 0 };
const ENUM_OVERLINE: CSSProperties = { margin: "0 0 8px", fontSize: "var(--lasso-fs-label)", lineHeight: "14px", fontWeight: 600, letterSpacing: "var(--lasso-ls-label)", textTransform: "uppercase", color: "var(--lasso-muted)" };
const ENUM_ROW: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minHeight: 30, borderBottom: "1px solid var(--lasso-divider-subtle)", fontSize: "var(--lasso-fs-sm)" };
const ENUM_GROUP: CSSProperties = { margin: "10px 0 2px", fontSize: 12, fontWeight: 400, color: "var(--lasso-muted)" };

/* 28.1 (Paper H0N-0): de 19 statusser i fire farvegrupper, brug i filtre (02) og mobilt filterark. */
const STATUS_GROUP_TITLE: Record<string, string> = { active: "Aktiv, tekstfarve", temporary: "Midlertidig, ikke krise, warning-tekst", problem: "Problem, mørk rød", inactive: "Inaktiv, muted" };
const STATUS_GROUP_WORD: Record<string, string> = { active: "tekstfarve", temporary: "warning-tekst", problem: "mørk rød", inactive: "muted" };

function Statuses() {
  const filter: [string, boolean][] = [
    ["Aktiv (1.243.501)", true],
    ["Under konkurs (eksempel)", false],
    ["Ophørt (eksempel)", false],
  ];
  return (
    <div className="lasso-enums" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      <div style={{ ...ENUM_CARD, padding: 0, width: 370, maxWidth: "100%" }}>
        <p style={{ ...ENUM_OVERLINE, margin: 0, padding: "12px 14px", borderBottom: "1px solid var(--lasso-border)" }}>Status (19 værdier, 4 farvegrupper)</p>
        <div style={{ padding: "4px 14px 12px" }}>
          {STATUS_GROUPS.map((g) => (
            <div key={g.group}>
              <p style={ENUM_GROUP}>{STATUS_GROUP_TITLE[g.group]}</p>
              {g.statuses.map((st) => {
                const tone = statusTone(st, statusKind(st) ?? "active");
                return (
                  <div key={st} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minHeight: 22, fontSize: "var(--lasso-fs-sm)" }}>
                    <span className={`lasso-status lasso-status--${tone}`}>{st}</span>
                    <span style={{ fontSize: 12, color: "var(--lasso-muted)" }}>{STATUS_GROUP_WORD[g.group]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, width: 300, maxWidth: "100%" }}>
        <p style={{ ...ENUM_OVERLINE, margin: 0 }}>Brug i filtre (02)</p>
        <div style={ENUM_CARD}>
          <p style={{ margin: "0 0 6px", fontSize: "var(--lasso-fs)", fontWeight: 600, color: "var(--lasso-text)" }}>Status</p>
          {filter.map(([label, on]) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 22, fontSize: "var(--lasso-fs-sm)", color: "var(--lasso-text)" }}>
              <input type="checkbox" defaultChecked={on} style={{ accentColor: "var(--lasso-accent)" }} />
              {label}
            </label>
          ))}
          <p className="lasso-more" style={{ margin: "8px 0 0" }}>Vis alle 19 statusser</p>
        </div>
      </div>
      {/* Mobil: filterark med 44 px rækker og koral flueben ved det valgte (ikke afklippet). */}
      <div style={{ ...ENUM_CARD, width: 300, maxWidth: "100%" }}>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--lasso-muted)" }}>Mobil, filterark</p>
        <p style={{ margin: "0 0 6px", fontSize: "var(--lasso-fs)", fontWeight: 600, color: "var(--lasso-text)" }}>Status</p>
        {["Aktiv", "Under konkurs", "Ophørt"].map((st, i) => (
          <div key={st} style={{ ...ENUM_ROW, minHeight: 54, alignItems: "center", fontSize: "var(--lasso-fs)" }}>
            <span>{st}</span>
            {i === 0 ? <span style={{ color: "var(--lasso-accent)", fontWeight: 600 }} aria-label="valgt">✓</span> : null}
          </div>
        ))}
        <p className="lasso-more" style={{ margin: "14px 0 0" }}>Vis alle 19</p>
      </div>
    </div>
  );
}

/* 28.10 (Paper M4O-0): virksomhedsform, ansatte-interval og enhedstype i én kolonne (M5M-0). */
function ValueLists() {
  const forms: [string, string, string][] = [
    ["ENK", "Enkeltmandsvirksomhed", "34,3 %"],
    ["ApS", "Anpartsselskab", "33,9 %"],
    ["A/S", "Aktieselskab", "4,2 %"],
    ["I/S", "Interessentskab", "eksempel"],
  ];
  const text: CSSProperties = { margin: 0, fontSize: "var(--lasso-fs-sm)", lineHeight: "20px", color: "var(--lasso-text)" };
  return (
    <div style={{ ...ENUM_CARD, padding: 0, width: 330, maxWidth: "100%" }}>
      <p style={{ ...ENUM_OVERLINE, margin: 0, padding: "12px 14px", borderBottom: "1px solid var(--lasso-border)" }}>Virksomhedsform (40+, kode og andel)</p>
      <div style={{ display: "grid", gap: 16, padding: "10px 14px 14px" }}>
        <div>
          {forms.map(([code, name, share]) => (
            <div key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minHeight: 23, fontSize: "var(--lasso-fs-sm)" }}>
              <span style={{ color: "var(--lasso-text)" }}>
                <span style={{ display: "inline-block", width: 48, color: "var(--lasso-muted)" }}>{code}</span>
                {name}
              </span>
              <span style={{ fontSize: 12, color: "var(--lasso-muted)" }}>{share}</span>
            </div>
          ))}
          <p className="lasso-more" style={{ margin: "8px 0 0" }}>Vis alle former</p>
        </div>
        <div>
          <p style={ENUM_OVERLINE}>Ansatte-interval (11)</p>
          <p style={text}>0, 1, 2–4, 5–9, 10–19, 20–49, 50–99, 100–199, 200–499, 500–999, 1.000+</p>
        </div>
        <div>
          <p style={ENUM_OVERLINE}>Enhedstype (4)</p>
          <p style={text}>Person, Virksomhed, Produktionsenhed, Anden enhed (typisk udenlandsk)</p>
        </div>
      </div>
    </div>
  );
}

const datatypes: GalleryEntry[] = [
  {
    nr: "28.1",
    title: "Statusser: 19 værdier i fire farvegrupper",
    node: "H0N-0",
    only: "desktop",
    note: "Paper H0N-0 (companies/enumerations): statuskolonnen H0U-0 med de fire grupper fra STATUS_GROUPS/statusTone (aktiv tekstfarve, midlertidig warning-tekst, problem mørk rød, inaktiv muted), 'Brug i filtre (02)' H2Q-0 og mobilt filterark H37-0. Status hentes fra API'et og hardkodes aldrig; ren tekst, vægt 500, ingen pille. Øvrige værdilister står i 28.10.",
    render: () => <Statuses />,
  },
  {
    nr: "28.10",
    title: "Værdilister: virksomhedsform, ansatte-interval, enhedstype",
    node: "M4O-0",
    only: "desktop",
    note: "Paper M4O-0 (nyt nummer, kolonne M5M-0): form med kode først i muted og fuld tekst efter; andelen (procent af alle virksomheder) er valgfri og kun i lister, hvor den giver mening. Ansatte-intervaller med tankestreg og '1.000+' for det åbne interval. Enhedstype styrer, om en deltager linker til person, virksomhed, P-enhed eller vises som udenlandsk uden link. Statusser står i 28.1.",
    render: () => <ValueLists />,
  },
  { nr: "28.2", title: "Regnskabspublicering (nyt/korrigeret regnskab)", node: "H3L-0", spec: one("Regnskabspublicering", { type: "LassoPublications", company: C }) },
  {
    nr: "28.3",
    title: "Opdateringer på personer og P-enheder",
    node: "H5N-0",
    render: () => (
      <EntityUpdates
        title={'Ændringer i "Kunder"'}
        subtitle="Personer og P-enheder, eksempeldata"
        now={new Date(2026, 8, 29, 12, 0)}
        items={[
          { id: "1", subject: "Anne Eksempel", subjectKind: "person", type: "Person, ledelse", text: "Tiltrådt som direktør i Nordisk Datacenter A/S", at: "2026-09-29T09:14:00", source: "gældende fra 01.09.2026" },
          { id: "2", subject: "Peter Eksempel", subjectKind: "person", type: "Person, ejerskab", text: "Reel ejer i Holm Holding ApS", from: "50–66,66 %", to: "66,67–89,99 %", at: "2026-09-29T08:02:00", source: "registreret 24.09.2026" },
          { id: "3", subject: "LASSO X A/S", subjectKind: "company", type: "P-enhed tilføjet", text: "Ny produktionsenhed: LASSO X, Aarhus (eksempel), P-nr. 1000000022", at: "2026-09-28T16:40:00", source: "24.09.2026, eksempeldata" },
          { id: "4", subject: "Hosting Eksempel ApS", subjectKind: "company", type: "P-enhed opdateret", text: "Lager, Lyngby: ansatte 2–4 → 5–9, adresse uændret", at: "2026-09-28T11:20:00", source: "24.09.2026, eksempeldata" },
          { id: "5", subject: "Cloud Eksempel A/S", subjectKind: "company", type: "P-enhed fjernet", text: "Produktionsenhed Butik, Odense er ophørt (P-nr. 1000000023)", at: "2026-09-22", source: "22.09.2026, eksempeldata" },
        ]}
      />
    ),
  },
  {
    nr: "28.4",
    title: "Rapportbestilling og batchstatus",
    node: "H7M-0",
    render: () => (
      <ReportBatches
        order={{ count: 142, listName: "Kunder", defaultName: "Kunder Q3", onOrder: noop }}
        batches={[
          { id: "a", name: "Kunder Q3", reportType: "Revision", createdAt: "2026-09-29", status: "running", done: 87, total: 142, count: 142, format: "PDF", owner: "Anne Eksempel" },
          { id: "b", name: "Reelle ejere, revisionskunder", reportType: "Reelle ejere", createdAt: "2026-09-28", status: "failed", done: 36, total: 38, count: 38, format: "Zip", errors: ["CVR 10000001 ukendt", "CVR 10000002 ophørt"] },
          { id: "c", name: "Finansrapport, LASSO X A/S", reportType: "Finans", createdAt: "2026-09-22", status: "done", count: 1, format: "PDF" },
          { id: "d", name: "Månedskørsel oktober", reportType: "Revision udvidet", createdAt: "2026-10-01", status: "planned", count: 210, format: "Zip" },
        ]}
        onAction={noop}
      />
    ),
  },
  {
    nr: "28.5",
    title: "Personsøgning og søgeresultat med \"fundet via\"",
    node: "HAL-0",
    render: () => (
      <PersonSearchResults
        query="jakob bech company:lasso"
        searchKind="persons"
        summary={"2 personer fundet, filtreret på selskab 'lasso'"}
        rows={[
          { lassoId: "CVR-3-4000000001", name: "Jakob Bech Benediktson", city: "Kongens Lyngby (eksempel)", companies: ["LASSO X A/S", "Benediktson Holding ApS"], totalCompanyCount: 3, rolesText: "3 selskaber, 4 roller (eksempel)", foundVia: "navn" },
          { lassoId: "CVR-3-4000000002", name: "Jeppe Andreas Bech Madsen", city: "København (eksempel)", companies: ["LASSO X A/S", "JEBEMA Holding ApS"], totalCompanyCount: 2, rolesText: "2 selskaber, 3 roller (eksempel)", foundVia: "navn" },
          { lassoId: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", sub: "CVR 34580820, København K", companies: [], foundVia: "binavn 'Lasso' (eksempel)" },
        ]}
      />
    ),
  },
  { nr: "28.6", title: "Fusioner og spaltninger", node: "HCC-0", spec: one("Fusioner og spaltninger", { type: "LassoMergers", company: C }) },
  dataEntry({
    nr: "28.7",
    title: "Regnskabsoplysninger, bibrancher, kapital, tegningsregel og formål",
    node: "HDZ-0",
    note: "LassoRegistration: to kort (regnskabsoplysninger, kapital og vedtægter), tegningsregel og formål foldet til to linjer. Under: Papers eksempelrække for et B-selskab med fravalgt revision (samme ValueRow og warning-tekst som komponenten).",
    probe: one("Oplysninger", { type: "LassoRegistration", company: C }),
    draw: (ds) => (
      <div className="lasso-root" data-theme="light" style={stack(16)}>
        <LassoView spec={parseViewSpec(one("Oplysninger", { type: "LassoRegistration", company: C }))} dataset={ds} host={{}} onAction={noop} theme="light" frameless />
        <div className="lasso-reg lasso-span-full" style={{ padding: "0 24px" }}>
          <Section title="Revision, eksempel B-selskab" card>
            <div className="lasso-reg__rows">
              <ValueRow label="Revision">
                <span>
                  <span className="lasso-reg__warn">Fravalgt</span>
                  <span className="lasso-reg__muted">, siden regnskabsåret 2024</span>
                </span>
              </ValueRow>
            </div>
          </Section>
        </div>
      </div>
    ),
  }),
  { nr: "28.8", title: "Statstidende, seneste bekendtgørelser", node: "HGH-0", spec: one("Statstidende", { type: "LassoAnnouncements", company: "CVR-1-99000011" }) },
  {
    nr: "28.9",
    title: "Reelle ejere: fritagelse, ledelsen som reelle ejere, kunne ikke identificeres",
    node: "HHS-0",
    note: "Tre kort side om side som i Paper (ét pr. særlig tilstand); den almindelige liste med 'via rolle' står i 11.",
    render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <div>
        <LassoBeneficialOwners
          source="CVR, Fokus Eksempel A/S, eksempeldata"
          ownership={{
            lassoId: "CVR-1-1",
            special: { kind: "management", fallback: "management", reason: "Ingen reelle ejere er registreret. Ledelsen er indsat som reelle ejere, fordi ingen ejer over 25 % af kapital eller stemmer." },
            owners: [
              { name: "Anne Eksempel", lassoId: "CVR-3-4000000001", role: "Adm. direktør" },
              { name: "Peter Eksempel", lassoId: "CVR-3-4000000002", role: "Direktør" },
            ],
          }}
        />
        </div>
        <div>
        <LassoBeneficialOwners
          source="CVR, Fritaget Eksempel A/S, eksempeldata"
          ownership={{
            lassoId: "CVR-1-2",
            owners: [],
            special: {
              kind: "exempt",
              reason: "Selskabet er fritaget for at registrere reelle ejere, fordi det er børsnoteret på et reguleret marked.",
              caveat: "Fritagelsen er registreret i CVR; Lasso kontrollerer ikke grundlaget.",
            },
          }}
        />
        </div>
        <div>
        <LassoBeneficialOwners
          source="CVR, Ukendt Eksempel ApS, eksempeldata"
          ownership={{ lassoId: "CVR-1-3", owners: [], special: { kind: "unidentified", reason: "Selskabet har oplyst, at det ikke kan identificere sine reelle ejere, og at ledelsen derfor er registreret." } }}
        />
        </div>
      </div>
    ),
  },
];

/* ---------- 29 Fanebjælke, tre niveauer ---------- */

const L1: TabItem[] = [
  { id: "overblik", label: "Overblik" },
  { id: "oekonomi", label: "Økonomi" },
  { id: "regnskab", label: "Regnskab" },
  { id: "ejerskab", label: "Ejerskab" },
  { id: "ledelse", label: "Ledelse" },
  { id: "historik", label: "Historik" },
  { id: "kontakt", label: "Kontakt" },
  { id: "nyheder", label: "Nyheder" },
  { id: "tvilling", label: "Tvilling" },
];

/** Nøgle-værdi-rækker (09) til eksemplerne i 29.3–29.5. */
function KvRows({ rows, skeleton = false }: { rows: readonly [string, string][]; skeleton?: boolean }) {
  return (
    <div className="lasso-kv-list lasso-kv-list--financials" style={{ borderTop: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} className="lasso-kv-row">
          <div className="lasso-kv-row__label">{k}</div>
          <div className="lasso-kv-row__value">{skeleton ? <span className="lasso-skeleton" style={{ display: "inline-block", width: 64, height: 10, verticalAlign: "middle" }} /> : v}</div>
        </div>
      ))}
    </div>
  );
}

const KEY_ROWS: [string, string][] = [
  ["Bruttofortjeneste", formatAmount(18_834_000)],
  ["Resultat efter skat", formatAmount(-201_000)],
  ["Egenkapital", formatAmount(3_214_000)],
];

/** 29.1: tilstandsrækken - valgt, hvile, hover (Regnskab), fokus (Ejerskab), "Flere". Faner uden data vises ikke (29.2). */
function Level1() {
  const [v, setV] = useState("overblik");
  return (
    <div>
      {caption("Niveau 1, sideniveau, 48 px: valgt, hvile, hover (Regnskab), fokus (Ejerskab) og 'Flere' ved mere end 8 faner")}
      <Tabs level={1} items={L1} value={v} onChange={setV} ariaLabel="Sider" hoverId="regnskab" focusId="ejerskab" />
      {/* Papers forklaringer under rækken (IWK-0). */}
      {/* Kontrol r5 (29.1 mobil): forklaringen i to kolonner på mobil, så teksterne ikke ligger oven i hinanden */}
      <style>{".gal-l1legend{grid-template-columns:repeat(6,minmax(0,1fr))}@media (max-width:560px){.gal-l1legend{grid-template-columns:repeat(2,minmax(0,1fr))}}"}</style>
      <div className="gal-l1legend" style={{ display: "grid", gap: 24, marginTop: 16 }}>
        {[
          ["Valgt", "Ink 600, 2 px koral understregning i fanens bredde"],
          ["Hvile", "Text-secondary 400, ingen streg"],
          ["Hover", "Tekst bliver ink, 2 px divider-streg, ingen baggrund"],
          ["Fokus", "1 px koral kant (primary-border) omkring navnet, radius 6, kun ved tastatur"],
          ["Uden data", "Fanen vises ikke. Kun faner, der har data, står i bjælken (alle niveauer)"],
          ["Flere", "Ved mere end 8 faner: \"Flere\" med pil åbner menu (07)"],
        ].map(([t, d]) => (
          <div key={t}>
            <div style={{ fontSize: "var(--lasso-fs)", lineHeight: "20px", fontWeight: 600, color: "var(--lasso-text)" }}>{t}</div>
            <div className="lasso-small" style={{ color: "var(--lasso-text-2)" }}>{d}</div>
          </div>
        ))}
      </div>
      <p className="lasso-small" style={{ ...muted, margin: "16px 0 0" }}>
        Højde 48, tekst 14, gap 28 mellem faner, ingen vandret padding på fanen, 1 px divider under hele rækken, understregning ligger oven på divideren.
      </p>
    </div>
  );
}

/** 29.2: sektionsoverskrift med enhed på samme linje; valgt, hvile, hover (Pengestrøm), fokus (Nøgletal). Kun faner med data. */
function Level2() {
  const [v, setV] = useState("resultat");
  return (
    <Section title="Regnskab" subtitle="t. kr., årsrapport 2025" inlineSubtitle>
      <Tabs
        level={2}
        items={[
          { id: "resultat", label: "Resultatopgørelse" },
          { id: "balance", label: "Balance" },
          { id: "pengestroem", label: "Pengestrøm" },
          { id: "noegletal", label: "Nøgletal" },
        ]}
        value={v}
        onChange={setV}
        ariaLabel="Opgørelse"
        hoverId="pengestroem"
        focusId="noegletal"
      />
    </Section>
  );
}

/** 29.3: tre eksempler side om side med indhold under hovedet. */
function Level3() {
  const person = (name: string, title: string, role: string) => (
    <div className="lasso-kv-row" style={{ minHeight: 52 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: "var(--lasso-text)" }}>{name}</div>
        <div className="lasso-small lasso-muted">{title}</div>
      </div>
      <div className="lasso-small" style={{ color: "var(--lasso-text-2)" }}>{role}</div>
    </div>
  );
  return (
    <div className="gal-l3" style={{ display: "grid", gap: 40, alignItems: "start" }}>
      {/* Kontrol r5 (29.3 mobil): én kolonne på mobil (ingen overlap, segmentkontrollen klippes ikke) */}
      <style>{".gal-l3{grid-template-columns:repeat(3,minmax(0,1fr))}@media (max-width:560px){.gal-l3{grid-template-columns:minmax(0,1fr);gap:28px!important}}"}</style>
      <div><Section title="Nøgletal" action={<TabsDemo level={3} items={["2025", "2024", "2023"].map((y) => ({ id: y, label: y }))} value="2025" ariaLabel="Vælg regnskabsår" />}>
        <KvRows rows={KEY_ROWS} />
      </Section></div>
      <div><Section
        title="Ledelse"
        action={
          <TabsDemo
            level={3}
            items={[
              { id: "nu", label: "Nuværende" },
              { id: "alle", label: "Alle" },
            ]}
            value="nu"
            ariaLabel="Nuværende eller alle"
          />
        }
      >
        <div className="lasso-kv-list" style={{ borderTop: 0 }}>
          {person("Jakob Eksempel", "Administrerende direktør", "Direktion")}
          {person("Sofie Eksempel", "Bestyrelsesformand", "Bestyrelse")}
        </div>
      </Section></div>
      <div style={stack(12)}>
        <Tabs
          level={3}
          items={[
            { id: "selskab", label: "Selskab" },
            { id: "koncern", label: "Koncern" },
          ]}
          value="selskab"
          onChange={noop}
          ariaLabel="Selskab eller koncern"
          focusId="koncern"
        />
        {/* 29.3 (Jakob 29.09): ikke År/Halvår/Kvartal (kun årsregnskaber, 19.1), men opgørelsen. */}
        <TabsDemo
          level={3}
          items={[
            { id: "resultat", label: "Resultat" },
            { id: "balance", label: "Balance" },
            { id: "pengestroem", label: "Pengestrøm" },
          ]}
          value="resultat"
          ariaLabel="Opgørelse"
        />
      </div>
    </div>
  );
}

/** 29.4: fanen skifter straks; panelet viser skelet i det fyldte indholds mål. Til højre niveau 3, hvor kun værdierne er skelet. */
function Loading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 40, alignItems: "start" }}>
      <div>
        <Tabs level={1} id="e-l4" items={L1.slice(0, 4)} value="oekonomi" onChange={noop} ariaLabel="Sider, henter" />
        <TabPanel id="e-l4" tab="oekonomi" loading loadingShape="overview" loadingLabel="Økonomi">
          <p>Indhold</p>
        </TabPanel>
      </div>
      <div><Section title="Nøgletal" action={<TabsDemo level={3} items={["2025", "2024", "2023"].map((y) => ({ id: y, label: y }))} value="2024" ariaLabel="Vælg regnskabsår" />}>
        <KvRows rows={KEY_ROWS} skeleton />
        <p className="lasso-small lasso-muted" style={{ margin: "12px 0 0" }}>På niveau 3 bliver etiketterne stående og kun værdierne bliver skelet, så listen ikke hopper.</p>
      </Section></div>
    </div>
  );
}

/** 29.5: mobil 390 tegnet som telefonramme med niveau 1, 2 og 3. */
function PhoneTabs() {
  const [l1, setL1] = useState("oekonomi");
  const [l2, setL2] = useState("resultat");
  const [l3, setL3] = useState("2025");
  return (
    <div style={{ border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-toast)", overflow: "hidden", background: "var(--lasso-surface)" }}>
      {/* 29.5: samme topbjælke som 26a.1 (burger, titel + undertitel, klokke og "…"). */}
      <header className="lasso-mobilebar">
        <span className="lasso-mobilebar__btn" aria-hidden="true">
          <ShellIcon name="menu" size={20} />
        </span>
        <div className="lasso-mobilebar__titles">
          <div className="lasso-mobilebar__title">LASSO X A/S</div>
          <div className="lasso-mobilebar__subtitle">Økonomi</div>
        </div>
        <div className="lasso-mobilebar__tools">
          <span className="lasso-mobilebar__btn" aria-hidden="true">
            <ShellIcon name="bell" size={20} />
          </span>
          <span className="lasso-mobilebar__btn" aria-hidden="true">
            <ShellIcon name="more" size={20} />
          </span>
        </div>
      </header>
      <div style={{ padding: "16px 16px 0" }}>
        {/* G9 (Jakob 29.09): kun navnet i hovedet, ingen faktalinje under. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: 600, color: "var(--lasso-text)" }}>LASSO X A/S</span>
          <span className="lasso-small lasso-muted">Aktiv</span>
        </div>
      </div>
      <div style={{ padding: "8px 0 0 16px" }}>
        <Tabs level={1} items={L1.slice(0, 6)} value={l1} onChange={setL1} ariaLabel="Sider" />
      </div>
      <div style={{ padding: "24px 16px 0" }}>
        <Section title="Regnskab" subtitle="t. kr." inlineSubtitle>
          <Tabs
            level={2}
            items={[
              { id: "resultat", label: "Resultatopgørelse" },
              { id: "balance", label: "Balance" },
              { id: "pengestroem", label: "Pengestrøm" },
              { id: "noegletal", label: "Nøgletal" },
            ]}
            value={l2}
            onChange={setL2}
            ariaLabel="Opgørelse"
          />
        </Section>
      </div>
      <div style={{ padding: "24px 16px 16px" }}>
        <Section title="Nøgletal" action={<Tabs level={3} items={["2025", "2024", "2023"].map((y) => ({ id: y, label: y }))} value={l3} onChange={setL3} ariaLabel="Vælg regnskabsår" />}>
          <KvRows rows={KEY_ROWS} />
        </Section>
      </div>
    </div>
  );
}

const PHONE_NOTES: [string, string][] = [
  ["Niveau 1 på mobil", "Samme 48 px og 14 px tekst. Rækken ruller vandret uden synlig scrollbar, 40 px hvid fade i højre kant så længe der er mere, gap 24, første fane 16 px fra kanten. Den valgte fane rulles ind i syne ved sideskift. Ingen \"Flere\"-menu på mobil; alle faner ligger i rullen."],
  ["Niveau 2 på mobil", "Samme 36 px og 13 px tekst, ruller vandret med fade som niveau 1. Touch-målet er hele 44 px-højden inkl. 4 px luft over rækken."],
  ["Niveau 3 på mobil", "Segmentkontrollen flytter ned under elementets overskrift, fylder hele bredden med lige brede segmenter, højde 44 og tekst 14. Ved mere end 3 segmenter bliver den til en 44 px dropdown der åbner som handlingsark (26a)."],
  ["Tastatur og tilgængelighed", "Fanebjælken er role=\"tablist\" med aria-label, hver fane role=\"tab\" med aria-selected og aria-controls, panelet role=\"tabpanel\" med aria-labelledby. Kun den valgte fane er i tab-rækkefølgen; pil venstre/højre flytter og vælger, Home/End går til første/sidste, Tab går videre ind i panelet. Faner uden data vises ikke. Gælder alle tre niveauer, også segmentkontrollen."],
  ["Kodenavn", "Én komponent, LassoTabs, med level 1, 2 eller 3, styret udefra (value + onChange) så indholdet kan hentes ved skift. Årsvælgeren (09), Nuværende/Alle (11, 24) og segmentet i 19 bruger niveau 3 fremover."],
];

function Phone29() {
  return (
    <div style={stack(24)}>
      <PhoneTabs />
      <div style={stack(14)}>
        {PHONE_NOTES.map(([h, t]) => (
          <div key={h}>
            <div style={{ fontSize: "var(--lasso-fs-sm)", fontWeight: 600, color: "var(--lasso-text)" }}>{h}</div>
            <p className="lasso-small lasso-muted" style={{ margin: "2px 0 0", overflowWrap: "anywhere" }}>
              {t}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const tabs: GalleryEntry[] = [
  { nr: "29.1", title: "Fanebjælke niveau 1 (sideniveau)", node: "IWK-0", note: "Hover (Regnskab) og fokus (Ejerskab) er tegnet statisk med Tabs hoverId/focusId.", render: () => <Level1 /> },
  { nr: "29.2", title: "Fanebjælke niveau 2 (sektionsniveau)", node: "IXR-0", note: "Hover (Pengestrøm) og fokus (Nøgletal) er tegnet statisk med Tabs hoverId/focusId. Kun faner, der har data, vises (ingen deaktiverede faner, alle niveauer).", render: () => <Level2 /> },
  { nr: "29.3", title: "Segmentkontrol niveau 3 (i et element)", node: "IYR-0", note: "Fokus på Koncern er tegnet statisk med focusId. Eksemplet År/Halvår/Kvartal er erstattet af Resultat/Balance/Pengestrøm (kun årsregnskaber, 19.1).", render: () => <Level3 /> },
  { nr: "29.4", title: "Fanebjælke, henter (skelet)", node: "J0D-0", note: "Skeletterne er i bevægelse (et lyst skær glider fra venstre mod højre, 1,6 s; stille ved prefers-reduced-motion); billedet her er statisk. TabPanel loadingShape=\"overview\" med luft til fanebjælken; til højre niveau 3, hvor etiketterne står og kun værdierne er skelet.", render: () => <Loading /> },
  { nr: "29.5", title: "Fanebjælke, mobil 390", node: "J1Z-0", only: "mobile", note: "Telefonramme med niveau 1 og 2 (vandret rul med fade) og niveau 3 i fuld bredde; forklaringerne står under rammen.", render: () => <Phone29 /> },
];

/* ---------- 30 Layout: svarniveauer og mønstre ---------- */

const head = (variant: "line" | "compact") => ({ type: "LassoCompanyHead", company: C, variant });

const ANSWER_B = [
  head("compact"),
  { type: "LassoKeyFigureCards", company: C, width: "full" },
  { type: "LassoBarChart", company: C, width: "half" },
  { type: "LassoKeyValueList", company: C, variant: "financials", exclude: ["omsaetning", "resultat", "egenkapital", "ansatte"], width: "half" },
  { type: "LassoTextSections", company: C, variant: "analyse", width: "full" },
];

/** 30.2 og 30.13: niveau B slutter med ét link til hele siden (G3: ingen kildelinje). */
const ANSWER_B_FOOT = { next: { label: "Åbn Eksempel Byg A/S i Lasso", prompt: "Fortæl om Eksempel Byg A/S" } };

/** 30.3: niveau C i chatten = fuldt hoved med modulbjælken (niveau 1) under, første modul åbent, og Lasso-bundlinje. */
function AnswerC({ ds }: { ds: Dataset }) {
  const [focus, setFocus] = useState("overblik");
  const spec: ViewSpec = { ...companySpec(ds, false), answer: { logo: true } };
  return (
    <LassoView
      spec={spec}
      dataset={ds}
      host={{ save: false, drillDown: true, openSection: true, monitor: true, savePage: true, export: true }}
      headTabs={{ items: COMPANY_MODULES, value: focus, onChange: setFocus, ariaLabel: "Moduler" }}
      onAction={noop}
      theme="light"
      frameless
    />
  );
}


/* 30.11: fem moduleksempler, hvert med sit mønster og sin modulværktøjslinje (56 px, primær handling
   yderst til venstre, visningsvalg yderst til højre, tynd linje under). */
const MODULES_PROBE = {
  kind: "company",
  title: "Moduler",
  components: [
    { type: "LassoCompanyHead", company: C },
    { type: "LassoKeyFigureCards", company: C },
    { type: "LassoMultiYearTable", company: C },
    { type: "LassoOwnershipDiagram", company: C },
    { type: "LassoRelations", company: C },
    { type: "LassoNews", company: C, limit: 4 },
    { type: "LassoTimeline", company: C, limit: 6 },
    { type: "LassoKeyValueList", company: C, variant: "company" },
    { type: "LassoPersonList", company: C },
    { type: "LassoScoreGauge", company: C },
    { type: "LassoLineChart", company: C, metric: "bruttofortjeneste", industry: true },
    { type: "LassoRiskObservations", company: C },
  ],
};

function Seg({ items, level = 3 }: { items: readonly string[]; level?: 2 | 3 }) {
  const [v, setV] = useState(items[0]!);
  return <Tabs level={level} items={items.map((l) => ({ id: l, label: l }))} value={v} onChange={setV} ariaLabel="Visning" />;
}
const ghost = (label: string) => (
  <button key={label} type="button" className="lasso-btn lasso-btn--ghost">
    {label}
  </button>
);

function ModuleExample({ title, pattern, text, toolbar, children }: { title: string; pattern: string; text: string; toolbar: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 32, borderBottom: "1px solid var(--lasso-border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--lasso-text)" }}>{title}</span>
        <span className="lasso-small" style={muted}>{pattern}</span>
      </div>
      <p className="lasso-small" style={{ ...muted, margin: 0, maxWidth: 760 }}>{text}</p>
      {toolbar}
      {children}
    </section>
  );
}

/**
 * 30.11 Nøgletal (Paper JV3-0): linjegrafen viser de nøgletal, der er krydset af i flerårstabellen
 * (her tre serier fra start); afkrydsningen styrer grafen (LineChart extraMetrics + MultiYearTable onChartToggle).
 */
function KeyFigureModule({ ds }: { ds: Dataset }) {
  const [picked, setPicked] = useState<Metric[]>(["bruttofortjeneste", "resultat", "egenkapital"]);
  const fin = ds.financials[C];
  const [first, ...rest] = picked.length ? picked : (["bruttofortjeneste"] as Metric[]);
  return (
    <div className="lasso-root" data-theme="light">
      <main className="lasso-content lasso-content--grid-4">
        <div className="lasso-cell lasso-cell--full">
          <LineChart financials={fin} metric={first!} extraMetrics={rest} years={5} title="Udvikling" companyName={ds.companies[C]?.name} />
        </div>
        <div className="lasso-cell lasso-cell--full">
          <MultiYearTable financials={fin} years={5} chartMetrics={picked} onChartToggle={(m, on) => setPicked((cur) => (on ? [...cur.filter((x) => x !== m), m] : cur.filter((x) => x !== m)))} />
        </div>
      </main>
    </div>
  );
}

function FiveModules({ ds }: { ds: Dataset }) {
  const view = (components: Record<string, unknown>[]) => (
    <LassoView spec={parseViewSpec({ kind: "company", title: "Modul", ...(components.some((c) => c.column) ? { layout: "columns", columns: 3 } : {}), components })} dataset={ds} host={{ drillDown: true }} onAction={noop} theme="light" frameless />
  );
  return (
    <div className="lasso-root" data-theme="light" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <ModuleExample title="Nøgletal" pattern="mønster 1 + 4: graf fuld, flerårstabel fuld" text="Linjegrafen i fuld bredde og flerårstabellen (5 år) under. Print til venstre; Vend graf og Selskab/Koncern som visningsvalg til højre." toolbar={<ModuleToolbar className="lasso-toolbar--module" primary={{ label: "Print" }} controls={<>{ghost("Vend")}<Seg items={["Selskab", "Koncern"]} /></>} />}>
        <KeyFigureModule ds={ds} />
      </ModuleExample>
      <ModuleExample title="Ejerdiagram" pattern="mønster 2" text="Diagrammet ¾ med relationerne ¼ ved siden. Udskriv til venstre; Layout til højre. Ingen Gem eller Rediger (G5: data kommer i realtid og kan ikke gemmes eller rettes)." toolbar={<ModuleToolbar className="lasso-toolbar--module" primary={{ label: "Udskriv" }} controls={ghost("Layout")} />}>
        {view([{ type: "LassoOwnershipDiagram", company: C, width: "three-quarters" }, { type: "LassoRelations", company: C, width: "quarter" }])}
      </ModuleExample>
      <ModuleExample title="Nyheder" pattern="mønster 8" text="Faner niveau 2 over kildernes strømme, artiklerne som kortgitter. Filtre yderst til højre." toolbar={<ModuleToolbar className="lasso-toolbar--module" field={<Seg level={2} items={["Lasso", "Artikler", "Ritzau", "Statstidende"]} />} controls={ghost("Filtre")} />}>
        {view([{ type: "LassoNews", company: C, limit: 4, layout: "grid" }])}
      </ModuleExample>
      <ModuleExample title="Historik" pattern="mønster 6, spejlet: øjebliksbillede ⅓, tidslinje ⅔" text="Datoen styrer venstre side: oplysningerne pr. dato (adresse, ledelse, ejere, revisor). Til højre tidslinjen med årsmarkører og ændringer som før → efter. Print til venstre; Vælg dato og Filtrer til højre." toolbar={<ModuleToolbar className="lasso-toolbar--module" primary={{ label: "Print" }} controls={<>{ghost("Vælg dato")}{ghost("Filtrer")}</>} />}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 12 }}>
            <SnapshotPicker subject="Oplysninger" what="oplysninger" date="2024-06-01" today="2026-09-29" onChange={noop} />
            {view([{ type: "LassoKeyValueList", company: C, variant: "company", title: "Oplysninger pr. 01.06.2024" }, { type: "LassoPersonList", company: C }])}
          </div>
          <div style={{ borderLeft: "1px solid var(--lasso-border)" }}>{view([{ type: "LassoTimeline", company: C, limit: 6 }])}</div>
        </div>
      </ModuleExample>
      <ModuleExample title="Firmaindsigt" pattern="mønster 9" text="Hoved med score og sektionerne som harmonika, første række åben. Udskriv til venstre; Ejerdiagram til højre." toolbar={<ModuleToolbar className="lasso-toolbar--module" primary={{ label: "Udskriv" }} controls={ghost("Ejerdiagram")} />}>
        {/* 30.11: identitet-cellen (hoved + nøgleoplysninger) er lige så høj som score og tal; nøgletalskortene i den rolige form (variant 'plain', ingen sparkline). */}
        {view([
          { type: "LassoCompanyHead", company: C, variant: "compact", width: "half", column: 1 },
          { type: "LassoKeyValueList", company: C, variant: "company", title: "Nøgleoplysninger", rows: 5, width: "half", column: 1 },
          { type: "LassoScoreGauge", company: C, width: "quarter", column: 2 },
          { type: "LassoKeyFigureCards", company: C, metrics: ["bruttofortjeneste", "resultat", "egenkapital"], variant: "plain", width: "quarter", column: 3 },
          { type: "LassoRiskObservations", company: C, title: "Observationer", group: { id: "fi", pattern: "accordion" } },
          { type: "LassoKeyFigureCards", company: C, group: { id: "fi", pattern: "accordion" } },
          { type: "LassoMultiYearTable", company: C, title: "Flerårstabel", group: { id: "fi", pattern: "accordion" } },
        ])}
      </ModuleExample>
    </div>
  );
}

const layout: GalleryEntry[] = [
  {
    nr: "30.1",
    title: "Svarniveau A, Element",
    node: "J4H-0",
    note: "LAYOUT_RULES: 'hvad er omsætningen' → hoved som linje (40 px) + LassoKeyFigureCards med ét metric.",
    spec: {
      kind: "company",
      title: "Omsætning",
      answer: { source: "Kilde: CVR og årsrapport 2025, opdateret 25.09.2026", next: { label: "Se hele økonomien", prompt: "Hvordan går det med Eksempel Byg A/S?" } },
      components: [head("line"), { type: "LassoKeyFigureCards", company: C, metrics: ["omsaetning"], width: "full" }],
    },
  },
  {
    nr: "30.2",
    title: "Svarniveau B, Sektion",
    node: "J4U-0",
    note: "LAYOUT_RULES: 'hvordan går det' → mønster 1 med kompakt hoved (56 px), nøgletal, graf ½ + nøgle-værdi ½ og analysen.",
    spec: { kind: "company", title: "Økonomi", answer: ANSWER_B_FOOT, components: ANSWER_B },
  },
  dataEntry({
    nr: "30.3",
    title: "Svarniveau C, Side",
    node: "J5G-0",
    note: "Niveau C som i chatten: fuldt hoved med modulbjælken (niveau 1, første modul åbent) og Lasso-bundlinjen (answer.logo). Sektionerne er show_company-kompositionen (compose.ts).",
    probe: paperCompanyProbe(),
    draw: (ds) => <AnswerC ds={ds} />,
  }),
  {
    nr: "30.4",
    title: "Mønster 1, Overblik",
    node: "J6C-0",
    note: "Nøgletalskort fuld, graf ½ + nøgle-værdi-liste ½, listerne i deres standardbredde; gridmodellen (23.1) stabler dem, så båndene fylder uden huller.",
    spec: {
      kind: "company",
      title: "Mønster 1, Overblik",
      components: [
        head("compact"),
        { type: "LassoKeyFigureCards", company: C, width: "full" },
        { type: "LassoBarChart", company: C, width: "half" },
        { type: "LassoKeyValueList", company: C, variant: "company", width: "half" },
        { type: "LassoPersonList", company: C },
        { type: "LassoOwnerList", company: C },
      ],
    },
  },
  {
    nr: "30.5",
    title: "Mønster 2, Fokus",
    node: "J82-0",
    note: "Ejerdiagram ¾ + fakta ¼ (LassoRelations og reelle ejere stablet i ¼-stakken, gridmodel 23.1: lave elementer stables ved siden af et højt anker, til stakken når 85 % af dets højde).",
    spec: {
      kind: "company",
      title: "Mønster 2, Fokus",
      components: [
        head("compact"),
        { type: "LassoOwnershipDiagram", company: C, width: "three-quarters" },
        { type: "LassoRelations", company: C, width: "quarter" },
        { type: "LassoBeneficialOwners", company: C, width: "quarter" },
      ],
    },
  },
  {
    nr: "30.6",
    title: "Mønster 3, Ligeværdige",
    node: "J8M-0",
    note: "½ + ½ med samme vægt: ledelse og ejere, resultat og balance.",
    spec: {
      kind: "company",
      title: "Mønster 3, Ligeværdige",
      components: [
        head("compact"),
        // Kontrol r5: balancen (741 px) er for høj til at stå alene ved siden af resultatet (444); gridmodellen
        // lagde den derfor alene i fuld bredde. Med balancen først står den ½ over for stakken resultat + ledelse,
        // og ejerne følger efter (samme vægt, ½ + ½).
        { type: "LassoBalanceSheet", company: C, width: "half" },
        { type: "LassoIncomeStatement", company: C, width: "half" },
        { type: "LassoPersonList", company: C, width: "half" },
        { type: "LassoOwnerList", company: C, width: "half" },
      ],
    },
  },
  {
    nr: "30.7",
    title: "Mønster 4, Liste først",
    node: "J9L-0",
    note: "Tabel i fuld bredde med kriterier over. Detaljepanel fra højre ved klik vises ikke statisk.",
    spec: {
      kind: "list",
      title: "Mønster 4, Liste først",
      criteria: [{ field: "ansatte", operator: "gte", value: 5 }],
      components: [{ type: "LassoCompanyTable", source: "search", search: { query: "", criteria: [{ field: "ansatte", operator: "gte", value: 5 }], limit: 8 }, width: "full" }],
    },
  },
  {
    nr: "30.8",
    title: "Mønster 5, Sammenligning",
    node: "JAC-0",
    note: "Etiketkolonne + én kolonne pr. virksomhed (LassoCompareTable), bedste værdi 600.",
    spec: {
      kind: "custom",
      title: "Mønster 5, Sammenligning",
      components: [
        { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"], width: "full" },
      ],
    },
  },
  {
    nr: "30.9",
    title: "Mønster 6, Tidslinje",
    node: "JB7-0",
    note: "LassoTimeline med filterColumn: filtre ¼ + kronologisk strøm ¾; på mobil chips over strømmen.",
    spec: {
      kind: "company",
      title: "Mønster 6, Tidslinje",
      components: [head("compact"), { type: "LassoTimeline", company: C, limit: 10, filterColumn: true }],
    },
  },
  {
    nr: "30.10",
    title: "Mønster 7, Fortælling",
    node: "JBR-0",
    note: "Analyse ¾ (LassoSummary) + 3 tal ¼ (LassoKeyFigureCards), derunder én graf i fuld bredde.",
    spec: {
      kind: "company",
      title: "Mønster 7, Fortælling",
      components: [
        head("compact"),
        {
          type: "LassoSummary",
          width: "three-quarters",
          title: "Kan vi handle med Eksempel Byg A/S?",
          text: "Eksempel Byg A/S er en stabil virksomhed med stigende bruttofortjeneste de seneste fem år. Resultatet efter skat er faldet til et lille underskud i 2025, men egenkapitalen er fortsat positiv, og der er ingen registrerede konkurser eller tvangsopløsninger i ledelsens netværk.",
          source: "Lasso",
          updated: "2026-09-29",
        },
        { type: "LassoKeyFigureCards", company: C, metrics: ["bruttofortjeneste", "resultat", "soliditetsgrad"], width: "quarter" },
        { type: "LassoBarChart", company: C, width: "full" },
      ],
    },
  },
  dataEntry({
    nr: "30.11",
    title: "Moduler sættes sammen forskelligt (inkl. mønster 8 kortgitter og 9 harmonika)",
    node: "JV3-0",
    only: "desktop",
    note: "Papers fem moduleksempler (Nøgletal, Ejerdiagram, Nyheder, Historik, Firmaindsigt), hver med ModuleToolbar (primær handling til venstre, visningsvalg til højre, tynd linje under) over modulets elementer i sit mønster.",
    probe: MODULES_PROBE,
    draw: (ds) => <FiveModules ds={ds} />,
  }),
  {
    nr: "30.14",
    title: "Mønster 8, Kortgitter",
    node: "K0A-0",
    note: "group.pattern 'cards': to kolonner, højde efter indhold, luft og tynde linjer, aldrig skygge; én kolonne på mobil.",
    spec: {
      kind: "company",
      title: "Mønster 8",
      components: [
        { type: "LassoNews", company: C, limit: 2, group: { id: "kort", pattern: "cards", title: "Kortgitter" } },
        { type: "LassoContact", company: C, group: { id: "kort", pattern: "cards" } },
        { type: "LassoPersonList", company: C, group: { id: "kort", pattern: "cards" } },
        { type: "LassoOwnerList", company: C, group: { id: "kort", pattern: "cards" } },
      ],
    },
  },
  {
    nr: "30.15",
    title: "Mønster 9, Harmonika",
    node: "K18-0",
    note: "group.pattern 'accordion': 48 px rækker, navn til venstre og pil til højre; første række åben. Flere kan være åbne på desktop, kun én på mobil.",
    spec: {
      kind: "company",
      title: "Mønster 9",
      components: [
        { type: "LassoIncomeStatement", company: C, title: "Resultatopgørelse", group: { id: "harm", pattern: "accordion", title: "Harmonika" } },
        { type: "LassoBalanceSheet", company: C, title: "Balance", group: { id: "harm", pattern: "accordion" } },
        { type: "LassoCashFlow", company: C, title: "Pengestrøm", group: { id: "harm", pattern: "accordion" } },
        { type: "LassoTextSections", company: C, variant: "analyse", title: "Regnskabsanalyse", group: { id: "harm", pattern: "accordion" } },
      ],
    },
  },
  {
    nr: "30.12",
    title: "Fra spørgsmål til layout (opslagstabel)",
    node: "JCJ-0",
    only: "desktop",
    note: "Papers opslagstabel (12 rækker) og de fire regler. Samme regler står til modellen i LAYOUT_RULES/COMPOSITION_RULES (catalog.ts).",
    render: () => <LookupTable />,
  },
  {
    nr: "30.13",
    title: "Samme svar på to bredder (chat 880 og mobil 390)",
    node: "JEU-0",
    desktopWidth: 880,
    note: "Svarniveau B, mønster 1 ('Hvordan går det med X?') i chatbredde 880 og mobil 390.",
    // 30.13: nøgletal i den rolige form, "Virksomhedsoplysninger" med 2025 | 2024 og 4 rækker, analysen foldet til 3 linjer.
    spec: {
      kind: "company",
      title: "Økonomi",
      answer: ANSWER_B_FOOT,
      components: [
        head("compact"),
        { type: "LassoKeyFigureCards", company: C, variant: "plain", width: "full" },
        { type: "LassoBarChart", company: C, width: "half" },
        { type: "LassoKeyValueList", company: C, variant: "financials", title: "Virksomhedsoplysninger", years: 2, rows: 4, exclude: ["omsaetning", "resultat", "egenkapital", "ansatte"], width: "half" },
        { type: "LassoTextSections", company: C, variant: "analyse", folded: true, width: "full" },
      ],
    },
  },
];

export const entries: GalleryEntry[] = [
  ...guide,
  ...pages,
  ...responsive,
  ...mobileNav,
  ...mobileCharts.map((e) => ({ ...e, card: true })),
  ...mobileLists.map((e) => ({ ...e, card: true })),
  ...mobilePerson,
  ...mobileUnits,
  ...tablet,
  ...mobileStates,
  ...report,
  ...datatypes,
  ...tabs,
  ...layout,
];
