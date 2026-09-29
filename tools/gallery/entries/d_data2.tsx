import type { ReactNode } from "react";
import { ownershipGraphKey, type Dataset, type OwnershipGraphVM, type Severity } from "@lasso/spec";
import {
  BandIcon,
  BulkBar,
  CreditConfirmDialog,
  DataState,
  MonitorBell,
  MonitorSettings,
  NotificationPanel,
  OwnershipDiagram,
  ScoreCompare,
  Section,
  SeverityIcon,
  TableStateRows,
  severityWord,
  type NotificationVM,
  type TableState,
} from "@lasso/ui";
import type { GalleryEntry } from "../types.js";

/* Gruppe D: artboard 14, 14b, 15–22 (data-elementer). */

const BYG = "CVR-1-99000001";
const HOLDING = "CVR-1-99000010";
const MASKIN = "CVR-1-99000008";
const EJENDOMME = "CVR-1-99000012";
const LANDBRUG = "CVR-1-99000013";
const KONSULENT = "CVR-1-99000014";
const ANNE = "CVR-3-4000000001";
/* Bo Eksempel: 4 selskaber, 5 i netværket og en konkurs, som Paper-eksemplet på personsiden. */
const BO = "CVR-3-4000000002";

const noop = () => undefined;

function Label({ children }: { children: ReactNode }) {
  return <p className="lasso-small" style={{ margin: "0 0 8px", color: "var(--lasso-text-muted)" }}>{children}</p>;
}

function Stack({ items }: { items: [string, ReactNode][] }) {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {items.map(([label, node]) => (
        <div key={label}>
          <Label>{label}</Label>
          {node}
        </div>
      ))}
    </div>
  );
}

function Row({ items }: { items: [string, ReactNode][] }) {
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-start", flexWrap: "wrap" }}>
      {items.map(([label, node]) => (
        <div key={label}>
          <Label>{label}</Label>
          {node}
        </div>
      ))}
    </div>
  );
}

const company = (title: string, components: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ kind: "company", title, components, ...extra });
const person = (title: string, components: Record<string, unknown>[]) => ({ kind: "person", title, components });

/* 14b: udenlandsk ejer og ukendt rest < 5 % i maskinfabrikkens diagram. */
function addForeignOwner(ds: Dataset) {
  const key = ownershipGraphKey({ company: MASKIN, ingoingDepth: 1, outgoingDepth: 0 });
  const g = ds.ownershipGraphs[key];
  if (!g) return;
  if (!g.nodes.some((n) => n.id === "SE-5560001234")) {
    g.nodes.push({ id: "SE-5560001234", name: "Prøve Industri AB", kind: "company", form: "AB", country: "SE", registrationNo: "556000-1234", status: "Aktiv", statusKind: "active" });
    // CVR-intervaller: 50–66,66 + 45–49,99, så den uregistrerede rest er højst 5 %.
    for (const x of g.edges) if (x.to === MASKIN) x.share = [50, 66.66];
    g.edges.push({ from: "SE-5560001234", to: MASKIN, share: [45, 49.99], since: "2019-02-01" });
  }
}

