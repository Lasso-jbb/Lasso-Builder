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
  type ContactVM,
  type Dataset,
  type Metric,
  type ViewSpec,
} from "@lasso/spec";
import {
  AppShell,
  CreditConfirmDialog,
  LassoContact,
  DataState,
  EntityUpdates,
  FilterSheet,
  LassoBeneficialOwners,
  LassoView,
  LiveNumber,
  Menu,
  ModuleBar,
  ModuleToolbar,
  MonitorSettings,
  NotificationPanel,
  PersonSearchResults,
  PushBanner,
  QualityFlag,
  LineChart,
  MultiYearTable,
  ReportA4,
  ReportBatches,
  Section,
  ShellIcon,
  SnapshotPicker,
  SourceList,
  Sparkline,
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

import { SparkList } from "./c_data1.js";
import type { GalleryEntry } from "../types.js";
import { CoverageTable, DatatypeTable, LookupTable, MappingTable, OrderSteps, StatesAndFormat, WidthAndPaper, WidthTable, ZoneSketch } from "./e_guide.js";

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
            : { groups: paperRailPerson(), onToggleGroup: noop, logo: false, bottom: { source: "Data fra CVR, Erhvervsstyrelsen og Creditsafe" } }
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
  { nr: "23.1", title: "Trin 1: Sideskabelon", node: "CK9-0", only: "desktop", desktopWidth: 1440, note: "Papers skitse af zonerne med mål og artboard-henvisninger, tegnet med tokens (e_guide.tsx).", render: () => <ZoneSketch /> },
  { nr: "23.2", title: "Trin 2: Kolonnebredder ved 1440 px", node: "CL1-0", only: "desktop", note: "Papers tabel over kolonnebredder (tekst fra Paper).", render: () => <WidthTable /> },
  { nr: "23.3", title: "Trin 3: Rækkefølge på en side", node: "CM3-0", only: "desktop", note: "Papers 7 trin (1–6 + P) med cirkel-numre og forklaring.", render: () => <OrderSteps /> },
  { nr: "23.4", title: "Trin 4: Datatype → element (mappingtabel)", node: "CNC-0", only: "desktop", note: "Papers opslagstabel Datatype | Element | Artboard.", render: () => <DatatypeTable /> },
  { nr: "23.5", title: "Trin 5: Tjek tilstande og talformat", node: "CPU-0", only: "desktop", note: "Papers tre kort: fem tilstande, talformat (ægte minus) og tjeklisten 'Aflever aldrig uden' (21 punkter).", render: () => <StatesAndFormat /> },
  { nr: "23.6", title: "Trin 6: Tænk bredden og papiret med", node: "DT7-0", only: "desktop", note: "Papers to kort Responsiv (26) og Eksport og print (27).", render: () => <WidthAndPaper /> },
  { nr: "23.7", title: "Trin 7: Mapping pr. element desktop → tablet → mobil", node: "G67-0", only: "desktop", note: "Papers mappingtabel desktop/tablet/mobil + kortene 'Touch-mål og afstande' og 'Sådan bygger du en mobilskærm'.", render: () => <MappingTable /> },
  { nr: "23.8", title: "Trin 8: Dækningstabel mod API", node: "HJ0-0", only: "desktop", note: "Papers dækningstabel mod docs.lassox.com/api med gruppeoverskrifter og kildelinje.", render: () => <CoverageTable /> },
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
    title: "Brudpunktsregler",
    node: "DH5-0",
    only: "desktop",
    note: "Papers brudpunktstabel (DH5-0, live 29.09) tegnet med Lasso-tabellen.",
    render: () => (
      <Table
        head={["Element", "≥ 1200, desktop", "768–1199, tablet", "< 768, mobil"]}
        rows={[
          ["Sideskabelon (06)", "Skinne 236 + midte + panel 336", "Skinne 236 + midte; panelet falder ned under midten", "Skinne bag \"Sektioner\"-knap i topbjælken; panel nederst; padding 16"],
          ["Virksomhedshoved (08)", "Navn + fakta venstre, knapper højre", "Knapper under faktalinjen, venstrestillet", "Navn 20 px; fakta ombrydes; handlinger som 40 px ikonknapper, Overvåg med koral ikon"],
          ["Sektionsfaner (08)", "Alle faner, \"Flere\" ved > 8", "Vandret scroll, ingen \"Flere\"", "Vandret scroll med fade i kanten, aktiv fane rulles ind"],
          ["Nøgletalskort (09)", "3–5 på række", "4 på række, sparkline skjules", "2 × 2 grid, tal 20 px, udvikling på én linje"],
          ["Nøgle-værdi-liste (09)", "Nøgle 190 px + værdi på samme linje", "Uændret", "Nøgle over værdi (2 linjer, 12/14), række 52 px"],
          ["Grafer (13)", "½ eller fuld bredde", "Altid fuld bredde", "Fuld bredde, maks 5 datapunkter synlige, resten ved swipe; tooltip fast under grafen"],
          ["Tabel (15)", "Alle kolonner", "Navn fast, resten vandret scroll; kolonnevalg", "Kortliste: navn + 2 vigtigste værdier + status; filtre i bundark; massehandlinger som bundbjælke"],
          ["Ejerdiagram (14)", "Lærred med panel", "Lærred, panel som bundark", "Indrykket liste: ejere over, fokus, datterselskaber under; \"Åbn diagram\" fuldskærm i landskab"],
        ].map(([el, ...rest]) => [<span key="e" style={{ fontWeight: 500, color: "var(--lasso-text)" }}>{el}</span>, ...rest])}
      />
    ),
  },
  dataEntry({
    nr: "26.2",
    title: "Sideskabelon, tablet 768",
    node: "DIJ-0",
    only: "desktop",
    desktopWidth: 768,
    note: COMPANY_PAGE_NOTE,
    probe: companyProbe(),
    draw: (ds) => <CompanyPage ds={ds} />,
  }),
  dataEntry({
    nr: "26.3",
    title: "Sideskabelon, mobil 390",
    node: "DKS-0",
    only: "mobile",
    note: COMPANY_PAGE_NOTE,
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

function MobileContact() {
  const now = Date.now();
  return (
    <LassoContact
      now={now}
      onCopy={noop}
      contact={{
        lassoId: C,
        address: { street: "Toldbodgade 37B", zip: "1253", city: "København K" },
        phone: "71747812",
        email: "kontakt@lasso.dk",
        verifiedAt: new Date(now - 5_000).toISOString(),
        verifiedNumbers: [{ phoneNumber: "71747812", callable: true, sources: ["CVR"], score: 98 }],
      } as ContactVM}
    />
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
  { nr: "26a.1", title: "Topbjælke (mobil)", node: "DTS-0", only: "mobile", note: "AppShell under 560 px: topbjælke med burger, titel + undertitel, klokke og '…'.", render: () => <MobileFrame /> },
  { nr: "26a.2", title: "Sektionsark (mobil)", node: "DUB-0", only: "mobile", note: "AppShell med sheetOpen: sektionsarket fra burgeren, aktiv i koral-soft.", render: () => <MobileFrame sheetOpen /> },
  { nr: "26a.3", title: "Bundnavigation (mobil)", node: "DUY-0", only: "mobile", note: "Bundnavigationen står nederst i AppShell (samme ramme som 26a.1).", render: () => <MobileFrame /> },
  { nr: "26a.4", title: "Virksomhedshoved (mobil)", node: "DW4-0", only: "mobile", spec: { kind: "company", title: "Eksempel Byg A/S", components: [{ type: "LassoCompanyHead", company: C }] } },
  {
    nr: "26a.5",
    title: "Sektionsfaner (mobil)",
    node: "DWK-0",
    only: "mobile",
    note: "Tabs niveau 1 med virksomhedens fokus; ruller vandret med fade.",
    render: () => <TabsDemo level={1} items={COMPANY_MODULES} value="overblik" ariaLabel="Sektioner" />,
  },
  {
    nr: "26a.6",
    title: "Kontaktblok (mobil)",
    node: "DWQ-0",
    only: "mobile",
    note: "LassoContact med Papers tre rækker (adresse, verificeret telefon, e-mail); overlinje, adresse på én linje og ring-knap er mobilformen.",
    render: () => <MobileContact />,
  },
  { nr: "26a.7", title: "Genveje (mobil)", node: "DXD-0", only: "mobile", spec: { kind: "company", title: "Genveje", components: [{ type: "LassoShortcuts", company: C }] } },
  {
    nr: "26a.8",
    title: "Formularfelter (mobil)",
    node: "DXR-0",
    only: "mobile",
    note: "FormPage med felterne (feltnavn over feltet, 48 px), kontakt, valgchips og effektpanelet med to knapper.",
    render: () => <MobileForm />,
  },
  {
    nr: "26a.9",
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
  { nr: "26a.10", title: "Handlingsark (menu på mobil)", node: "E05-0", only: "mobile", note: "Menu med defaultOpen og kontekst.", render: () => <OpenMenu /> },
  {
    nr: "26a.11",
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

function SparkRows() {
  return (
    <SparkList
      title="Nøgletal med tendens"
      rows={[
        { label: "Bruttofortjeneste", values: [7.9, 15.5, 17.7, 17.5, 18.8], value: "18,8" },
        { label: "Resultat", values: [120, 64, -40, -210, -338], value: "−338", negative: true },
        { label: "Egenkapital", values: [2.1, 3.3, 3.9, 3.4, 3.2], value: "3,2" },
        { label: "Ansatte pr. kvartal", values: [14, 15, 15, 16, 17, 17, 18, 19], value: "19", kind: "bars" },
      ]}
    />
  );
}

const mobileCharts: GalleryEntry[] = [
  { nr: "26b.1", title: "Søjlegraf (mobil)", node: "E2T-0", only: "mobile", spec: one("Søjlegraf", { type: "LassoBarChart", company: C }) },
  { nr: "26b.2", title: "Grupperede søjler (mobil)", node: "E3K-0", only: "mobile", spec: one("Grupperede søjler", { type: "LassoGroupedBarChart", company: C, metrics: ["omsaetning", "bruttofortjeneste"] }) },
  { nr: "26b.3", title: "Stablede søjler / balance (mobil)", node: "E49-0", only: "mobile", spec: one("Balance", { type: "LassoStackedBarChart", company: C }) },
  { nr: "26b.4", title: "Linjegraf (mobil)", node: "E5A-0", only: "mobile", spec: one("Linjegraf", { type: "LassoLineChart", company: C, benchmark: "CVR-1-99000006" }) },
  { nr: "26b.5", title: "Vandfald (mobil)", node: "E62-0", only: "mobile", spec: one("Vandfald", { type: "LassoWaterfallChart", company: C }) },
  { nr: "26b.6", title: "Fordeling / donut (mobil)", node: "E77-0", only: "mobile", spec: one("Fordeling", { type: "LassoShareBars", company: C, variant: "ejerkreds" }) },
  {
    nr: "26b.7",
    title: "Sparklines (mobil)",
    node: "E88-0",
    only: "mobile",
    note: "Sparkline-primitivet i rækker (bruges ellers i nøgletalskort og tabelkolonnen 'Udvikling'); der findes ingen selvstændig sparkline-liste i kataloget.",
    render: () => <SparkRows />,
  },
  { nr: "26b.8", title: "Nøgletalsmålere (mobil)", node: "E8Z-0", only: "mobile", spec: one("Nøgletalsmålere", { type: "LassoKeyFigureGauge", company: C }) },
  { nr: "26b.9", title: "Scoremåler (mobil)", node: "E9F-0", only: "mobile", spec: one("Score", { type: "LassoScoreGauge", company: C }) },
  { nr: "26b.10", title: "Heatmap (mobil)", node: "E9X-0", only: "mobile", spec: one("Heatmap", { type: "LassoHeatmap", list: "Kunder" }, "custom") },
  { nr: "26b.11", title: "Kort (mobil)", node: "EAY-0", only: "mobile", spec: one("Kort", { type: "LassoMap", company: C }) },
];

const mobileLists: GalleryEntry[] = [
  { nr: "26c.1", title: "Nøgletalskort / KPI 2×2 (mobil)", node: "EC5-0", only: "mobile", spec: one("Nøgletal", { type: "LassoKeyFigureCards", company: C }) },
  { nr: "26c.2", title: "Nøgle-værdi-liste (mobil)", node: "ECP-0", only: "mobile", spec: one("Stamdata", { type: "LassoKeyValueList", company: C, variant: "company", title: "Stamdata" }) },
  {
    nr: "26c.3",
    title: "Flerårstabel (mobil), variant A og B",
    node: "ED8-0",
    only: "mobile",
    note: "Variant A (ED8-0) øverst, variant B (EEO-0) under.",
    spec: {
      kind: "company",
      title: "Flerårsoversigt",
      components: [
        { type: "LassoMultiYearTable", company: C, title: "Flerårsoversigt", metrics: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"], variant: "A" },
        { type: "LassoMultiYearTable", company: C, title: "Flerårsoversigt, kort pr. nøgletal", metrics: ["bruttofortjeneste", "resultat"], variant: "B" },
      ],
    },
  },
  { nr: "26c.4", title: "Personliste (mobil)", node: "EG1-0", only: "mobile", spec: one("Ledelse", { type: "LassoPersonList", company: C }) },
  { nr: "26c.5", title: "Ejerliste (mobil)", node: "EH3-0", only: "mobile", spec: one("Ejere", { type: "LassoOwnerList", company: C }) },
  { nr: "26c.6", title: "Ejerdiagram (mobil)", node: "EHX-0", only: "mobile", spec: one("Ejerdiagram", { type: "LassoOwnershipDiagram", company: C }) },
  {
    nr: "26c.7",
    title: "Kortliste (tabel på mobil)",
    node: "EJQ-0",
    only: "mobile",
    spec: {
      kind: "list",
      title: "Kunder",
      criteria: [
        { field: "status", operator: "eq", value: "Aktiv" },
        { field: "region", operator: "eq", value: "Midtjylland" },
      ],
      components: [
        {
          type: "LassoCompanyTable",
          title: "Kunder",
          source: "search",
          search: {
            query: "",
            criteria: [
              { field: "status", operator: "eq", value: "Aktiv" },
              { field: "region", operator: "eq", value: "Midtjylland" },
            ],
            sort: { field: "navn", direction: "asc" },
            limit: 6,
          },
        },
      ],
    },
  },
  {
    nr: "26c.8",
    title: "Filterark (mobil)",
    node: "EM6-0",
    only: "mobile",
    note: "FilterSheet åben som bundark (åbnes fra tabellens værktøjslinje): valgchips, rækker med værdi og chevron, kontakt og “Vis N virksomheder”.",
    render: () => <MobileFilterSheet />,
  },
  { nr: "26c.9", title: "Nyhedsliste (mobil)", node: "EN9-0", only: "mobile", spec: one("Nyheder", { type: "LassoNews", company: C, limit: 3 }) },
  { nr: "26c.10", title: "Tidslinje (mobil)", node: "ENM-0", only: "mobile", spec: one("Tidslinje", { type: "LassoTimeline", company: C, title: "Tidslinje" }) },
];

const PERSON_TABS: TabItem[] = ["Roller", "Netværk", "Risiko", "Historik", "Nyheder"].map((l) => ({ id: l.toLowerCase(), label: l }));

const mobilePerson: GalleryEntry[] = [
  { nr: "26d.1", title: "Personhoved (mobil)", node: "EON-0", only: "mobile", spec: one("Bo Eksempel", { type: "LassoPersonHead", person: P }, "person") },
  { nr: "26d.2", title: "Personfaner (mobil)", node: "EPB-0", only: "mobile", note: "Tabs niveau 1 med personens faner.", render: () => <TabsDemo level={1} items={PERSON_TABS} value="roller" ariaLabel="Personfaner" /> },
  { nr: "26d.3", title: "Tidsbånd (mobil)", node: "EPM-0", only: "mobile", spec: one("Roller", { type: "LassoPersonRoles", person: P, show: "all" }, "person") },
  { nr: "26d.4", title: "Aktive roller (mobil)", node: "EQZ-0", only: "mobile", spec: one("Aktive roller", { type: "LassoPersonRoles", person: P, show: "current" }, "person") },
  { nr: "26d.5", title: "Netværkstal-kort (mobil)", node: "ERR-0", only: "mobile", spec: one("Netværkstal", { type: "LassoPersonStats", person: P }, "person") },
  { nr: "26d.6", title: "Risikoobservationer (mobil)", node: "ES9-0", only: "mobile", spec: one("Risiko", { type: "LassoRiskObservations", company: C }) },
  {
    nr: "26d.7",
    title: "Kreditvurdering (mobil)",
    node: "ET9-0",
    only: "mobile",
    note: "Paper 26d.7 er 0–100-scoren (LassoScoreGauge) med zonebjælke, udvikling og seneste ændringer, ikke Creditsafes A–E (LassoCreditRating, 17).",
    spec: one("Kreditvurdering", { type: "LassoScoreGauge", company: C, title: "Kreditvurdering", detail: true }),
  },
  { nr: "26d.8", title: "Regnskab: år og segmentkontrol (mobil)", node: "EVK-0", only: "mobile", spec: one("Regnskab", { type: "LassoFinancialStatements", company: C }) },
  { nr: "26d.9", title: "Resultatopgørelse (mobil)", node: "EVR-0", only: "mobile", spec: one("Resultatopgørelse", { type: "LassoFinancialStatements", company: C, statement: "income" }) },
  { nr: "26d.10", title: "Balance (mobil)", node: "EX7-0", only: "mobile", spec: one("Balance", { type: "LassoFinancialStatements", company: C, statement: "balance" }) },
  { nr: "26d.11", title: "Pengestrøm (mobil)", node: "EXU-0", only: "mobile", spec: one("Pengestrøm", { type: "LassoFinancialStatements", company: C, statement: "cashflow" }) },
];

const NOTIFS = [
  { id: "1", kind: "overvaagning" as const, title: "Nyt regnskab 2025", text: "LASSO X A/S, bruttofortjeneste 18,8 mio. (+7,5 %), resultat \u2212201 t. kr.", category: "Regnskab", source: 'Overvågning "Kunder"', at: "2026-09-29T08:10:00Z", read: false },
  { id: "2", kind: "overvaagning" as const, title: "Konkursdekret afsagt", text: "Data Eksempel A/S (eksempeldata), Sø- og Handelsretten", category: "Status", source: 'Overvågning "Kunder"', at: "2026-09-28T15:40:00Z", read: false, important: true },
  { id: "3", kind: "overvaagning" as const, title: "Nyt bestyrelsesmedlem", text: "Nordisk Eksempel ApS (eksempeldata), Mette Eksempel tiltrådt", category: "Ledelse", source: 'Overvågning "Kunder"', at: "2026-03-11T09:00:00Z", read: true },
];

const mobileUnits: GalleryEntry[] = [
  { nr: "26e.1", title: "Produktionsenheder (mobil)", node: "EYU-0", only: "mobile", spec: one("Produktionsenheder", { type: "LassoProductionUnits", company: C }) },
  { nr: "26e.2", title: "Ejendom, BBR (mobil)", node: "EZI-0", only: "mobile", spec: one("Ejendomme", { type: "LassoProperties", company: "CVR-1-99000012" }) },
  { nr: "26e.3", title: "Besætninger, CHR (mobil)", node: "F09-0", only: "mobile", note: "Tom tilstand ('Ikke relevant') for en virksomhed uden CHR.", spec: one("Besætninger", { type: "LassoLivestock", company: C }) },
  {
    nr: "26e.4",
    title: "Overvågningsindstillinger (mobil)",
    node: "F0N-0",
    only: "mobile",
    render: () => (
      <MonitorSettings companyName="LASSO X A/S" monitoring listName="Kunder" since="2026-03-03" frequency="dagligt" delivery="Push + e-mail dagligt" settings={{ status: true, regnskab: true, ledelse: true, stamdata: false, kredit: false }} onToggle={noop} onStop={noop} onDelivery={noop} />
    ),
  },
  { nr: "26e.5", title: "Notifikationsliste (mobil)", node: "F1V-0", only: "mobile", render: () => (
      <div>
        <NotificationPanel items={NOTIFS} now={new Date("2026-09-29T10:00:00Z")} onMarkAllRead={noop} onClose={noop} inline />
      </div>
    ) },
  { nr: "26e.6", title: "Push-notifikation (systembanner)", node: "F2X-0", only: "mobile", render: () => <PushBanner event="Konkurs" company="Eksempel Energi A/S" time="nu" /> },
  { nr: "26e.7", title: "Sammenligning (mobil)", node: "F3C-0", only: "mobile", spec: one("Sammenligning", { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"] }, "custom") },
  // 26e.8 Revisor og uafhængighed (mobil) udgår sammen med 22.2 (Jakob 29.09).
];

/* ---------- 26f Tablet 768 ---------- */

const tablet: GalleryEntry[] = [
  dataEntry({ nr: "26f.1", title: "Sideskabelon, tablet 768", node: "F6K-0", only: "desktop", desktopWidth: 768, note: COMPANY_PAGE_NOTE, probe: companyProbe(), draw: (ds) => <CompanyPage ds={ds} /> }),
  {
    nr: "26f.2",
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
  { nr: "26f.3", title: "Regnskab, tablet", node: "FCA-0", only: "desktop", desktopWidth: 768, spec: one("Regnskab", { type: "LassoFinancialStatements", company: C }) },
  { nr: "26f.4", title: "Ejerdiagram, tablet", node: "FFB-0", only: "desktop", desktopWidth: 768, spec: one("Ejerdiagram", { type: "LassoOwnershipDiagram", company: C }) },
  { nr: "26f.5", title: "Sammenligning, tablet", node: "FGO-0", only: "desktop", desktopWidth: 768, spec: one("Sammenligning", { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"] }, "custom") },
];

/* ---------- 26g Mobil: eksempelskærme ---------- */

const mobilePages: GalleryEntry[] = [
  dataEntry({ nr: "26g.1", title: "Virksomhedsoverblik, mobil (eksempel)", node: "FJ3-0", only: "mobile", note: PAPER_COMPANY_NOTE, probe: paperCompanyProbe(), draw: (ds) => <PaperCompanyPage ds={ds} /> }),
  dataEntry({ nr: "26g.2", title: "Personside, mobil (eksempel)", node: "FOV-0", only: "mobile", note: PAPER_PERSON_NOTE, probe: personProbe(), draw: (ds) => <PaperPersonPage ds={ds} /> }),
];

/* ---------- 26h Mobil: tilstande og småelementer ---------- */

function FlagDemo() {
  const [v, setV] = useState("selskab");
  const reason = "Mulig fejl i tallet: værdien er 1.000 gange højere end de øvrige poster og kan være indberettet i kr. i stedet for t. kr. Kilde: XBRL, Erhvervsstyrelsen. (Tooltip, vises ved tap på ikonet)";
  return (
    <div style={{ border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-card)", padding: 16 }}>
      <Section
        title="Resultat 2025"
        action={
          <Tabs
            level={3}
            compact
            items={[
              { id: "selskab", label: "Selskab" },
              { id: "koncern", label: "Koncern" },
            ]}
            value={v}
            onChange={setV}
            ariaLabel="Selskab eller koncern"
          />
        }
      >
        <ul className="lasso-rows">
          <li className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">Bruttofortjeneste</div>
            </div>
            <div className="lasso-row__value">18.834</div>
          </li>
          <li className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">
                Varelager (eksempel)
                <QualityFlag text={reason} />
              </div>
            </div>
            <div className="lasso-row__value">1.204.000</div>
          </li>
        </ul>
        {/* Tooltippen åbner ved tap; her vist statisk som mørkt kort under rækken. */}
        <p style={{ margin: "8px 0 0", padding: "10px 12px", borderRadius: "var(--lasso-radius)", background: "var(--lasso-tooltip)", color: "var(--lasso-bg)", fontSize: 12, lineHeight: "18px" }}>{reason}</p>
      </Section>
    </div>
  );
}

const mobileStates: GalleryEntry[] = [
  {
    nr: "26h.1",
    title: "Tværgående tilstande (mobil)",
    node: "GAV-0",
    only: "mobile",
    note: "De fem tilstande stablet som kort; ventetilstanden for 'På forespørgsel' står under knappen, som i Paper.",
    render: () => {
      const card: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-card)", padding: 16, background: "var(--lasso-surface)" };
      const sk = (w: string, h: number, r = 7): CSSProperties => ({ width: w, height: h, borderRadius: r });
      return (
        <div style={{ ...stack(12), ...card, padding: 12 }}>
          <DataState state="empty" solid title="Ingen nyheder endnu" reason="Vi har ikke fundet omtale af LASSO X A/S. Sidst tjekket 25.09.2026 09:41." action={{ label: "Overvåg nyheder", onClick: noop }} />
          <div style={card} aria-busy="true">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="lasso-skeleton" style={sk("40%", 12)} />
              <div className="lasso-skeleton" style={sk("18%", 12)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div className="lasso-skeleton" style={sk("100%", 64, 10)} />
              <div className="lasso-skeleton" style={sk("100%", 64, 10)} />
            </div>
            <div className="lasso-skeleton" style={sk("100%", 110, 10)} />
            <p className="lasso-small" style={{ margin: "12px 0 0", textAlign: "center", color: "var(--lasso-muted)" }}>
              Indlæser, skelet i samme mål som indholdet, ingen spinner
            </p>
          </div>
          <DataState
            state="error"
            title="Regnskab kunne ikke hentes"
            reason="Erhvervsstyrelsen svarer ikke lige nu. Dine øvrige data er opdaterede."
            onRetry={noop}
            secondaryAction={{ label: "Rapportér", onClick: noop }}
          />
          <div style={card}>
            <Section title="Reelle ejere">
              <DataState state="locked" reason="Reelle ejere kræver Lasso Pro. Du kan se legale ejere og ejerdiagram uden opgradering." action={{ label: "Se planer", onClick: noop }} />
            </Section>
          </div>
          <div style={card}>
            <Section title="Kreditvurdering" action={<span className="lasso-section__meta">Creditsafe, 1 kredit</span>}>
              <div style={stack(12)}>
                <DataState state="onrequest" reason="Ikke hentet for LASSO X A/S. Vurderingen tager 5–45 sekunder og koster 1 kredit (du har 14)." action={{ label: "Hent kreditvurdering", onClick: noop }} />
                <DataState state="onrequest" pending={{ title: "Henter vurdering …", detail: "ca. 20 sek. Du kan fortsætte imens, vi giver besked" }} />
              </div>
            </Section>
          </div>
        </div>
      );
    },
  },
  { nr: "26h.2", title: "Kvalitetsflag + koncern/selskab-segment (mobil)", node: "GCN-0", only: "mobile", note: "Tooltippen åbner ved tap; her vist statisk som mørkt kort under rækken.", render: () => <FlagDemo /> },
  { nr: "26h.3", title: "Regnskabsanalyse (mobil)", node: "GD8-0", only: "mobile", spec: one("Regnskabsanalyse", { type: "LassoTextSections", company: C, variant: "analyse" }) },
  {
    nr: "26h.4",
    title: "Kilder og opdatering (mobil)",
    node: "GDK-0",
    only: "mobile",
    render: () => (
      <SourceList
        sources={[
          { name: "CVR, Erhvervsstyrelsen", updated: "i dag 06:10" },
          { name: "Regnskaber, XBRL", updated: "2026-06-02" },
          { name: "Creditsafe", updated: "2026-09-12" },
          { name: "Nyheder, Paqle", updated: "for 2 timer siden" },
          { name: "BBR, eksempeldata", updated: "2026-09-18" },
        ]}
        pdf={{ label: "Hent årsrapport 2025 (PDF)", url: "https://example.com/aarsrapport.pdf" }}
      />
    ),
  },
  {
    nr: "26h.5",
    title: "Historik-/snapshot-skifter (mobil)",
    node: "GE5-0",
    only: "mobile",
    render: () => <SnapshotPicker subject="Ejerdiagram" what="ejerskab" date="2023-12-31" today="2026-09-29" onChange={noop} />,
  },
  {
    nr: "26h.6",
    title: "Nyhed med fremhævning (mobil)",
    node: "IK2-0",
    only: "mobile",
    note: "Paper viser en Paqle-artikel (Børsen); demodata har kun Lasso News-eksempler, så artiklen lægges ind her.",
    spec: one("Nyheder", { type: "LassoNews", company: C, limit: 1 }),
    mutate: (ds) => {
      const n = ds.news[C];
      if (!n) return;
      n.items = [{
        source: "Børsen",
        url: "https://borsen.dk/",
        time: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        headline: "Eksempel Byg udvider med ejendomsdata fra BBR",
        language: "eksempeloverskrift",
        excerpt: "datavirksomheden Eksempel Byg A/S oplyser, at BBR-data nu indgår i virksomhedsoverblikket for alle danske",
        extractSegments: [{ text: "datavirksomheden " }, { text: "Eksempel Byg A/S", highlight: true }, { text: " oplyser, at BBR-data nu indgår i virksomhedsoverblikket for alle danske" }],
        provider: "Paqle",
        note: "Eksempeldata",
      }];
    },
  },
  { nr: "26h.7", title: "Live-nummer (mobil)", node: "GF8-0", only: "mobile", render: () => (
      <div style={{ border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-card)", padding: 16 }}>
        <Section title="Telefon">
          <LiveNumber number="71747812" />
        </Section>
      </div>
    ) },
  {
    nr: "26h.8",
    title: "Fusioner og spaltninger (mobil)",
    node: "GFQ-0",
    only: "mobile",
    note: "Som Paper: kun fusionen med ét ophørende selskab (demodata har også en spaltning og to ophørte, se 28.6).",
    spec: one("Fusioner", { type: "LassoMergers", company: C }),
    mutate: (ds) => {
      const ev = ds.companyEvents?.[C];
      const fusion = ev?.mergers.find((m) => m.type === "Fusion");
      if (ev && fusion) ev.mergers = [{ ...fusion, from: fusion.from.filter((p) => p.name === "Data Eksempel A/S") }];
    },
  },
  { nr: "26h.9", title: "Bibrancher og formål (mobil)", node: "GG7-0", only: "mobile", spec: one("Profil", { type: "LassoRegistration", company: C, variant: "profile" }) },
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
    { type: "LassoCreditRating", company: C },
    { type: "LassoRiskObservations", company: C },
  ],
};

function A4Page({ ds, n }: { ds: Dataset; n: number }) {
  return (
    <div className={`e-a4-${n}`} style={{ margin: -24 }}>
      <style>{`.e-a4-${n} .lasso-a4 > .lasso-a4-page:not(:nth-child(${n})){display:none}`}</style>
      <ReportA4 company={C} dataset={ds} generatedAt="2026-09-29T08:00:00Z" />
    </div>
  );
}

const report: GalleryEntry[] = [
  ["27.1", "A4 side 1: Forside", "DOE-0"],
  ["27.2", "A4 side 2: Nøgletal, graf, ledelse og ejere", "DPI-0"],
  ["27.3", "A4 side 3: Regnskab", "FUE-0"],
  ["27.4", "A4 side 4: Kredit, risiko, reelle ejere og revisor", "FZF-0"],
].map(([nr, title, node], i) =>
  dataEntry({ nr: nr!, title: title!, node, only: "desktop", desktopWidth: 860, note: "ReportA4 med samme data som render-preview.ts --report; kun denne side vises.", probe: REPORT_SPEC, draw: (ds) => <A4Page ds={ds} n={i + 1} /> }),
);

/* ---------- 28 Øvrige datatyper ---------- */

/* 28.1: værdilisterne tegnes som Paper-dokumentationen: fire paneler og et mobilt filterark. */
const ENUM_CARD: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-card)", padding: 16, background: "var(--lasso-surface)", minWidth: 0 };
const ENUM_OVERLINE: CSSProperties = { margin: "0 0 8px", fontSize: "var(--lasso-fs-label)", lineHeight: "14px", fontWeight: 600, letterSpacing: "var(--lasso-ls-label)", textTransform: "uppercase", color: "var(--lasso-muted)" };
const ENUM_ROW: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minHeight: 30, borderBottom: "1px solid var(--lasso-divider-subtle)", fontSize: "var(--lasso-fs-sm)" };
const ENUM_GROUP: CSSProperties = { margin: "10px 0 2px", fontSize: 12, fontWeight: 400, color: "var(--lasso-muted)" };

function Enumerations() {
  // Status: tekst fra værdilisten, farve fra gruppen (packages/spec/src/status.ts + statusTone).
  // 28.1 (Jakob 29.09.2026): alle 19 statusser i de fire farvegrupper fra STATUS_GROUPS.
  const groupTitle: Record<string, string> = { active: "Aktiv", temporary: "Midlertidig", problem: "Problem", inactive: "Inaktiv" };
  const toneWord: Record<string, string> = { active: "tekstfarve", warning: "mørk rød", liquidation: "warning-tekst", inactive: "muted", new: "koral" };
  const statusRow = (st: string) => {
    const kind = statusKind(st) ?? "active";
    const tone = statusTone(st, kind);
    return (
      <div key={st} style={ENUM_ROW}>
        <span className={`lasso-status lasso-status--${tone}`}>{st}</span>
        <span style={{ fontSize: 12, color: "var(--lasso-muted)" }}>{toneWord[tone]}</span>
      </div>
    );
  };
  const forms: [string, string, string][] = [
    ["ENK", "Enkeltmandsvirksomhed", "34,8 %"],
    ["ApS", "Anpartsselskab", "33,9 %"],
    ["A/S", "Aktieselskab", "4,2 %"],
    ["I/S", "Interessentskab", "1,1 %"],
  ];
  const filter: [string, boolean][] = [
    ["Aktiv (1.243.501)", true],
    ["Under konkurs (eksempel)", false],
    ["Ophørt (eksempel)", false],
  ];
  return (
    <div className="lasso-enums" style={{ display: "grid", gap: 16 }}>
      <div className="lasso-enums__desk" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={ENUM_CARD}>
          <p style={ENUM_OVERLINE}>Status (19 værdier, 4 farvegrupper)</p>
          {STATUS_GROUPS.map((g) => (
            <div key={g.group}>
              <p style={ENUM_GROUP}>{groupTitle[g.group]}</p>
              {g.statuses.map(statusRow)}
            </div>
          ))}
        </div>
        <div style={{ ...ENUM_CARD, display: "grid", gap: 16 }}>
          <div>
            <p style={ENUM_OVERLINE}>Virksomhedsform (40+, kode og andel)</p>
            {forms.map(([code, name, share]) => (
              <div key={code} style={ENUM_ROW}>
                <span>
                  <span style={{ display: "inline-block", width: 40, color: "var(--lasso-muted)" }}>{code}</span>
                  {name}
                </span>
                <span style={{ color: "var(--lasso-muted)" }}>{share}</span>
              </div>
            ))}
            <p className="lasso-more" style={{ margin: "10px 0 0" }}>Vis alle former</p>
          </div>
          <div>
            <p style={ENUM_OVERLINE}>Ansatte-interval (11)</p>
            <p style={{ margin: 0, fontSize: "var(--lasso-fs-sm)", lineHeight: "20px", color: "var(--lasso-text)" }}>0, 1, 2–4, 5–9, 10–19, 20–49, 50–99, 100–199, 200–499, 500–999, 1.000+</p>
          </div>
          <div>
            <p style={ENUM_OVERLINE}>Enhedstype (4)</p>
            <p style={{ margin: 0, fontSize: "var(--lasso-fs-sm)", lineHeight: "20px", color: "var(--lasso-text)" }}>Person, Virksomhed, Produktionsenhed, Anden enhed (fx udenlandsk)</p>
          </div>
        </div>
        <div style={ENUM_CARD}>
          <p style={ENUM_OVERLINE}>Brug i filtre (02)</p>
          <p style={{ margin: "0 0 6px", fontSize: "var(--lasso-fs)", fontWeight: 600, color: "var(--lasso-text)" }}>Status</p>
          {filter.map(([label, on]) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, fontSize: "var(--lasso-fs-sm)", color: "var(--lasso-text)" }}>
              <input type="checkbox" defaultChecked={on} style={{ accentColor: "var(--lasso-accent)" }} />
              {label}
            </label>
          ))}
          <p className="lasso-more" style={{ margin: "8px 0 0" }}>Vis alle 19 statusser</p>
        </div>
      </div>
      {/* Mobil: filterark med rækker og koral flueben ved det valgte. */}
      <div className="lasso-enums__mob" style={{ ...ENUM_CARD, maxWidth: 360 }}>
        <p style={{ margin: "0 0 2px", fontSize: 12, color: "var(--lasso-muted)" }}>Mobil, filterark</p>
        <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 600, color: "var(--lasso-text)" }}>Status</p>
        {["Aktiv", "Under konkurs", "Ophørt"].map((st, i) => (
          <div key={st} style={{ ...ENUM_ROW, minHeight: 44, alignItems: "center", fontSize: "var(--lasso-fs)" }}>
            <span>{st}</span>
            {i === 0 ? <span style={{ color: "var(--lasso-accent)", fontWeight: 600 }} aria-label="valgt">✓</span> : null}
          </div>
        ))}
        <p className="lasso-more" style={{ margin: "10px 0 0" }}>Vis alle 19</p>
      </div>
    </div>
  );
}


const datatypes: GalleryEntry[] = [
  {
    nr: "28.1",
    title: "Værdilister (enumerations)",
    node: "H0N-0",
    note: "Dokumentation som i Paper (Jakob 29.09.2026): status med 19 værdier i fire farvegrupper fra statusTone (aktiv tekstfarve, midlertidig warning, problem mørk rød, inaktiv muted, se 02c.8), virksomhedsform, ansatte-interval, enhedstype, brug i filtre og mobilt filterark.",
    render: () => <Enumerations />,
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
          { id: "1", subject: "Anne Eksempel", subjectKind: "person", type: "Person, ledelse", text: "Tiltrådt som direktør i Nordisk Datacenter A/S", at: "2026-09-29T09:14:00", source: "CVR, gældende fra 01.09.2026" },
          { id: "2", subject: "Peter Eksempel", subjectKind: "person", type: "Person, ejerskab", text: "Reel ejer i Holm Holding ApS", from: "50–66,66 %", to: "66,67–89,99 %", at: "2026-09-29T08:02:00", source: "CVR, registreret 24.09.2026" },
          { id: "3", subject: "LASSO X A/S", subjectKind: "company", type: "P-enhed tilføjet", text: "Ny produktionsenhed: LASSO X, Aarhus (eksempel), P-nr. 1000000022", at: "2026-09-28T16:40:00", source: "CVR, 24.09.2026, eksempeldata" },
          { id: "4", subject: "Hosting Eksempel ApS", subjectKind: "company", type: "P-enhed opdateret", text: "Lager, Lyngby: ansatte 2–4 → 5–9, adresse uændret", at: "2026-09-28T11:20:00", source: "CVR, 24.09.2026, eksempeldata" },
          { id: "5", subject: "Cloud Eksempel A/S", subjectKind: "company", type: "P-enhed fjernet", text: "Produktionsenhed Butik, Odense er ophørt (P-nr. 1000000023)", at: "2026-09-22", source: "CVR, 22.09.2026, eksempeldata" },
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
  { id: "risiko", label: "Risiko", disabled: true, disabledReason: "Ingen regnskaber indberettet" },
  { id: "historik", label: "Historik" },
  { id: "kontakt", label: "Kontakt" },
  { id: "nyheder", label: "Nyheder" },
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

/** 29.1: tilstandsrækken — valgt, hvile, hover (Regnskab), fokus (Ejerskab), deaktiveret (Risiko), "Flere". */
function Level1() {
  const [v, setV] = useState("overblik");
  return (
    <div>
      {caption("Niveau 1, sideniveau, 48 px: valgt, hvile, hover (Regnskab), fokus (Ejerskab), deaktiveret (Risiko) og 'Flere' ved mere end 8 faner")}
      <Tabs level={1} items={L1} value={v} onChange={setV} ariaLabel="Sider" hoverId="regnskab" focusId="ejerskab" />
      {/* Papers forklaringer under rækken (IWK-0). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 24, marginTop: 16 }}>
        {[
          ["Valgt", "Ink 600, 2 px koral understregning i fanens bredde"],
          ["Hvile", "Text-secondary 400, ingen streg"],
          ["Hover", "Tekst bliver ink, 2 px divider-streg, ingen baggrund"],
          ["Fokus", "1 px koral kant (primary-border) omkring navnet, radius 6, kun ved tastatur"],
          ["Deaktiveret", "45 % opacitet, tooltip siger hvorfor, fx \"Ingen regnskaber indberettet\""],
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

/** 29.2: sektionsoverskrift med enhed på samme linje; valgt, hvile, hover (Pengestrøm), fokus (Nøgletal), deaktiveret (Koncern). */
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
          { id: "koncern", label: "Koncern", disabled: true, disabledReason: "Kun årsregnskab indberettet" },
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 40, alignItems: "start" }}>
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
        <TabsDemo
          level={3}
          items={[
            { id: "aar", label: "År" },
            { id: "halvaar", label: "Halvår", disabled: true, disabledReason: "Kun årsregnskab indberettet" },
            { id: "kvartal", label: "Kvartal", disabled: true, disabledReason: "Kun årsregnskab indberettet" },
          ]}
          value="aar"
          ariaLabel="Periode"
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
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, lineHeight: "26px", fontWeight: 600, color: "var(--lasso-text)" }}>LASSO X A/S</span>
          <span className="lasso-small lasso-muted">Aktiv</span>
        </div>
        <div className="lasso-small lasso-muted" style={{ marginTop: 4 }}>CVR 34580820, A/S, stiftet 14.05.2012</div>
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
  ["Tastatur og tilgængelighed", "Fanebjælken er role=\"tablist\" med aria-label, hver fane role=\"tab\" med aria-selected og aria-controls, panelet role=\"tabpanel\" med aria-labelledby. Kun den valgte fane er i tab-rækkefølgen; pil venstre/højre flytter og vælger, Home/End går til første/sidste, Tab går videre ind i panelet. Deaktiverede faner springes over. Gælder alle tre niveauer, også segmentkontrollen."],
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
  { nr: "29.2", title: "Fanebjælke niveau 2 (sektionsniveau)", node: "IXR-0", note: "Hover (Pengestrøm) og fokus (Nøgletal) er tegnet statisk med Tabs hoverId/focusId.", render: () => <Level2 /> },
  { nr: "29.3", title: "Segmentkontrol niveau 3 (i et element)", node: "IYR-0", note: "Fokus på Koncern er tegnet statisk med focusId.", render: () => <Level3 /> },
  { nr: "29.4", title: "Fanebjælke, henter (skelet)", node: "J0D-0", note: "TabPanel loadingShape=\"overview\"; til højre niveau 3, hvor etiketterne står og kun værdierne er skelet.", render: () => <Loading /> },
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

/** 30.2 og 30.13: niveau B slutter med kildelinje og link til hele siden. */
const ANSWER_B_FOOT = { source: "Kilde: CVR og årsrapport 2025, opdateret 25.09.2026", next: { label: "Åbn Eksempel Byg A/S i Lasso", prompt: "Fortæl om Eksempel Byg A/S" } };

/** 30.3: niveau C i chatten = fuldt hoved med modulbjælken (niveau 1) under, første modul åbent, og Lasso-bundlinje. */
function AnswerC({ ds }: { ds: Dataset }) {
  const [focus, setFocus] = useState("overblik");
  const spec: ViewSpec = { ...companySpec(ds, false), answer: { logo: true, source: "data fra CVR og Creditsafe" } };
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
      <ModuleExample title="Ejerdiagram" pattern="mønster 2" text="Diagrammet ¾ med relationerne ¼ ved siden. Udskriv og Gem til venstre; Layout og Rediger til højre." toolbar={<ModuleToolbar className="lasso-toolbar--module" primary={{ label: "Udskriv" }} secondary={[{ label: "Gem" }]} controls={<>{ghost("Layout")}{ghost("Rediger")}</>} />}>
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
    note: "Nøgletalskort fuld, graf ½ + nøgle-værdi-liste ½, lister to og to.",
    spec: {
      kind: "company",
      title: "Mønster 1, Overblik",
      components: [
        head("compact"),
        { type: "LassoKeyFigureCards", company: C, width: "full" },
        { type: "LassoBarChart", company: C, width: "half" },
        { type: "LassoKeyValueList", company: C, variant: "company", width: "half" },
        { type: "LassoPersonList", company: C, width: "half" },
        { type: "LassoOwnerList", company: C, width: "half" },
      ],
    },
  },
  {
    nr: "30.5",
    title: "Mønster 2, Fokus",
    node: "J82-0",
    note: "Ejerdiagram ¾ + LassoRelations ¼ (LAYOUT_RULES: 'LassoRelations er ¼-elementet').",
    spec: {
      kind: "company",
      title: "Mønster 2, Fokus",
      components: [head("compact"), { type: "LassoOwnershipDiagram", company: C, width: "three-quarters" }, { type: "LassoRelations", company: C, width: "quarter" }],
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
        { type: "LassoPersonList", company: C, width: "half" },
        { type: "LassoOwnerList", company: C, width: "half" },
        { type: "LassoIncomeStatement", company: C, width: "half" },
        { type: "LassoBalanceSheet", company: C, width: "half" },
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
  ...mobilePages,
  ...mobileStates,
  ...report,
  ...datatypes,
  ...tabs,
  ...layout,
];
