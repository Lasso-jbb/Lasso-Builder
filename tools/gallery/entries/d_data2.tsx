import type { ReactNode } from "react";
import { ownershipGraphKey, type Dataset, type OwnershipGraphVM } from "@lasso/spec";
import {
  BulkBar,
  CompanyTable,
  DownloadIcon,
  CreditConfirmDialog,
  MonitorBell,
  MonitorSettings,
  NotificationPanel,
  OwnershipDiagram,
  PlusIcon,
  RiskUnavailable,
  Section,
  SeverityScale,
  type BulkAction,
  type NotificationVM,
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

/* 18.1: Papers eksempeltal (52, lav risiko, beregnet 12.09.2026) og faktorer. */
function paperScore(ds: Dataset) {
  ds.scores[BYG] = {
    lassoId: BYG,
    score: 52,
    state: "ok",
    updated: "2026-09-12",
    basis: "Regnskab 2025, status",
    factors: [
      { label: "Positiv egenkapital 3 år i træk", tone: "ok" },
      { label: "Ingen registrerede observationer", tone: "ok" },
      { label: "Underskud i seneste regnskab", tone: "warning" },
      { label: "Revisorskift 2025", tone: "warning" },
    ],
  };
}

function Label({ children }: { children: ReactNode }) {
  return <p className="lasso-small" style={{ margin: "0 0 8px", color: "var(--lasso-text-muted)" }}>{children}</p>;
}

function Stack({ items }: { items: [string, ReactNode][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
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
  if (!g.nodes.some((n) => n.id === "NO-000000002")) {
    // 14b: udenlandske ejere med registreringsnummer og land; registrerede andele 40 + 20 + 15, så 25 % er ukendt.
    g.nodes.push(
      { id: "NO-000000002", name: "Nordic Eksempel AS", kind: "company", form: "AS", country: "NO", registrationNo: "000 000 002", status: "Aktiv", statusKind: "active" },
      { id: "DE-HRB000000", name: "Beispiel Holding GmbH", kind: "company", form: "GmbH", country: "DE", registrationNo: "HRB 000000", status: "Aktiv", statusKind: "active" },
    );
    for (const x of g.edges) if (x.to === MASKIN) x.share = [40, 40];
    g.edges.push({ from: "NO-000000002", to: MASKIN, share: [20, 20], since: "2019-02-01" }, { from: "DE-HRB000000", to: MASKIN, share: [15, 15], since: "2020-06-01" });
  }
}

const TRANSPORT = "CVR-1-99000004";

/* 14b: cirkulært ejerskab over tre led (Alfa -> Beta -> fokus -> Alfa), som Paper-eksemplet. */
function addThreeCycle(ds: Dataset) {
  const key = ownershipGraphKey({ company: TRANSPORT, ingoingDepth: 2, outgoingDepth: 1 });
  const alfa = "CVR-1-99000201";
  const beta = "CVR-1-99000202";
  ds.ownershipGraphs[key] = {
    rootId: TRANSPORT,
    ingoingDepth: 2,
    outgoingDepth: 1,
    fetchedAt: "2026-09-29T08:00:00Z",
    nodes: [
      { id: TRANSPORT, name: "Eksempel Transport A/S", kind: "company", cvr: "99000004", form: "A/S", status: "Aktiv", statusKind: "active", root: true },
      { id: alfa, name: "Alfa Eksempel ApS", kind: "company", cvr: "99000201", form: "ApS", status: "Aktiv", statusKind: "active" },
      { id: beta, name: "Beta Eksempel ApS", kind: "company", cvr: "99000202", form: "ApS", status: "Aktiv", statusKind: "active" },
    ],
    edges: [
      { from: alfa, to: beta, share: [60, 60], since: "2015-01-01" },
      { from: beta, to: TRANSPORT, share: [100, 100], since: "2015-01-01" },
      { from: TRANSPORT, to: alfa, share: [30, 30], since: "2018-01-01" },
    ],
  };
}

/* Kontrol r5 (14.1/14.4): mange ejere i ét lag, så den sammenklappede node "N flere ejere" med den samlede,
   udregnede andel på kanten kan ses som diagram. Eksempeldata. */
function addManyOwners(ds: Dataset) {
  // Direkte ejere foldes aldrig (14.4), så de mange ejere står i lag 2: over holdingselskabet.
  const key = ownershipGraphKey({ company: LANDBRUG, ingoingDepth: 2, outgoingDepth: 0 });
  const mid = "CVR-1-99000210";
  const names = ["Anne Eksempel", "Bo Eksempel", "Carla Prøve", "Dan Prøve", "Eva Eksempel", "Finn Prøve", "Gitte Eksempel", "Hans Prøve", "Ida Eksempel", "Jens Prøve"];
  const shares: [number, number][] = [[20, 24.99], [15, 19.99], [10, 14.99], [10, 14.99], [5, 9.99], [5, 9.99], [5, 9.99], [5, 9.99], [5, 9.99], [5, 9.99]];
  const nodes: OwnershipGraphVM["nodes"] = [
    { id: LANDBRUG, name: "Eksempel Landbrug I/S", kind: "company", cvr: "99000013", form: "I/S", status: "Aktiv", statusKind: "active", root: true },
    { id: mid, name: "Eksempel Familieholding ApS", kind: "company", cvr: "99000210", form: "ApS", status: "Aktiv", statusKind: "active" },
  ];
  const edges: OwnershipGraphVM["edges"] = [{ from: mid, to: LANDBRUG, share: [100, 100], since: "2015-01-01" }];
  names.forEach((name, i) => {
    const id = `CVR-3-49000000${String(i).padStart(2, "0")}`;
    nodes.push({ id, name, kind: "person" });
    edges.push({ from: id, to: mid, share: shares[i]!, since: "2018-01-01" });
  });
  ds.ownershipGraphs[key] = { rootId: LANDBRUG, ingoingDepth: 2, outgoingDepth: 0, fetchedAt: "2026-09-29T08:00:00Z", nodes, edges };
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
    { id: "NO-999000104", name: "Nordic Eksempel AS", kind: "company", form: "AS", country: "NO", status: "Aktiv", statusKind: "active" },
  ],
  edges: [
    { from: HOLDING, to: BYG, share: [60, 66.66], since: "2012-05-14" },
    { from: ANNE, to: BYG, share: [10, 14.99], since: "2015-01-01" },
    { from: BYG, to: "CVR-1-99000106", share: [100, 100], since: "2012-05-14" },
    { from: BYG, to: "CVR-1-99000103", share: [100, 100], since: "2012-05-14" },
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

/* 15.2: handlingerne som i CompanyTable, med ikoner. "Overvåg" vises ikke: ingen vært har en overvåg-handling
   for flere rækker endnu (G1, kontrol r5). */
const bulkActions = (): BulkAction[] => [
  { id: "list", label: "Føj til liste", icon: <PlusIcon />, onSelect: noop },
  { id: "export", label: "Eksportér", icon: <DownloadIcon />, onSelect: noop },
  { id: "remove", label: "Fjern fra liste", onSelect: noop, destructive: true },
];

const NOW = new Date("2026-09-29T10:00:00+02:00");
const NOTIFICATIONS: NotificationVM[] = [
  { id: "n1", kind: "overvaagning", text: "Eksempel Energi A/S er under konkurs", category: "Status og konkurs", source: 'Overvågning "Kunder"', at: "2026-09-29T09:12:00+02:00", read: false, important: true },
  { id: "n2", kind: "overvaagning", text: "Eksempel Byg A/S har offentliggjort årsrapport 2025", category: "Nyt regnskab", source: 'Overvågning "Kunder"', at: "2026-09-29T08:40:00+02:00", read: false },
  // 21.2 (Jakob 29.09): Creditsafe-notifikationen er fjernet; Creditsafe bruges ikke.
  { id: "n4", kind: "eksport", text: "Eksport af 1.243 virksomheder er klar", source: "Eksport, Excel", at: "2026-09-28T11:30:00+02:00", read: true, action: { label: "Hent" } },
  { id: "n5", kind: "overvaagning", text: "Ny direktør i Eksempel Software ApS", category: "Ledelse og ejere", source: 'Overvågning "Leverandører"', at: "2026-09-27T13:20:00+02:00", read: true },
  { id: "n6", kind: "konto", text: "Du har 12 kreditter tilbage", source: "Konto", at: "2026-09-26T09:00:00+02:00", read: true },
];

/** 14.4: Papers layoutregler for ejerdiagrammet (B2Y-0), tre spalter brødtekst 13/20. */
function OwnershipLayoutRules() {
  const col = { flex: "1 1 0", minWidth: 240, margin: 0, fontSize: 13, lineHeight: "20px", color: "var(--lasso-text)" } as const;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 40 }}>
      <p style={col}>
        Ejere står over, ejede under; fokusvirksomheden centreres vandret i sit lag. Lagafstand 90 px (bund til top), nodeafstand 14 px. Kanter samles i én vandret “bus” 52 px under laget, så flere ejere deler én pil ned i den ejede. Labels lægges på den lodrette del, aldrig på bussen.
      </p>
      <p style={col}>
        Standarddybde er 2 lag op og 1 ned; “Udvid alle” henter op til 10/10 (API: ingoingDepth/outgoingDepth). Over 5 noder i et lag foldes de mindste andele sammen til “N flere ejere” med den samlede ejerandel på kanten - fokusvirksomhedens direkte ejere foldes aldrig. “Pr. dato” tegner grafen som den så ud på datoen (API: onDate); ophørte relationer får stiplet kant og muted node.
      </p>
      <p style={col}>
        Skift mellem “Legale ejere” (registreret) og “Reelle ejere” (personer bag, beregnet indirekte andel). Klik på en node åbner detaljepanelet oven på diagrammet; dobbeltklik gør noden til nyt fokus. Minikortet viser hele grafen med viewport-ramme; zoom 25–200 % i trin, “Tilpas” centrerer. Eksport: PNG/PDF af hele grafen inkl. signaturforklaring og dato.
      </p>
    </div>
  );
}

/** 15.4: samme kriterier i alle tre tilstande (Paper LHA-0: Status: Aktiv, Region: Hovedstaden). */
const CRIT154 = [
  { field: "status", operator: "eq", value: "Aktiv" },
  { field: "region", operator: "eq", value: "Hovedstaden" },
] as const;

export const entries: GalleryEntry[] = [
  /* ---------- 14 Ejerdiagram ---------- */
  {
    nr: "14.1",
    title: "Ejerdiagram, fuld visning",
    node: "AQF-0",
    render: () => <OwnershipDiagram graph={FULL_GRAPH} defaultSelected={HOLDING} canDrillDown canPrompt canFullscreen onAction={noop} />,
    note: "Detaljepanelet (AY0-0) står åbent for Eksempel Holding ApS (defaultSelected); i brug åbnes det ved klik på en node.",
  },
  {
    nr: "14.2",
    title: "Ejerdiagram-noder (nodetilstande)",
    node: "AZK-0",
    render: () => <OwnershipDiagram graph={NODE_GRAPH} title="Nodetilstande" />,
    note: "Nodetilstandene i én graf: fokus, virksomhed, person, ophørt, udenlandsk og ukendt ejerskab (< 100 % registreret, under fokus). 'Valgt' (klik) og hover kan ikke vises statisk; folde-noden 'N flere ejere' ses i 14.4.",
  },
  {
    nr: "14.3",
    title: "Kanter og labels",
    node: "B1S-0",
    spec: company("Eksempel Byg A/S", [{ type: "LassoOwnershipDiagram", company: BYG, ingoingDepth: 1, outgoingDepth: 1, title: "Andele som labels, bus-kanter og cirkulært ejerskab" }]),
    // 14.3: aktieklasser som i Paper ("A, B: 66,67–89,99 %") på holdingens andel.
    mutate: (ds) => {
      const g = ds.ownershipGraphs[ownershipGraphKey({ company: BYG, ingoingDepth: 1, outgoingDepth: 1 })];
      for (const e of g?.edges ?? []) if (e.from === HOLDING && e.to === BYG) e.classes = "A, B";
    },
    note: "Fremhævet sti (ink 2 px, øvrige dæmpet til 40 %) vises ved hover/valg. 'Reelt 22 %' ses ved skift til Reelle ejere.",
  },
  {
    nr: "14.4",
    title: "Layoutregler (ejerdiagram)",
    node: "B2Y-0",
    note: "Papers regeltekst (B2Y-0) i tre spalter. Tilpasset Jakobs noter til 14.1: detaljepanelet ligger oven på diagrammet, sammenklappet node hedder 'N flere ejere', bindestreg i stedet for tankestreg (G7). Koden følger reglerne: ownershipLayout.ts LAYER_GAP 90, NODE_GAP 14, BUS_OFFSET 52, LAYER_CAP 5, standarddybde 2 op/1 ned, direkte ejere foldes aldrig.",
    render: () => <OwnershipLayoutRules />,
  },
  {
    nr: "14.4",
    title: "Layoutregler, eksempler (standardlayout med foldning og Pr. dato)",
    node: "B2Y-0",
    // Kontrol r5: eksemplerne tegnes som diagram i fuld bredde (i ½ faldt de tilbage til listeformen).
    spec: company("Eksempel Holding ApS", [
      { type: "LassoOwnershipDiagram", company: HOLDING, ingoingDepth: 1, outgoingDepth: 2, width: "full", title: "Ejere over, ejede under, foldning til \"N flere\" over 5 i et lag" },
      { type: "LassoOwnershipDiagram", company: HOLDING, ingoingDepth: 1, outgoingDepth: 1, onDate: "2024-01-01", width: "full", title: "Pr. dato 01.01.2024: ophørt relation stiplet" },
      { type: "LassoOwnershipDiagram", company: LANDBRUG, ingoingDepth: 2, outgoingDepth: 0, width: "full", title: "Mange ejere i ét lag: \"N flere ejere\" med den samlede andel på kanten" },
    ]),
    mutate: addManyOwners,
    note: "Reglerne fra 14.4 vist på demokoncernen: standardlayout med foldning og 'Pr. dato' (ophørt relation stiplet).",
  },
  {
    nr: "14b.1",
    title: "Ejerdiagram, særlige tilstande",
    node: "DDU-0",
    spec: company("Særlige tilstande", [
      { type: "LassoOwnershipDiagram", company: EJENDOMME, ingoingDepth: 0, outgoingDepth: 7, width: "full", title: "Dyb kæde, 7 lag foldes" },
      { type: "LassoOwnershipDiagram", company: TRANSPORT, ingoingDepth: 2, outgoingDepth: 1, width: "full", title: "Cirkulært ejerskab over flere led" },
      { type: "LassoOwnershipDiagram", company: MASKIN, ingoingDepth: 1, outgoingDepth: 0, width: "full", title: "Udenlandske ejere og ukendt < 5 %" },
      { type: "LassoOwnershipDiagram", company: KONSULENT, ingoingDepth: 2, outgoingDepth: 1, width: "full", title: "Tom tilstand, ingen registrerede ejere" },
    ]),
    mutate: (ds) => {
      addForeignOwner(ds);
      addThreeCycle(ds);
    },
    note: "Udenlandske ejere og den cirkulære kæde over tre led er tilføjet med mutate; resten er demokoncernen. Paper-undertitlen 'ejer 60 % af Beta' findes ikke i modellen (noder har CVR-undertitel).",
  },

  /* ---------- 15 Tabeller og lister ---------- */
  {
    nr: "15.1",
    title: "Virksomhedstabel",
    node: "B4A-0",
    spec: {
      title: "Virksomheder",
      criteria: [{ field: "ansatte", operator: "gte", value: 10 }],
      components: [{ type: "LassoCompanyTable", source: "search", search: { query: "", criteria: [{ field: "ansatte", operator: "gte", value: 10 }], sort: { field: "bruttofortjeneste", direction: "desc" } }, columns: ["navn", "by", "branche", "status", "ansatte", "bruttofortjeneste", "udvikling"] }],
    },
  },
  {
    nr: "15.2",
    title: "Massehandlinger (handlingsbjælke)",
    node: "BA7-0",
    only: "desktop",
    note: "Samme handlinger som CompanyTable: Føj til liste, Eksportér og Fjern fra liste. Overvåg vises først, når værten har en overvåg-handling for flere rækker (G1). Mobil: se de to 15.2-mobilindgange (bundbjælke og Flere-ark, Paper LOA-0).",
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
                actions={bulkActions()}
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
                actions={bulkActions()}
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
    note: "Mobil efter 10b (Paper LHA-0): værktøjslinje (søg + Filter m. tæller), filterchips og tælleren bliver stående i alle tilstande; Henter = tre skeletkort som 26c.7 med shimmer (1,4 s, stille ved prefers-reduced-motion; billedet er statisk); tom og fejl i samme kortramme.",
    render: () => (
      <Stack
        items={[
          ["Tom", <CompanyTable key="e" title="Kunder" result={{ key: "tom", total: 0, rows: [] }} criteria={CRIT154} onApplyCriteria={noop} onAction={noop} canDrillDown={false} />],
          ["Hentende", <CompanyTable key="l" title="Kunder" loadingTotal={1248} criteria={CRIT154} onApplyCriteria={noop} onAction={noop} canDrillDown={false} />],
          ["Fejlende", <CompanyTable key="f" title="Kunder" error="Forbindelsen til CVR svarede ikke. Dine kriterier er gemt, prøv igen om et øjeblik." errorId="4F2A" loadingTotal={1248} criteria={CRIT154} onApplyCriteria={noop} onRetry={noop} onAction={noop} canDrillDown={false} />],
        ]}
      />
    ),
  },

  /* ---------- 16 Personside ---------- */
  { nr: "16.1", title: "Personhoved", node: "BNF-0", spec: person("Bo Eksempel", [{ type: "LassoPersonHead", person: BO }]) },
  { nr: "16.2", title: "Roller som tidsbånd", node: "BOH-0", spec: person("Bo Eksempel", [{ type: "LassoPersonRoles", person: BO, show: "all", limit: 8 }]) },
  {
    nr: "16.3",
    title: "Netværk som tidsbånd (personer med fælles selskaber)",
    node: "LTP-0",
    gridWidth: 1152,
    note: "Paper LTP-0 (desktop, fuld bredde som i Paper) og LVN-0 (mobil): samme akse og navnekolonne som 16.2; bånd = perioden, de sad sammen.",
    spec: person("Bo Eksempel", [{ type: "LassoPersonNetwork", person: BO, limit: 3, width: "full" }]),
    // Papers eksempel (LTP-0): to fælles selskaber, et nyere samarbejde og et afsluttet i et selskab under konkurs.
    mutate: (ds) => {
      const extra = Array.from({ length: 6 }, (_, i) => ({ name: `Eksempel Person ${i + 1}`, overlapYears: 3 - (i % 3), active: false, companies: [{ companyName: "Eksempel Invest ApS", role: "bestyrelse", from: "2018-01-01", to: "2021-01-01" }] }));
      ds.personNetworks[BO] = {
        lassoId: BO,
        people: [
          {
            name: "Søren Krogh Eksempel",
            overlapYears: 14,
            active: true,
            since: "2016-03-01",
            companies: [
              { companyName: "Data Eksempel A/S", role: "bestyrelse", from: "2016-03-01" },
              { companyName: "Nordisk Datacenter A/S", role: "bestyrelse", from: "2019-05-01", to: "2023-06-30" },
            ],
          },
          { name: "Anna Nørgaard Eksempel", overlapYears: 5, active: true, since: "2021-02-01", companies: [{ companyName: "Data Eksempel A/S", role: "direktion", from: "2021-02-01" }] },
          { name: "Peter Lund Eksempel", overlapYears: 4, active: false, until: "2018-06-30", companies: [{ companyName: "Cloud Eksempel A/S", role: "bestyrelse", from: "2014-04-01", to: "2018-06-30", status: "Under konkurs", statusKind: "warning" }] },
          ...extra,
        ],
      };
    },
  },
  { nr: "16.4", title: "Personrisiko", node: "BR1-0", spec: person("Bo Eksempel", [{ type: "LassoPersonRisk", person: BO }]) },

  /* ---------- 17 Risikoobservationer ---------- */
  {
    nr: "17.1",
    title: "Alvorsskala",
    node: "BTL-0",
    render: () => <SeverityScale />,
  },
  { nr: "17.2", title: "Observationsliste med sammenfatning", node: "BUO-0", spec: company("Eksempel Byg A/S", [{ type: "LassoRiskObservations", company: BYG }]) },
  {
    nr: "17.3",
    title: "Risiko ikke tilgængelig (tre årsager)",
    node: "BV2-0",
    render: () => (
      <Section title="Risikoobservationer" span="full">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <RiskUnavailable reason="none" checkedAt="2026-09-28" />
          <RiskUnavailable reason="cannot" />
          <RiskUnavailable reason="package" onSeePackages={noop} />
        </div>
      </Section>
    ),
  },

  /* ---------- 18 Kreditvurdering over tid ---------- */
  {
    nr: "18.1",
    title: "Aktuel risikoscore, ¼-kort",
    node: "LWV-0",
    spec: company("Eksempel Byg A/S", [{ type: "LassoScoreGauge", company: BYG, width: "quarter" }]),
    mutate: paperScore,
    gridWidth: 270,
    note: "Paper LWU-0/LWV-0: kun den aktuelle score (ingen forrige, pil, kreditter, Hent-knap eller Creditsafe). Lassos risikoscore 0-100, hvor 100 = høj risiko; zoner 0-59/60-79/80-100. 'Se observationer' vises kun, når værten kan åbne risikosektionen (G1). Eksempeltal som i Paper (52, 12.09.2026).",
  },
  {
    nr: "18.1",
    title: "Aktuel risikoscore, ½-kort med \"Hvad trækker scoren\"",
    node: "LXL-0",
    spec: company("Eksempel Byg A/S", [{ type: "LassoScoreGauge", company: BYG, width: "half" }]),
    mutate: paperScore,
    gridWidth: 564,
    note: "Paper LXL-0: ½-formen vises kun, når scoremodellen leverer forklarende faktorer (ScoreVM.factors); ellers står ¼-formen i alle bredder. Live har endnu ingen scorekilde (LiveProvider.score = ikke oplyst), så faktorerne er eksempeldata.",
  },
  // 18.2 Scorehistorik udgår (Jakob 29.09): der kan ikke laves historik.
  {
    nr: "18.3",
    title: "Bekræft hentning (dialog)",
    node: "BYX-0",
    render: () => (
      <div style={{ minHeight: 560 }}>
        <CreditConfirmDialog open onClose={noop} onConfirm={noop} balance={38} price={1} description="LASSO X A/S, seneste vurdering er 13 dage gammel." />
      </div>
    ),
    note: "Afklaret (Jakob 15:41): dialogen beholdes og vises, når man klikker på en Creditsafe-rapport (koster kreditter); kun Pris og Saldo efter, ingen ventetid. Kun tilstanden med nok kreditter vises (dialogen er en overlay). Ved 0 kreditter bliver knappen 'Køb kreditter' og prisen rød (balance=0).",
  },

  /* ---------- 19 Regnskabsdetaljer ---------- */
  { nr: "19.1", title: "Regnskabsværktøjslinje", node: "C0Z-0", spec: company("Eksempel Byg A/S", [{ type: "LassoFinancialStatements", company: BYG, years: 5 }]), note: "Fuld bredde: værktøjslinje og 5 år. Kun årsregnskaber (ingen År/Halvår/Kvartal); alle poster, som regnskabet indeholder; kvalitetsflaget står foran tallet." },
  { nr: "19.2", title: "Resultatopgørelse", node: "C1X-0", spec: company("Eksempel Byg A/S", [{ type: "LassoIncomeStatement", company: BYG }]), note: "Kompakt (2 år + ændring): bruges, når elementet ikke står i fuld bredde; i fuld bredde bruges 19.1." },
  { nr: "19.3", title: "Regnskabsanalyse med \"Hent som PDF\"", node: "LYO-0", spec: company("Eksempel Byg A/S", [{ type: "LassoTextSections", company: BYG, variant: "analyse", width: "full" }]), note: "Paper LYO-0: afsnit som foldbare rækker (44 px, chevron), første åbent; \"Hent som PDF\" (LYT-0, sekundær 32 px med ikon) kun når værten kan eksportere (G1) og åbner 19.6 i rapportoverlayet; ingen genereringsdato/kildelinje (G3)." },
  { nr: "19.4", title: "Balance", node: "DA9-0", spec: company("Eksempel Byg A/S", [{ type: "LassoBalanceSheet", company: BYG }]) },
  { nr: "19.5", title: "Pengestrømsopgørelse", node: "DC9-0", spec: company("Eksempel Byg A/S", [{ type: "LassoCashFlow", company: BYG }]) },

  /* ---------- 20 P-enheder, ejendomme og CHR ---------- */
  { nr: "20.1", title: "Produktionsenheder med telefon og e-mail", node: "M1G-0", spec: company("Eksempel Byg A/S", [{ type: "LassoProductionUnits", company: BYG }]), note: "Paper M1G-0 (desktop) og 26e.1 M3A-0 (mobilbilledet 390): P-NR. | ENHED, ADRESSE OG KONTAKT (telefon og e-mail fra CVR pr. P-enhed, ikon kun ved data, G2) | BRANCHE (tekst, kode muted) | ANSATTE | OPRETTET OG STATUS. Ingen undertitel. Ophørt dæmpet. Mobil uden chevron (rækken åbner ikke noget, G1)." },
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
    spec: company("Eksempel Landbrug", [{ type: "LassoLivestock", company: LANDBRUG }]),
    note: "20.4 (C8C-0) og 20.5 (C9H-0) er én komponent (LassoLivestock).",
  },

  /* ---------- 21 Overvågning og notifikationer ---------- */
  { nr: "21.1", title: "Ændringsfeed", node: "CA9-0", spec: { title: "Overvågning", components: [{ type: "LassoChangeFeed", list: "Kunder", days: 7 }] } },
  {
    nr: "21.2",
    title: "Notifikationspanel",
    node: "CAY-0",
    note: "På mobil (390) fylder panelet skærmen som ark (fast placeret); i portalen lukkes det med × (G8).",
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
  // 22.2 Revisoruafhængighed udgår (Jakob 29.09); revisoren står i nøgle-værdi-listen (09.2).
];