/* 14.2: alle nodetilstande i én lille graf. */
const NODE_GRAPH: OwnershipGraphVM = {
  rootId: BYG,
  ingoingDepth: 1,
  outgoingDepth: 1,
  fetchedAt: "2026-09-29T08:00:00Z",
  nodes: [
    { id: BYG, name: "Eksempel Byg A/S", kind: "company", cvr: "99000001", form: "A/S", status: "Aktiv", statusKind: "active", root: true },
    { id: HOLDING, name: "Eksempel Holding ApS", kind: "company", cvr: "99000010", form: "ApS", status: "Aktiv", statusKind: "active" },
    { id: ANNE, name: "Anne Eksempel", kind: "person" },
    { id: "CVR-1-99000106", name: "Eksempel Byg Drift ApS", kind: "company", cvr: "99000106", form: "ApS", status: "Aktiv", statusKind: "active" },
    { id: "CVR-1-99000103", name: "Eksempel Udvikling ApS", kind: "company", cvr: "99000103", form: "ApS", status: "Ophørt", statusKind: "inactive" },
    { id: "CVR-1-99000011", name: "Eksempel Energi A/S", kind: "company", cvr: "99000011", form: "A/S", status: "Under konkurs", statusKind: "warning" },
    { id: "NO-999000104", name: "Eksempel Nordic AS", kind: "company", form: "AS", country: "NO", registrationNo: "999 000 104", status: "Aktiv", statusKind: "active" },
  ],
  edges: [
    { from: HOLDING, to: BYG, share: [60, 66.66], since: "2012-05-14" },
    { from: ANNE, to: BYG, share: [10, 14.99], since: "2015-01-01" },
    { from: BYG, to: "CVR-1-99000106", share: [100, 100], since: "2012-05-14" },
    { from: BYG, to: "CVR-1-99000103", share: [100, 100], since: "2012-05-14" },
    { from: BYG, to: "CVR-1-99000011", share: [50, 66.66], votes: [66.67, 89.99], since: "2018-03-01" },
    { from: BYG, to: "NO-999000104", share: [33.34, 49.99], since: "2020-06-01" },
  ],
};

/* 14.1: demokoncernen omkring Eksempel Byg A/S, 2 lag op og 1 ned. */
const FULL_GRAPH: OwnershipGraphVM = {
  rootId: BYG,
  ingoingDepth: 2,
  outgoingDepth: 1,
  fetchedAt: "2026-09-29T08:00:00Z",
  nodes: [
    { id: BYG, name: "Eksempel Byg A/S", kind: "company", cvr: "99000001", form: "A/S", status: "Aktiv", statusKind: "active", root: true },
    { id: HOLDING, name: "Eksempel Holding ApS", kind: "company", cvr: "99000010", form: "ApS", status: "Aktiv", statusKind: "active", equity: 41200000 },
    { id: BO, name: "Bo Eksempel", kind: "person" },
    { id: ANNE, name: "Anne Eksempel", kind: "person" },
    { id: "CVR-1-99000106", name: "Eksempel Byg Drift ApS", kind: "company", cvr: "99000106", form: "ApS", status: "Aktiv", statusKind: "active" },
    { id: "CVR-1-99000101", name: "Eksempel Byg Invest ApS", kind: "company", cvr: "99000101", form: "ApS", status: "Aktiv", statusKind: "active" },
  ],
  edges: [
    { from: BO, to: HOLDING, share: [100, 100], since: "2009-02-01" },
    { from: HOLDING, to: BYG, share: [66.67, 89.99], since: "2012-05-14" },
    { from: ANNE, to: BYG, share: [10, 14.99], since: "2015-01-01" },
    { from: BYG, to: "CVR-1-99000106", share: [100, 100], since: "2012-05-14" },
    { from: BYG, to: "CVR-1-99000101", share: [100, 100], since: "2016-08-01" },
  ],
};

