// Gruppe E: guide (23), eksempelsider (24, 25), responsiv (26–26h), A4-rapport (27),
// øvrige datatyper (28), fanebjælker (29) og layout (30).
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  COMPONENT_CATALOG,
  COMPOSITION_RULES,
  DEFAULT_WIDTH,
  FOCUSES,
  FOCUS_LABELS,
  LAYOUT_RULES,
  PERSON_FOCUSES,
  PERSON_FOCUS_LABELS,
  composeCompany,
  composePerson,
  composePersonProbe,
  composeProbe,
  formatAmount,
  formatDate,
  formatNumber,
  formatPercent,
  mainMetric,
  statusKind,
  type Dataset,
  type ViewSpec,
} from "@lasso/spec";
import {
  AppShell,
  CreditConfirmDialog,
  DataState,
  EntityUpdates,
  FilterSheet,
  LassoView,
  LiveNumber,
  Menu,
  ModuleBar,
  MonitorSettings,
  NotificationPanel,
  PersonSearchResults,
  PushBanner,
  QualityFlag,
  ReportA4,
  ReportBatches,
  Section,
  ShellIcon,
  SnapshotPicker,
  SourceList,
  Sparkline,
  StatusBadge,
  TabPanel,
  Tabs,
  ToastProvider,
  Toasts,
  type AppShellMobile,
  type HostCapabilities,
  type ModuleAction,
  type RailGroup,
  type StripTab,
  type TabItem,
} from "@lasso/ui";
import type { GalleryEntry } from "../types.js";

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
const notBuilt = () => <p className="lasso-small">Ikke bygget i koden</p>;

/* ---------- Portalens ramme (AppShell) med en komponeret side ---------- */