/* 15.4: tabeltilstande inde i tabelrammen, hovedet bliver stående. */
function StateTable({ state }: { state: TableState }) {
  return (
    <div className="lasso-table-frame">
      <div className="lasso-table-wrap">
        <table className="lasso-table">
          <thead>
            <tr>
              <th>Navn</th>
              <th>By</th>
              <th>Branche</th>
              <th style={{ textAlign: "right" }}>Ansatte</th>
              <th style={{ textAlign: "right" }}>Bruttofortjeneste</th>
            </tr>
          </thead>
          <tbody>
            <TableStateRows state={state} colSpan={5} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NOW = new Date("2026-09-29T10:00:00+02:00");
const NOTIFICATIONS: NotificationVM[] = [
  { id: "n1", kind: "overvaagning", text: "Eksempel Energi A/S er under konkurs", source: 'Overvågning "Kunder"', at: "2026-09-29T09:12:00+02:00", read: false, important: true },
  { id: "n2", kind: "overvaagning", text: "Eksempel Byg A/S har offentliggjort årsrapport 2025", source: 'Overvågning "Kunder"', at: "2026-09-29T08:40:00+02:00", read: false },
  { id: "n3", kind: "kredit", text: "Ny kreditvurdering af Eksempel Transport ApS er klar", source: "Kredit, Creditsafe", at: "2026-09-28T15:05:00+02:00", read: false, action: { label: "Se" } },
  { id: "n4", kind: "eksport", text: "Eksport af 1.243 virksomheder er klar", source: "Eksport, Excel", at: "2026-09-28T11:30:00+02:00", read: true, action: { label: "Hent" } },
  { id: "n5", kind: "overvaagning", text: "Ny direktør i Eksempel Software ApS", source: 'Overvågning "Leverandører"', at: "2026-09-27T13:20:00+02:00", read: true },
  { id: "n6", kind: "konto", text: "Du har 12 kreditter tilbage", source: "Konto", at: "2026-09-26T09:00:00+02:00", read: true },
];

const SEVERITIES: Severity[] = [0, 25, 50, 100];

export const entries: GalleryEntry[] = [
  /* ---------- 14 Ejerdiagram ---------- */
  {
    nr: "14.1",
    title: "Ejerdiagram, fuld visning",
    node: "AQF-0",
    render: () => <OwnershipDiagram graph={FULL_GRAPH} defaultSelected={HOLDING} canDrillDown canPrompt onAction={noop} />,
    note: "Detaljepanelet (AY0-0) står åbent for Eksempel Holding ApS (defaultSelected); i brug åbnes det ved klik på en node.",
  },
  {
    nr: "14.2",
    title: "Ejerdiagram-noder (nodetilstande)",
    node: "AZK-0",
    render: () => <OwnershipDiagram graph={NODE_GRAPH} title="Nodetilstande" />,
    note: "Nodetilstandene i én graf: fokus, virksomhed, person, ophørt, under konkurs, udenlandsk, ukendt ejer (< 100 % registreret). 'Valgt' (klik) og hover kan ikke vises statisk; folde-noden '+N flere' ses i 14.4.",
  },
  {
    nr: "14.3",
    title: "Kanter og labels",
    node: "B1S-0",
    spec: company("Eksempel Byg A/S", [{ type: "LassoOwnershipDiagram", company: BYG, ingoingDepth: 1, outgoingDepth: 1, title: "Andele som labels, bus-kanter og cirkulært ejerskab" }]),
  },
  {
    nr: "14.4",
    title: "Layoutregler (ejerdiagram)",
    node: "B2Y-0",
    spec: company("Eksempel Holding ApS", [
      { type: "LassoOwnershipDiagram", company: HOLDING, ingoingDepth: 1, outgoingDepth: 2, title: "Ejere over, ejede under, +N flere over 5 i et lag" },
      { type: "LassoOwnershipDiagram", company: HOLDING, ingoingDepth: 1, outgoingDepth: 1, onDate: "2024-01-01", title: "Pr. dato 01.01.2024: ophørt relation stiplet" },
    ]),
    note: "Reglerne vist som to diagrammer: standardlayout med foldning og 'Pr. dato'. Regelteksten fra Paper findes ikke som komponent.",
  },
  {
    nr: "14b.1",
    title: "Ejerdiagram, særlige tilstande",
    node: "DDU-0",
    spec: company("Særlige tilstande", [
      { type: "LassoOwnershipDiagram", company: EJENDOMME, ingoingDepth: 0, outgoingDepth: 7, title: "Dyb kæde, 7 lag foldes" },
      { type: "LassoOwnershipDiagram", company: BYG, ingoingDepth: 2, outgoingDepth: 1, title: "Cirkulært ejerskab over flere led" },
      { type: "LassoOwnershipDiagram", company: MASKIN, ingoingDepth: 1, outgoingDepth: 0, title: "Udenlandske ejere og ukendt < 5 %" },
      { type: "LassoOwnershipDiagram", company: KONSULENT, ingoingDepth: 2, outgoingDepth: 1, title: "Tom tilstand, ingen registrerede ejere" },
    ]),
    mutate: addForeignOwner,
    note: "Udenlandsk ejer (Prøve Industri AB) er tilføjet med mutate; resten er demokoncernen.",
  },

  /* ---------- 15 Tabeller og lister ---------- */
  {
    nr: "15.1",
    title: "Virksomhedstabel",
    node: "B4A-0",
    spec: { title: "Virksomheder", components: [{ type: "LassoCompanyTable", source: "search", search: { query: "", criteria: [], sort: { field: "bruttofortjeneste", direction: "desc" } }, columns: ["navn", "by", "branche", "status", "ansatte", "bruttofortjeneste", "udvikling"] }] },
  },
  {
    nr: "15.2",
    title: "Massehandlinger (handlingsbjælke)",
    node: "BA7-0",
    render: () => (
      <Stack
        items={[
          [
            "2 markeret af 1.243",
            <div className="lasso-table-frame" key="a">
              <BulkBar
                count={2}
                total={1243}
                allSelected={false}
                onSelectAll={noop}
                onClear={noop}
                actions={[
                  { id: "list", label: "Tilføj til liste", onSelect: noop },
                  { id: "monitor", label: "Overvåg", onSelect: noop },
                  { id: "export", label: "Eksportér", onSelect: noop },
                  { id: "remove", label: "Fjern", onSelect: noop, destructive: true },
                ]}
              />
            </div>,
          ],
          [
            "Alle 1.243 valgt",
            <div className="lasso-table-frame" key="b">
              <BulkBar
                count={1243}
                total={1243}
                allSelected
                onSelectAll={noop}
                onClear={noop}
                actions={[
                  { id: "list", label: "Tilføj til liste", onSelect: noop },
                  { id: "monitor", label: "Overvåg", onSelect: noop },
                  { id: "export", label: "Eksportér", onSelect: noop },
                  { id: "remove", label: "Fjern", onSelect: noop, destructive: true },
                ]}
              />
            </div>,
          ],
        ]}
      />
    ),
  },
  {
    nr: "15.3",
    title: "Persontabel",
    node: "BD5-0",
    spec: { title: "Personer", components: [{ type: "LassoPersonTable", query: "Eksempel" }] },
  },
  {
    nr: "15.4",
    title: "Tabeltilstande (tom, hentende, fejlende)",
    node: "BB0-0",
    render: () => (
      <Stack
        items={[
          ["Tom", <StateTable key="e" state={{ kind: "empty", reason: "Ingen virksomheder matcher kriterierne. Fjern et kriterie for at få flere resultater." }} />],
          ["Hentende", <StateTable key="l" state={{ kind: "loading", rows: 3 }} />],
          ["Fejlende", <StateTable key="f" state={{ kind: "error", reason: "Lasso svarede ikke. Prøv igen om lidt.", onRetry: noop }} />],
        ]}
      />
    ),
  },

  /* ---------- 16 Personside ---------- */
  { nr: "16.1", title: "Personhoved", node: "BNF-0", spec: person("Bo Eksempel", [{ type: "LassoPersonHead", person: BO }]) },
  { nr: "16.2", title: "Roller som tidsbånd", node: "BOH-0", spec: person("Bo Eksempel", [{ type: "LassoPersonRoles", person: BO, show: "all", limit: 8 }]) },
  { nr: "16.3", title: "Netværk (personer med fælles selskaber)", node: "BQV-0", spec: person("Bo Eksempel", [{ type: "LassoPersonNetwork", person: BO, limit: 4, width: "full" }]) },
  { nr: "16.4", title: "Personrisiko", node: "BR1-0", spec: person("Bo Eksempel", [{ type: "LassoPersonRisk", person: BO, width: "full" }]) },

  /* ---------- 17 Risikoobservationer ---------- */
  {
    nr: "17.1",
    title: "Alvorsskala",
    node: "BTL-0",
    render: () => (
      <Row
        items={SEVERITIES.map((s) => [
          `severity ${s}`,
          <span key={s} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <SeverityIcon severity={s} />
            <span>{severityWord(s)}</span>
          </span>,
        ])}
      />
    ),
  },
  { nr: "17.2", title: "Observationsliste med sammenfatning", node: "BUO-0", spec: company("Eksempel Byg A/S", [{ type: "LassoRiskObservations", company: BYG }]) },
  {
    nr: "17.3",
    title: "Risiko ikke tilgængelig (tre årsager)",
    node: "BV2-0",
    render: () => (
      <Section title="Risikoobservationer" span="full">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <Label>Intet fundet (positiv)</Label>
            <DataState state="empty" positive title="Intet at bemærke" reason="Lasso har gennemgået virksomheden og fandt ingen risikoobservationer." checkedAt="2026-09-28" />
          </div>
          <div>
            <Label>Ingen adgang</Label>
            <DataState state="locked" title="Kræver Lasso Risiko" reason="Risikoobservationer er en del af Lasso Risiko." action={{ label: "Se planer", onClick: noop }} />
          </div>
          <div>
            <Label>Kunne ikke hentes</Label>
            <DataState state="error" title="Risikoobservationer kunne ikke hentes" reason="Lasso svarede ikke inden for 15 sekunder." onRetry={noop} />
          </div>
        </div>
      </Section>
    ),
    note: "Paper-teksten for de tre årsager er ikke tilgængelig her; tolket som intet fundet, ingen adgang og teknisk fejl med DataState.",
  },

  /* ---------- 18 Kreditvurdering over tid ---------- */
  {
    nr: "18.1",
    title: "Forrige vs. nu (kreditscore)",
    node: "BX9-0",
    render: () => (
      <ScoreCompare
        previous={{ value: "47", of: "af 100", word: "Lav risiko", tone: "ok", icon: <BandIcon index={0} />, date: "2026-03-14", detail: "Kreditmaks 0,9 mio. kr." }}
        current={{ value: "52", of: "af 100", word: "Lav risiko", tone: "ok", icon: <BandIcon index={0} />, date: "2026-09-12", detail: "Kreditmaks 1,25 mio. kr., international score B. Kilde: Creditsafe" }}
        direction="worse"
        delta="+5"
        period="6 mdr."
        action={{ label: "Hent ny, 1 kredit", onClick: noop, primary: true, note: "Du har 38 kreditter, seneste hentning for 13 dage siden" }}
      />
    ),
  },
  { nr: "18.2", title: "Scorehistorik (trinlinje)", node: "BY5-0", spec: company("Eksempel Byg A/S", [{ type: "LassoScoreHistory", company: BYG, width: "full" }]) },
  {
    nr: "18.3",
    title: "Bekræft hentning (dialog)",
    node: "BYX-0",
    render: () => (
      <div style={{ minHeight: 560 }}>
        <CreditConfirmDialog open onClose={noop} onConfirm={noop} balance={38} price={1} description="LASSO X A/S, seneste vurdering er 13 dage gammel." />
      </div>
    ),
    note: "Kun tilstanden med nok kreditter vises (dialogen er en overlay). Ved 0 kreditter bliver knappen 'Køb kreditter' og prisen rød (balance=0).",
  },

  /* ---------- 19 Regnskabsdetaljer ---------- */
  { nr: "19.1", title: "Regnskabsværktøjslinje", node: "C0Z-0", spec: company("Eksempel Byg A/S", [{ type: "LassoFinancialStatements", company: BYG }]) },
  { nr: "19.2", title: "Resultatopgørelse", node: "C1X-0", spec: company("Eksempel Byg A/S", [{ type: "LassoIncomeStatement", company: BYG }]) },
  { nr: "19.3", title: "Regnskabsanalyse", node: "C3M-0", spec: company("Eksempel Byg A/S", [{ type: "LassoTextSections", company: BYG, variant: "analyse", width: "full" }]) },
  { nr: "19.4", title: "Balance", node: "DA9-0", spec: company("Eksempel Byg A/S", [{ type: "LassoBalanceSheet", company: BYG }]) },
  { nr: "19.5", title: "Pengestrømsopgørelse", node: "DC9-0", spec: company("Eksempel Byg A/S", [{ type: "LassoCashFlow", company: BYG }]) },

  /* ---------- 20 P-enheder, ejendomme og CHR ---------- */
  { nr: "20.1", title: "Produktionsenheder (tabel)", node: "C4D-0", spec: company("Eksempel Byg A/S", [{ type: "LassoProductionUnits", company: BYG }]) },
  {
    nr: "20.2–20.3",
    title: "Ejendomskort (BBR) + Bygningstabel og arealfordeling (BBR)",
    node: "C5V-0",
    spec: company("Eksempel Ejendomme ApS", [{ type: "LassoProperties", company: EJENDOMME }]),
    note: "20.2 (C5V-0) og 20.3 (C6O-0) er én komponent (LassoProperties): kort, nøgle-værdi, bygningstabel og arealfordeling.",
  },
  {
    nr: "20.4–20.5",
    title: "CHR-besætninger + Veterinære hændelser",
    node: "C8C-0",
    spec: company("Eksempel Landbrug", [{ type: "LassoLivestock", company: LANDBRUG, width: "full" }]),
    note: "20.4 (C8C-0) og 20.5 (C9H-0) er én komponent (LassoLivestock).",
  },

  /* ---------- 21 Overvågning og notifikationer ---------- */
  { nr: "21.1", title: "Ændringsfeed", node: "CA9-0", spec: { title: "Overvågning", components: [{ type: "LassoChangeFeed", list: "Kunder", days: 7 }] } },
  {
    nr: "21.2",
    title: "Notifikationspanel",
    node: "CAY-0",
    note: "På mobil (390) fylder panelet skærmen som ark (fast placeret); i portalen lukkes det med Luk.",
    render: () => (
      // På mobil er panelet et fast ark i fuld skærm (position: fixed); højden giver billedet plads til det.
      <div style={{ maxWidth: 400, minHeight: 620 }}>
        <NotificationPanel items={NOTIFICATIONS} now={NOW} onMarkAllRead={noop} onSeeAll={noop} onClose={noop} onAction={noop} onOpen={noop} />
      </div>
    ),
  },
  {
    nr: "21.3",
    title: "Klokke-tilstande",
    node: "CDW-0",
    note: "Klokken har aldrig badge: ulæste giver koral klokke, vigtig ændring (status/konkurs) mørk rød; antallet står i skærmlæserteksten og i panelets hoved.",
    render: () => (
      <div style={{ display: "grid", gap: 8, maxWidth: 300 }}>
        {(
          [
            ["Ingen ulæste", <MonitorBell key="0" unread={0} />],
            ["3 ulæste, koral klokke", <MonitorBell key="3" unread={3} />],
            ["Vigtig ændring, mørk rød klokke", <MonitorBell key="i" unread={4} important />],
          ] as const
        ).map(([label, bell]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, height: 48, padding: "0 12px", border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", fontSize: "var(--lasso-fs-sm)", color: "var(--lasso-text-2)" }}>
            {bell}
            {label}
          </div>
        ))}
      </div>
    ),
  },
  {
    nr: "21.4",
    title: "Overvågningsindstillinger",
    node: "CEG-0",
    render: () => (
      <div style={{ maxWidth: 520 }}>
        <MonitorSettings
          companyName="Eksempel Byg A/S"
          monitoring
          listName="Kunder"
          since="2026-03-12"
          frequency="dagligt"
          settings={{ status: true, regnskab: true, ledelse: true, stamdata: false, kredit: true }}
          onToggle={noop}
          onStop={noop}
        />
      </div>
    ),
  },

  /* ---------- 22 Sammenligning og revisoruafhængighed ---------- */
  {
    nr: "22.1",
    title: "Sammenligningstabel",
    node: "CFH-0",
    spec: {
      title: "Sammenligning",
      components: [{ type: "LassoCompareTable", companies: [BYG, "CVR-1-99000004", "CVR-1-99000008"], metrics: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ansatte"] }],
    },
  },
  { nr: "22.2", title: "Revisoruafhængighed (relationstabel)", node: "CI4-0", spec: company("Eksempel Byg A/S", [{ type: "LassoAuditorIndependence", company: BYG }]) },
];