// Samme regler som apps/view/src/portal/portal.css (kun tokens); galleriet indlæser kun styles.css.
const PORTAL_CSS = `.e-portal{display:flex;flex-direction:column;background:var(--lasso-chrome);margin:-24px}
.e-portal .lasso-page .lasso-frame{padding:var(--lasso-space-5)}
.e-portal-body{padding:var(--lasso-space-5)}
.e-portal .lasso-bottomnav,.e-portal .lasso-shell > .lasso-bottomnav,.e-portal .lasso-mobilebar{position:static}
.e-screen{min-height:100vh}.e-screen > .lasso-shell{flex:1}
@container lasso (max-width:560px){.e-portal .lasso-page .lasso-frame{padding:var(--lasso-space-4)}.e-portal-body{padding:var(--lasso-space-4)}}`;

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
    unread: 3,
    moreItems: [
      { id: "save", label: "Gem på din liste", icon: <ShellIcon name="bookmark" size={16} />, onSelect: noop },
      { id: "share", label: "Del link", icon: <ShellIcon name="copy" size={16} />, onSelect: noop },
    ],
    nav: [
      { id: "soeg", label: "Søg", icon: <ShellIcon name="search" size={20} />, active: kind === "search" },
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
        tabs={{ tabs: stripTabs(kind, kind === "company" ? title : undefined, kind === "person" ? title : undefined), onSelect: noop, onClose: noop, onAdd: noop, onBell: noop, unread: 3, onFeedback: noop, onAccount: noop }}
        mobile={mobile}
        panel={panel}
      >
        {modules ? <ModuleBar id="e-mod" modules={modules} value={focus} onChange={setFocus} actions={moduleActions()} ariaLabel="Fokus" /> : null}
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

function CompanyPage({ ds }: { ds: Dataset }) {
  const spec = companySpec(ds);
  return (
    <Shell kind="company" title={ds.companies[C]?.name ?? "Eksempel Byg A/S"} modules={COMPANY_MODULES} value="overblik">
      <LassoView spec={spec} dataset={ds} host={entityHost()} onAction={noop} theme="light" embedded />
    </Shell>
  );
}

function PersonPage({ ds }: { ds: Dataset }) {
  const spec = personSpec(ds);
  return (
    <Shell kind="person" title={ds.persons[P]?.name ?? "Bo Eksempel"} modules={PERSON_MODULES} value="overblik">
      <LassoView spec={spec} dataset={ds} host={entityHost()} onAction={noop} theme="light" embedded />
    </Shell>
  );
}

const companyProbe = () => composeProbe(C, "overblik");
const personProbe = () => composePersonProbe(P, "overblik");

const COMPANY_PAGE_NOTE =
  "Portalens ramme (AppShell: skinne, fanebjælke, modulbjælke) med show_company-kompositionen (composeCompany, focus overblik, followUps fra) for Eksempel Byg A/S i stedet for LASSO X A/S.";
const PERSON_PAGE_NOTE = "Portalens ramme (AppShell) med show_person-kompositionen (composePerson, focus overblik) for Bo Eksempel i stedet for Mette Holm Eksempel.";

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

const WIDTH_LABEL: Record<string, string> = { quarter: "¼", half: "½", "three-quarters": "¾", full: "Fuld" };

function OrderList({ ds }: { ds: Dataset }) {
  const spec = companySpec(ds, true);
  const title = (t: string) => COMPONENT_CATALOG.find((c) => c.type === t)?.title ?? t;
  return (
    <Section title="Rækkefølge på en side (composeCompany, overblik)">
      <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
        {spec.components.map((c, i) => (
          <li key={i}>
            <strong>{title(c.type)}</strong>{" "}
            <span className="lasso-small" style={muted}>
              {c.type}
              {c.column ? `, kolonne ${c.column}` : ", fuld bredde"}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function RulesText({ text }: { text: string }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }} className="lasso-small">
      {text
        .split("\n")
        .slice(1)
        .map((l, i) => (
          <li key={i}>{l.replace(/^- /, "")}</li>
        ))}
    </ul>
  );
}

const WIDTHS_SPEC = {
  kind: "company",
  title: "Kolonnebredder ved 1440 px",
  components: [
    { type: "LassoKeyFigureCards", company: C, width: "full" },
    { type: "LassoBarChart", company: C, width: "half" },
    { type: "LassoKeyValueList", company: C, variant: "financials", width: "half" },
    { type: "LassoOwnershipDiagram", company: C, width: "three-quarters" },
    { type: "LassoRelations", company: C, width: "quarter" },
    { type: "LassoScoreGauge", company: C, width: "quarter" },
    { type: "LassoLineChart", company: C, width: "three-quarters" },
    { type: "LassoMultiYearTable", company: C, width: "full" },
  ],
};

const guide: GalleryEntry[] = [
  {
    nr: "23.1",
    title: "Trin 1: Sideskabelon",
    node: "CK9-0",
    only: "desktop",
    desktopWidth: 1440,
    note: "AppShell med de tre zoner: skinne (navigation), midte (modulbjælke + indhold) og højre panel 336 px (sammendrag og handlinger). Pladsholdere i stedet for indhold.",
    render: () => (
      <Shell kind="company" title="Eksempel Byg A/S" modules={COMPANY_MODULES} value="overblik" panel={<div style={{ padding: 24 }}>{placeholder("Panel: sammendrag og handlinger", 480)}</div>}>
        <div className="e-portal-body" style={stack(16)}>
          {placeholder("Midte: det eneste, der skifter indhold", 200)}
          {placeholder("Midte, sektion 2", 160)}
        </div>
      </Shell>
    ),
  },
  {
    nr: "23.2",
    title: "Trin 2: Kolonnebredder ved 1440 px",
    node: "CL1-0",
    desktopWidth: 1440,
    note: "LassoView-spec med de fire bredder (¼, ½, ¾, fuld) fra WIDTHS i packages/spec/src/spec.ts. Mobil: alt i én kolonne.",
    spec: WIDTHS_SPEC,
  },
  dataEntry({
    nr: "23.3",
    title: "Trin 3: Rækkefølge på en side",
    node: "CM3-0",
    only: "desktop",
    note: "Rækkefølgen, som serverens komponist faktisk bygger for virksomhedsoverblikket (composeCompany). Paper beskriver 7 trin i tekst; koden har ingen separat trinliste.",
    probe: companyProbe(),
    draw: (ds) => <OrderList ds={ds} />,
  }),
  {
    nr: "23.4",
    title: "Trin 4: Datatype → element (mappingtabel)",
    node: "CNC-0",
    only: "desktop",
    note: "Komponentkataloget (COMPONENT_CATALOG i packages/spec/src/catalog.ts) med standardbredde (DEFAULT_WIDTH). Paper har 25 rækker ordnet efter datatype; koden ordner efter komponent.",
    render: () => (
      <Table
        head={["Element", "Komponent", "Standardbredde", "Props"]}
        rows={COMPONENT_CATALOG.map((c) => [c.title, <code key="t">{c.type}</code>, WIDTH_LABEL[DEFAULT_WIDTH[c.type]] ?? DEFAULT_WIDTH[c.type], <span key="p" className="lasso-small">{c.props}</span>])}
      />
    ),
  },
  {
    nr: "23.5",
    title: "Trin 5: Tjek tilstande og talformat",
    node: "CPU-0",
    only: "desktop",
    note: "Tilstandene fra DataState (primitives.tsx) og talformatet fra packages/spec/src/format.ts. Tjeklisten 'Aflever aldrig uden' (21 punkter) findes ikke i koden.",
    render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={stack(16)}>
          {caption("Tom")}
          <DataState state="empty" title="Ingen nyheder endnu" reason="Der er ikke skrevet om virksomheden de seneste 12 måneder." checkedAt="2026-09-29" />
          {caption("Henter")}
          <DataState state="loading" lines={3} height={96} />
          {caption("Fejl")}
          <DataState state="error" title="Regnskab kunne ikke hentes" reason="Erhvervsstyrelsen svarede ikke." onRetry={noop} />
          {caption("Ikke oplyst")}
          <DataState state="notreported" reason="Virksomheden har ikke oplyst antal ansatte." />
        </div>
        <Table
          head={["Værdi", "Format"]}
          rows={[
            ["18.800.000 kr.", formatAmount(18_800_000)],
            ["-201.000 kr.", formatAmount(-201_000)],
            ["3.200.000 kr.", formatAmount(3_200_000)],
            ["1243 (antal)", formatNumber(1243)],
            ["7,5 % (ændring)", formatPercent(7.5)],
            ["2012-05-14 (dato)", formatDate("2012-05-14")],
            ["null", formatAmount(null)],
          ]}
        />
      </div>
    ),
  },
  {
    nr: "23.6",
    title: "Trin 6: Tænk bredden og papiret med",
    node: "DT7-0",
    only: "desktop",
    note: "Reglen står i koden som foldereglerne i LAYOUT_RULES (catalog.ts); bredderne ses i 26/26f/26g og papiret i 27 (ReportA4).",
    render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Section title="Responsiv (26)">
          <p className="lasso-small" style={{ margin: 0 }}>
            {LAYOUT_RULES.split("\n").find((l) => l.startsWith("Foldning"))}
          </p>
        </Section>
        <Section title="Eksport og print (27)">
          <p className="lasso-small" style={{ margin: 0 }}>
            ReportA4 (packages/ui/src/components/ReportA4.tsx): fire A4-sider 794 × 1123 med sidehoved, kildelinje og sidetal. Se 27.1–27.4.
          </p>
        </Section>
      </div>
    ),
  },
  {
    nr: "23.7",
    title: "Trin 7: Mapping pr. element desktop → tablet → mobil",
    node: "G67-0",
    only: "desktop",
    note: "Mappingtabellen er dokumentation; koden har ingen tabel over desktop/tablet/mobil pr. element (formerne ligger i CSS'ens container-forespørgsler, se 26a–26f).",
    render: notBuilt,
  },
  {
    nr: "23.8",
    title: "Trin 8: Dækningstabel mod API",
    node: "HJ0-0",
    only: "desktop",
    note: "Dækningstabellen mod de 25 API-endpoints findes kun som dokumentation (docs/lasso-endpoints.md), ikke i koden.",
    render: notBuilt,
  },
];

/* ---------- 24 og 25: eksempelsider ---------- */

const pages: GalleryEntry[] = [
  dataEntry({
    nr: "24.1–24.11",
    title: "Eksempel · Virksomhedsoverblik (skinne, faner, modulbjælke, hoved, nøgletal, graf, oplysninger, ledelse, kontakt, ejere, nyheder)",
    node: "JT5-0",
    only: "desktop",
    desktopWidth: 1440,
    note: COMPANY_PAGE_NOTE,
    probe: companyProbe(),
    draw: (ds) => <CompanyPage ds={ds} />,
  }),
  dataEntry({
    nr: "25.1–25.6",
    title: "Eksempel · Personside (fanebjælke, skinne, personhoved, roller, netværk, personrisiko)",
    node: "D3A-0",
    only: "desktop",
    desktopWidth: 1440,
    note: PERSON_PAGE_NOTE,
    probe: personProbe(),
    draw: (ds) => <PersonPage ds={ds} />,
  }),
];

/* ---------- 26 Responsiv ---------- */

const responsive: GalleryEntry[] = [
  {
    nr: "26.1",
    title: "Brudpunktsregler",
    node: "DH5-0",
    only: "desktop",
    note: "Brudpunkterne, som AppShell og styles.css bruger (container-forespørgsler på .lasso-root). Tekst fra AppShell.tsx/Rail.tsx/LAYOUT_RULES.",
    render: () => (
      <Table
        head={["Bredde", "Ramme", "Indhold"]}
        rows={[
          ["≥ 1200", "Skinne 236 + midte + panel 336", "4-kolonne-grid; ¾ + ¼ side om side"],
          ["1024–1199", "Skinne 64 px med ikoner, panel under midten", "¾ + ¼ bliver fuld + fuld"],
          ["961–1023", "Skinne 64 px", "½ + ½ holder"],
          ["768–960", "Skinnen skjules, bundnavigation", "½ + ½ holder til 768"],
          ["561–767", "Fanebjælke, ingen skinne", "½ + ½ stables; nøgletal 2 × 2; tabeller bliver kortlister"],
          ["≤ 560", "Mobil: topbjælke 52 + bundnavigation 56", "Én kolonne, padding 16"],
          ["Chat 640–900", "Ingen ramme", "Tablet-reglerne"],
          ["Grafer", "", "Maks 5 punkter under 768"],
        ]}
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

function TabsDemo({ level, items, value, ariaLabel, maxVisible }: { level: 1 | 2 | 3; items: readonly TabItem[]; value: string; ariaLabel: string; maxVisible?: number }) {
  const [v, setV] = useState(value);
  return <Tabs level={level} items={items} value={v} onChange={setV} ariaLabel={ariaLabel} maxVisible={maxVisible} />;
}

function OpenMenu() {
  return (
    <div style={{ minHeight: 800 }}>
      <Menu
        trigger={<ShellIcon name="more" size={20} />}
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

const FORM_CRITERIA = [
  { field: "kommune", operator: "in" as const, value: ["Aarhus", "Odense"] },
  { field: "ansatte", operator: "gte" as const, value: 10 },
  { field: "stiftet", operator: "after" as const, value: "2015-01-01" },
  { field: "status", operator: "eq" as const, value: "Aktiv" },
  { field: "region", operator: "in" as const, value: ["Hovedstaden"] },
];

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
  { nr: "26a.6", title: "Kontaktblok (mobil)", node: "DWQ-0", only: "mobile", spec: { kind: "company", title: "Kontakt", components: [{ type: "LassoContact", company: C }] } },
  { nr: "26a.7", title: "Genveje (mobil)", node: "DXD-0", only: "mobile", spec: { kind: "company", title: "Genveje", components: [{ type: "LassoShortcuts", company: C }] } },
  {
    nr: "26a.8",
    title: "Formularfelter (mobil)",
    node: "DXR-0",
    only: "mobile",
    note: "FilterSheet åben (bundark med FilterEditor): feltnavn over feltet, operator + værdi, valgchips.",
    render: () => (
      <div style={{ minHeight: 800 }}>
        <FilterSheet open criteria={FORM_CRITERIA} onApply={noop} onClose={noop} />
      </div>
    ),
  },
  {
    nr: "26a.9",
    title: "Bundark (dialog på mobil)",
    node: "DZI-0",
    only: "mobile",
    note: "CreditConfirmDialog åben; under 600 px bliver dialogen bundark.",
    render: () => (
      <div style={{ minHeight: 800 }}>
        <CreditConfirmDialog open balance={38} onClose={noop} onConfirm={noop} what="kreditvurderingen for Eksempel Byg A/S" title="Hent ny kreditvurdering?" />
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
  const rows: [string, number[]][] = [
    ["Bruttofortjeneste", [7.9, 15.5, 17.7, 17.5, 18.8]],
    ["Resultat efter skat", [1.2, 2.4, 1.1, 0.4, -0.2]],
    ["Egenkapital", [2.1, 3.3, 3.9, 3.4, 3.2]],
    ["Ansatte", [9, 12, 15, 16, 17]],
  ];
  return (
    <Section title="Udvikling, 5 år">
      <ul className="lasso-rows">
        {rows.map(([label, values]) => (
          <li key={label} className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">{label}</div>
            </div>
            <div className="lasso-row__value">
              <Sparkline values={values} tone="accent" />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const mobileCharts: GalleryEntry[] = [
  { nr: "26b.1", title: "Søjlegraf (mobil)", node: "E2T-0", only: "mobile", spec: one("Søjlegraf", { type: "LassoBarChart", company: C }) },
  { nr: "26b.2", title: "Grupperede søjler (mobil)", node: "E3K-0", only: "mobile", spec: one("Grupperede søjler", { type: "LassoGroupedBarChart", company: C, metrics: ["omsaetning", "bruttofortjeneste", "resultat"] }) },
  { nr: "26b.3", title: "Stablede søjler / balance (mobil)", node: "E49-0", only: "mobile", spec: one("Balance", { type: "LassoStackedBarChart", company: C }) },
  { nr: "26b.4", title: "Linjegraf (mobil)", node: "E5A-0", only: "mobile", spec: one("Linjegraf", { type: "LassoLineChart", company: C, benchmark: "CVR-1-99000006" }) },
  { nr: "26b.5", title: "Vandfald (mobil)", node: "E62-0", only: "mobile", spec: one("Vandfald", { type: "LassoWaterfallChart", company: C }) },
  { nr: "26b.6", title: "Fordeling / donut (mobil)", node: "E77-0", only: "mobile", spec: one("Fordeling", { type: "LassoShareBars", company: C }) },
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
  { nr: "26c.2", title: "Nøgle-værdi-liste (mobil)", node: "ECP-0", only: "mobile", spec: one("Virksomhedsoplysninger", { type: "LassoKeyValueList", company: C, variant: "company", title: "Virksomhedsoplysninger" }) },
  { nr: "26c.3", title: "Flerårstabel (mobil)", node: "ED8-0", only: "mobile", spec: one("Flerårstabel", { type: "LassoMultiYearTable", company: C }) },
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
      title: "Virksomheder",
      criteria: [{ field: "ansatte", operator: "gte", value: 5 }],
      components: [{ type: "LassoCompanyTable", source: "search", search: { query: "", criteria: [{ field: "ansatte", operator: "gte", value: 5 }], limit: 6 } }],
    },
  },
  {
    nr: "26c.8",
    title: "Filterark (mobil)",
    node: "EM6-0",
    only: "mobile",
    note: "FilterSheet åben som bundark (åbnes fra tabellens værktøjslinje).",
    render: () => (
      <div style={{ minHeight: 800 }}>
        <FilterSheet open criteria={FORM_CRITERIA.slice(0, 3)} onApply={noop} onClose={noop} />
      </div>
    ),
  },
  { nr: "26c.9", title: "Nyhedsliste (mobil)", node: "EN9-0", only: "mobile", spec: one("Nyheder", { type: "LassoNews", company: C, limit: 3 }) },
  { nr: "26c.10", title: "Tidslinje (mobil)", node: "ENM-0", only: "mobile", spec: one("Tidslinje", { type: "LassoTimeline", company: C }) },
];

const PERSON_TABS: TabItem[] = ["Roller", "Netværk", "Risiko", "Historik", "Nyheder"].map((l) => ({ id: l.toLowerCase(), label: l }));

const mobilePerson: GalleryEntry[] = [
  { nr: "26d.1", title: "Personhoved (mobil)", node: "EON-0", only: "mobile", spec: one("Bo Eksempel", { type: "LassoPersonHead", person: P }, "person") },
  { nr: "26d.2", title: "Personfaner (mobil)", node: "EPB-0", only: "mobile", note: "Tabs niveau 1 med personens faner.", render: () => <TabsDemo level={1} items={PERSON_TABS} value="roller" ariaLabel="Personfaner" /> },
  { nr: "26d.3", title: "Tidsbånd (mobil)", node: "EPM-0", only: "mobile", spec: one("Roller", { type: "LassoPersonRoles", person: P, show: "all" }, "person") },
  { nr: "26d.4", title: "Aktive roller (mobil)", node: "EQZ-0", only: "mobile", spec: one("Aktive roller", { type: "LassoPersonRoles", person: P, show: "current" }, "person") },
  { nr: "26d.5", title: "Netværkstal-kort (mobil)", node: "ERR-0", only: "mobile", spec: one("Netværkstal", { type: "LassoPersonStats", person: P }, "person") },
  { nr: "26d.6", title: "Risikoobservationer (mobil)", node: "ES9-0", only: "mobile", spec: one("Risiko", { type: "LassoRiskObservations", company: C }) },
  { nr: "26d.7", title: "Kreditvurdering (mobil)", node: "ET9-0", only: "mobile", spec: one("Kreditvurdering", { type: "LassoCreditRating", company: C }) },
  { nr: "26d.8", title: "Regnskab: år og segmentkontrol (mobil)", node: "EVK-0", only: "mobile", spec: one("Regnskab", { type: "LassoFinancialStatements", company: C }) },
  { nr: "26d.9", title: "Resultatopgørelse (mobil)", node: "EVR-0", only: "mobile", spec: one("Resultatopgørelse", { type: "LassoFinancialStatements", company: C, statement: "income" }) },
  { nr: "26d.10", title: "Balance (mobil)", node: "EX7-0", only: "mobile", spec: one("Balance", { type: "LassoFinancialStatements", company: C, statement: "balance" }) },
  { nr: "26d.11", title: "Pengestrøm (mobil)", node: "EXU-0", only: "mobile", spec: one("Pengestrøm", { type: "LassoFinancialStatements", company: C, statement: "cashflow" }) },
];

const NOTIFS = [
  { id: "1", kind: "overvaagning" as const, text: "Eksempel Energi A/S er erklæret konkurs", source: 'Overvågning "Kunder"', at: "2026-09-29T08:10:00Z", read: false, important: true },
  { id: "2", kind: "overvaagning" as const, text: "Ny direktør i Eksempel Byg A/S", source: 'Overvågning "Kunder"', at: "2026-09-29T06:40:00Z", read: false },
  { id: "3", kind: "eksport" as const, text: "Eksporten 'Store IT-selskaber' er klar", at: "2026-09-28T15:02:00Z", read: true, action: { label: "Hent" } },
  { id: "4", kind: "kredit" as const, text: "Kreditvurderingen for Eksempel Transport ApS er opdateret", at: "2026-09-27T11:00:00Z", read: true },
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
      <MonitorSettings companyName="Eksempel Byg A/S" monitoring listName="Kunder" since="2025-03-03" frequency="dagligt" settings={{ status: true, regnskab: true, ledelse: true, stamdata: false, kredit: false }} onToggle={noop} onStop={noop} />
    ),
  },
  { nr: "26e.5", title: "Notifikationsliste (mobil)", node: "F1V-0", only: "mobile", render: () => (
      <div style={{ minHeight: 800 }}>
        <NotificationPanel items={NOTIFS} now={new Date("2026-09-29T10:00:00Z")} onMarkAllRead={noop} onSeeAll={noop} onClose={noop} />
      </div>
    ) },
  { nr: "26e.6", title: "Push-notifikation (systembanner)", node: "F2X-0", only: "mobile", render: () => <PushBanner event="Konkurs" company="Eksempel Energi A/S" time="nu" /> },
  { nr: "26e.7", title: "Sammenligning (mobil)", node: "F3C-0", only: "mobile", spec: one("Sammenligning", { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"] }, "custom") },
  { nr: "26e.8", title: "Revisor og uafhængighed (mobil)", node: "F52-0", only: "mobile", spec: one("Revisor", { type: "LassoAuditorIndependence", company: C }) },
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
    spec: { kind: "list", title: "Virksomheder", components: [{ type: "LassoCompanyTable", source: "search", search: { query: "", criteria: [], limit: 8 } }] },
  },
  { nr: "26f.3", title: "Regnskab, tablet", node: "FCA-0", only: "desktop", desktopWidth: 768, spec: one("Regnskab", { type: "LassoFinancialStatements", company: C }) },
  { nr: "26f.4", title: "Ejerdiagram, tablet", node: "FFB-0", only: "desktop", desktopWidth: 768, spec: one("Ejerdiagram", { type: "LassoOwnershipDiagram", company: C }) },
  { nr: "26f.5", title: "Sammenligning, tablet", node: "FGO-0", only: "desktop", desktopWidth: 768, spec: one("Sammenligning", { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008", "CVR-1-99000004"] }, "custom") },
];

/* ---------- 26g Mobil: eksempelskærme ---------- */

const mobilePages: GalleryEntry[] = [
  dataEntry({ nr: "26g.1", title: "Virksomhedsoverblik, mobil (eksempel)", node: "FJ3-0", only: "mobile", note: COMPANY_PAGE_NOTE, probe: companyProbe(), draw: (ds) => <CompanyPage ds={ds} /> }),
  dataEntry({ nr: "26g.2", title: "Personside, mobil (eksempel)", node: "FOV-0", only: "mobile", note: PERSON_PAGE_NOTE, probe: personProbe(), draw: (ds) => <PersonPage ds={ds} /> }),
];

/* ---------- 26h Mobil: tilstande og småelementer ---------- */

function FlagDemo() {
  const [v, setV] = useState("selskab");
  return (
    <Section
      title="Resultat 2025"
      action={
        <Tabs
          level={3}
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
            <div className="lasso-row__name lasso-row__name--regular">Resultat efter skat</div>
          </div>
          <div className="lasso-row__value">
            −201 t. kr. <QualityFlag text="Resultatet afviger fra summen af posterne i årsrapporten." />
          </div>
        </li>
        <li className="lasso-row">
          <div className="lasso-row__main">
            <div className="lasso-row__name lasso-row__name--regular">Egenkapital</div>
          </div>
          <div className="lasso-row__value">3,2 mio. kr.</div>
        </li>
      </ul>
    </Section>
  );
}

const mobileStates: GalleryEntry[] = [
  {
    nr: "26h.1",
    title: "Tværgående tilstande (mobil)",
    node: "GAV-0",
    only: "mobile",
    render: () => (
      <div style={stack(16)}>
        {caption("Tom")}
        <DataState state="empty" title="Ingen nyheder endnu" reason="Der er ikke skrevet om virksomheden de seneste 12 måneder." checkedAt="2026-09-29" action={{ label: "Overvåg nyheder", onClick: noop }} />
        {caption("Indlæser")}
        <DataState state="loading" lines={3} height={96} />
        {caption("Fejl")}
        <DataState state="error" title="Regnskab kunne ikke hentes" reason="Erhvervsstyrelsen svarede ikke. Prøv igen om lidt." onRetry={noop} />
        {caption("Låst")}
        <DataState state="locked" title="Reelle ejere kræver Lasso Pro" reason="Se hvem der i sidste ende ejer og kontrollerer virksomheden." action={{ label: "Se planer", onClick: noop }} />
        {caption("På forespørgsel")}
        <DataState state="onrequest" title="Kreditvurdering" reason="Hentes fra Creditsafe. Koster 1 kredit og tager typisk 5–45 sekunder." action={{ label: "Hent kreditvurdering, 1 kredit", onClick: noop }} />
      </div>
    ),
  },
  { nr: "26h.2", title: "Kvalitetsflag + koncern/selskab-segment (mobil)", node: "GCN-0", only: "mobile", note: "Tooltippen åbner ved tap og kan ikke vises statisk.", render: () => <FlagDemo /> },
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
          { name: "Lasso News", updated: "i dag 07:45" },
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
  { nr: "26h.6", title: "Nyhed med fremhævning (mobil)", node: "IK2-0", only: "mobile", spec: one("Nyheder", { type: "LassoNews", company: C, limit: 1 }) },
  { nr: "26h.7", title: "Live-nummer (mobil)", node: "GF8-0", only: "mobile", render: () => <LiveNumber number="71747812" verifiedAt="2026-09-29" /> },
  { nr: "26h.8", title: "Fusioner og spaltninger (mobil)", node: "GFQ-0", only: "mobile", spec: one("Fusioner", { type: "LassoMergers", company: C }) },
  { nr: "26h.9", title: "Bibrancher og formål (mobil)", node: "GG7-0", only: "mobile", spec: one("Profil", { type: "LassoTextSections", company: C, variant: "profil" }) },
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
    { type: "LassoAuditorIndependence", company: C },
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

function Enumerations() {
  // Samme klassificering som live-data og demodata (packages/spec/src/status.ts).
  const kindOf = statusKind;
  const statuses = ["Normal", "Aktiv", "Ny", "Under reassumering", "Under frivillig likvidation", "Under rekonstruktion", "Under konkurs", "Opløst efter konkurs", "Tvangsopløst", "Ophørt"].map(
    (st) => [st, kindOf(st)] as const,
  );
  return (
    <Section title="Status (værdiliste)">
      <ul className="lasso-rows">
        {statuses.map(([s, k]) => (
          <li key={s} className="lasso-row">
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">{s}</div>
            </div>
            <div className="lasso-row__value">
              <StatusBadge status={s} kind={k} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const BO_STATES = ["CVR-1-99000002", "CVR-1-99000003", "CVR-1-99000004"];

const datatypes: GalleryEntry[] = [
  {
    nr: "28.1",
    title: "Værdilister (enumerations)",
    node: "H0N-0",
    note: "Status med tekst og farve via StatusBadge/statusTone. Værdilisterne hentes ikke fra API'et i koden; de øvrige lister (virksomhedsform, roller m.fl.) vises ikke.",
    render: () => <Enumerations />,
  },
  { nr: "28.2", title: "Regnskabspublicering (nyt/korrigeret regnskab)", node: "H3L-0", spec: one("Regnskabspublicering", { type: "LassoPublications", company: C }) },
  {
    nr: "28.3",
    title: "Opdateringer på personer og P-enheder",
    node: "H5N-0",
    render: () => (
      <EntityUpdates
        items={[
          { id: "1", subject: "Anne Eksempel", subjectKind: "person", type: "Person, ledelse", text: "Rolle", from: "Bestyrelsesmedlem", to: "Formand", at: "2026-09-20" },
          { id: "2", subject: "Eksempel Byg A/S", subjectKind: "company", type: "P-enhed fjernet", text: "Eksempelvej 4, 2600 Glostrup", at: "2026-09-21" },
          { id: "3", subject: "Bo Eksempel", subjectKind: "person", type: "Person, ledelse", text: "Indtrådt som direktør i Eksempel Software ApS", at: "2026-09-22" },
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
        batches={[
          { id: "a", name: "Kunder Q3", reportType: "Virksomhedsrapport", createdAt: "2026-09-20", status: "running", done: 120, total: 480, owner: "Anne Eksempel" },
          { id: "b", name: "Leverandører", reportType: "Kreditrapport", createdAt: "2026-09-18", status: "failed", errors: ["CVR 1 ukendt"] },
          { id: "c", name: "Nye kunder", reportType: "Virksomhedsrapport", createdAt: "2026-09-25", status: "planned" },
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
        rows={[
          { lassoId: "CVR-3-4000000001", name: "Anne Eksempel", city: "København", companies: ["Eksempel Byg A/S", "Eksempel Holding ApS"], totalCompanyCount: 4, foundVia: "binavn" },
          { lassoId: "CVR-3-4000000002", name: "Bo Eksempel", city: "Aarhus", companies: ["Eksempel Software ApS"], totalCompanyCount: 1 },
        ]}
      />
    ),
  },
  { nr: "28.6", title: "Fusioner og spaltninger", node: "HCC-0", spec: one("Fusioner og spaltninger", { type: "LassoMergers", company: C }) },
  {
    nr: "28.7",
    title: "Regnskabsoplysninger, bibrancher, kapital, tegningsregel og formål",
    node: "HDZ-0",
    note: "Nøgle-værdi-listen (company) + tekstsektionerne (profil) side om side.",
    spec: {
      kind: "company",
      title: "Oplysninger",
      components: [
        { type: "LassoKeyValueList", company: C, variant: "company", title: "Regnskabsoplysninger og kapital", width: "half" },
        { type: "LassoTextSections", company: C, variant: "profil", width: "half" },
      ],
    },
  },
  { nr: "28.8", title: "Statstidende, seneste bekendtgørelser", node: "HGH-0", spec: one("Statstidende", { type: "LassoAnnouncements", company: "CVR-1-99000011" }) },
  {
    nr: "28.9",
    title: "Reelle ejere: fritagelse, ledelsen som reelle ejere, kunne ikke identificeres",
    node: "HHS-0",
    note: "Tre tilstande: ledelsen som reelle ejere (årsag + indsatte personer), fritaget (forbehold i muted) og kunne ikke identificeres (udråbstegn). Fjerde: almindelig liste med \"via rolle\".",
    spec: {
      kind: "custom",
      title: "Reelle ejere",
      components: [...BO_STATES, C].map((company) => ({ type: "LassoBeneficialOwners", company, width: "full" })),
    },
    mutate: (ds) => {
      ds.beneficialOwnership[BO_STATES[0]!] = {
        lassoId: BO_STATES[0]!,
        special: { kind: "management", fallback: "management", reason: "Virksomheden har ikke reelle ejere, og ledelsen er indsat som reelle ejere." },
        owners: [
          { name: "Anne Eksempel", lassoId: "CVR-3-4000000001", role: "Direktør" },
          { name: "Bo Eksempel", lassoId: "CVR-3-4000000002", role: "Direktør" },
        ],
      };
      ds.beneficialOwnership[BO_STATES[1]!] = {
        lassoId: BO_STATES[1]!,
        owners: [],
        special: {
          kind: "exempt",
          reason: "Virksomheden er undtaget kravet om at registrere reelle ejere.",
          caveat: "Undtagelsen er vurderet ud fra virksomhedsform, branche og øvrige forhold i CVR og kan i særlige tilfælde være forkert.",
        },
      };
      ds.beneficialOwnership[BO_STATES[2]!] = {
        lassoId: BO_STATES[2]!,
        owners: [],
        special: { kind: "unidentified", reason: "Virksomheden har registreret i CVR, at den ikke kan identificere sine reelle ejere." },
      };
      const base = ds.beneficialOwnership[C];
      if (base) ds.beneficialOwnership[C] = { ...base, owners: [...base.owners, { name: "Carla Prøve", lassoId: "CVR-3-4000000003", throughRole: true }] };
    },
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

function Level1() {
  const [v, setV] = useState("overblik");
  const [loading, setLoading] = useState(true);
  useEffect(() => void setLoading(true), []);
  return (
    <div style={stack(32)}>
      <div>
        {caption("Niveau 1: valgt, hvile, deaktiveret (Risiko) og 'Flere' ved mere end 8 faner")}
        <Tabs level={1} items={L1} value={v} onChange={setV} ariaLabel="Sider" />
      </div>
      <div>
        {caption("Henter: fanen skifter straks, panelet viser skelet")}
        <Tabs level={1} id="e-l1" items={L1.slice(0, 4)} value="oekonomi" onChange={noop} ariaLabel="Sider, henter" />
        <TabPanel id="e-l1" tab="oekonomi" loading={loading} loadingHeight={200} loadingLines={4} loadingLabel="Økonomi">
          <p>Indhold</p>
        </TabPanel>
      </div>
    </div>
  );
}

function Level2() {
  const [v, setV] = useState("resultat");
  return (
    <Section title="Regnskab" subtitle="t. kr., årsrapport 2025">
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
      />
    </Section>
  );
}

function Level3() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
      <Section title="Nøgletal" action={<TabsDemo level={3} items={["2025", "2024", "2023"].map((y) => ({ id: y, label: y }))} value="2025" ariaLabel="Vælg regnskabsår" />}>
        <p className="lasso-small" style={muted}>
          Årsvælger
        </p>
      </Section>
      <Section
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
        <p className="lasso-small" style={muted}>
          Nuværende og Alle
        </p>
      </Section>
      <div style={stack(12)}>
        <TabsDemo
          level={3}
          items={[
            { id: "selskab", label: "Selskab" },
            { id: "koncern", label: "Koncern" },
          ]}
          value="selskab"
          ariaLabel="Selskab eller koncern"
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

const tabs: GalleryEntry[] = [
  { nr: "29.1", title: "Fanebjælke niveau 1 (sideniveau)", node: "IWK-0", note: "Hover og fokus kan ikke vises statisk.", render: () => <Level1 /> },
  { nr: "29.2", title: "Fanebjælke niveau 2 (sektionsniveau)", node: "IXR-0", note: "Hover og fokus kan ikke vises statisk.", render: () => <Level2 /> },
  { nr: "29.3", title: "Segmentkontrol niveau 3 (i et element)", node: "IYR-0", note: "Hover og fokus kan ikke vises statisk.", render: () => <Level3 /> },
  {
    nr: "29.4",
    title: "Fanebjælke, henter (skelet)",
    node: "J0D-0",
    note: "Fanen skifter straks; panelet viser skelet, mens indholdet hentes.",
    render: () => (
      <div>
        <Tabs level={1} id="e-l4" items={L1.slice(0, 5)} value="oekonomi" onChange={noop} ariaLabel="Sider, henter" />
        <TabPanel id="e-l4" tab="oekonomi" loading loadingHeight={220} loadingLines={5} loadingLabel="Økonomi">
          <p>Indhold</p>
        </TabPanel>
      </div>
    ),
  },
  { nr: "29.5", title: "Fanebjælke, mobil 390", node: "J1Z-0", only: "mobile", note: "Vandret scroll med fade; ingen 'Flere' på mobil.", render: () => <Level1 /> },
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

const layout: GalleryEntry[] = [
  {
    nr: "30.1",
    title: "Svarniveau A, Element",
    node: "J4H-0",
    note: "LAYOUT_RULES: 'hvad er omsætningen' → hoved som linje (40 px) + LassoKeyFigureCards med ét metric.",
    spec: { kind: "company", title: "Omsætning", components: [head("line"), { type: "LassoKeyFigureCards", company: C, metrics: ["omsaetning"], width: "full" }] },
  },
  {
    nr: "30.2",
    title: "Svarniveau B, Sektion",
    node: "J4U-0",
    note: "LAYOUT_RULES: 'hvordan går det' → mønster 1 med kompakt hoved (56 px), nøgletal, graf ½ + nøgle-værdi ½ og analysen.",
    spec: { kind: "company", title: "Økonomi", components: ANSWER_B },
  },
  dataEntry({
    nr: "30.3",
    title: "Svarniveau C, Side",
    node: "J5G-0",
    note: "LAYOUT_RULES: 'fortæl om X' → show_company (composeCompany, focus overblik) som i chatten, med opfølgningsknapper.",
    probe: companyProbe(),
    draw: (ds) => <LassoView spec={companySpec(ds, true)} dataset={ds} host={{ prompt: true, save: true, drillDown: true, export: true, openSection: true }} onAction={noop} theme="light" />,
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
    note: "Én kolonne pr. virksomhed (LassoCompareTable) + rangering.",
    spec: {
      kind: "custom",
      title: "Mønster 5, Sammenligning",
      components: [
        { type: "LassoCompareTable", companies: [C, "CVR-1-99000005", "CVR-1-99000008"], width: "full" },
        { type: "LassoRanking", companies: [C, "CVR-1-99000005", "CVR-1-99000008", "CVR-1-99000004"], width: "half" },
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
  {
    nr: "30.11",
    title: "Moduler sættes sammen forskelligt (inkl. mønster 8 kortgitter og 9 harmonika)",
    node: "JV3-0",
    note: "group.pattern 'cards' (kortgitter, to kolonner) og 'accordion' (harmonika, første række åben), begge med modulværktøjslinjen (group.toolbar, 56 px).",
    spec: {
      kind: "company",
      title: "Mønster 8 og 9",
      components: [
        head("compact"),
        { type: "LassoContact", company: C, group: { id: "kort", pattern: "cards", title: "Mønster 8, Kortgitter", toolbar: { primary: { label: "Overvåg", prompt: "Overvåg Eksempel Byg A/S" }, actions: [{ label: "Eksportér", prompt: "Eksportér oplysningerne om Eksempel Byg A/S som CSV" }] } } },
        { type: "LassoKeyValueList", company: C, variant: "company", group: { id: "kort", pattern: "cards" } },
        { type: "LassoPersonList", company: C, group: { id: "kort", pattern: "cards" } },
        { type: "LassoOwnerList", company: C, group: { id: "kort", pattern: "cards" } },
        { type: "LassoIncomeStatement", company: C, title: "Resultatopgørelse", group: { id: "harm", pattern: "accordion", title: "Mønster 9, Harmonika", toolbar: { primary: { label: "Hent årsrapport", prompt: "Hent årsrapporten for Eksempel Byg A/S som PDF" } } } },
        { type: "LassoBalanceSheet", company: C, title: "Balance", group: { id: "harm", pattern: "accordion" } },
        { type: "LassoCashFlow", company: C, title: "Pengestrøm", group: { id: "harm", pattern: "accordion" } },
        { type: "LassoTextSections", company: C, variant: "analyse", title: "Regnskabsanalyse", group: { id: "harm", pattern: "accordion" } },
      ],
    },
  },
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
    note: "Opslagstabellen findes i koden som regeltekst til modellen (LAYOUT_RULES og COMPOSITION_RULES i catalog.ts), ikke som tabel.",
    render: () => (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Section title="LAYOUT_RULES">
          <RulesText text={"x\n" + LAYOUT_RULES.split("\n").slice(1).join("\n")} />
        </Section>
        <Section title="COMPOSITION_RULES">
          <RulesText text={COMPOSITION_RULES} />
        </Section>
      </div>
    ),
  },
  {
    nr: "30.13",
    title: "Samme svar på to bredder (chat 880 og mobil 390)",
    node: "JEU-0",
    desktopWidth: 880,
    note: "Svarniveau B, mønster 1 ('Hvordan går det med X?') i chatbredde 880 og mobil 390.",
    spec: { kind: "company", title: "Økonomi", components: ANSWER_B },
  },
];

export const entries: GalleryEntry[] = [
  ...guide,
  ...pages,
  ...responsive,
  ...mobileNav,
  ...mobileCharts,
  ...mobileLists,
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
