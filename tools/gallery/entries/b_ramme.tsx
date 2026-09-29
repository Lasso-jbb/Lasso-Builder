import React, { useState, type ReactNode } from "react";
void React;
import { formatAge, parseViewSpec, type Dataset } from "@lasso/spec";
import {
  ActionRow,
  AddressValue,
  AmountValue,
  AppShell,
  BooleanValue,
  Button,
  ChoiceChips,
  Column,
  Columns,
  Dialog,
  EntityRef,
  FoldText,
  Icon,
  IconButton,
  IndustryValue,
  Label,
  LassoView,
  LockedValue,
  Menu,
  Missing,
  ModuleBar,
  NotReported,
  NumberValue,
  PageHeader,
  PeriodValue,
  PercentValue,
  ContactValue,
  Picker,
  QualityFlag,
  Rail,
  RangeInputs,
  RangeValue,
  ScoreValue,
  SelectField,
  ShareValue,
  SourceLine,
  StatusBadge,
  TabStrip,
  TagInput,
  ToastItem,
  Tooltip,
  TreePickerDialog,
  ValueList,
  ValueRow,
  mapLink,
  type HostCapabilities,
  type MenuItem,
  type RailGroup,
  type StripTab,
  type TabItem,
  type TreeNode,
} from "@lasso/ui";
import type { GalleryEntry } from "../types.js";
// Cirkulær, men kun brugt ved køretid (i render), så den er løst, når den læses.
import { ENTRIES } from "./index.js";

/* ---------------------------------------------------------------- hjælpere */

const noop = () => undefined;

/** Lille grå tekst over en tilstand. */
function Cap({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--lasso-muted)", marginBottom: 8 }}>{children}</div>;
}

function Stack({ children, gap = 28 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}

function Row({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap }}>{children}</div>;
}

/** 02c: nøgle-værdi-rækker i 560 px (desktop). På 390 px står label over værdi. */
function KV({ children }: { children: ReactNode }) {
  return (
    <div className="lasso-kv-list" style={{ maxWidth: 560 }}>
      {children}
    </div>
  );
}

/** Plads til elementer, der svæver (dialoger, menuer) og tegnes i laget over #stage. */
function Room({ h, children }: { h: number; children?: ReactNode }) {
  return <div style={{ minHeight: h }}>{children}</div>;
}

/* ---------------------------------------------------------------- 06 ramme */

const I = (name: Parameters<typeof Icon>[0]["name"]) => <Icon name={name} size={15} />;

const RAIL_GROUPS: RailGroup[] = [
  {
    id: "tools",
    label: "Værktøjer",
    items: [
      { id: "udtraek", label: "Dataudtræk", icon: I("download") },
      { id: "ejendomme", label: "Ejendomme", icon: I("home") },
      { id: "maalgruppe", label: "Målgruppesøgning", icon: I("target") },
      { id: "overvaagning", label: "Overvågning", icon: I("rss") },
      { id: "risiko", label: "Risikovurdering", icon: I("info") },
      { id: "flere-tools", label: "Flere", icon: I("chevron-down") },
    ],
  },
  {
    id: "firmaer",
    label: "Firmaer",
    items: [
      { id: "overvaager", label: "Overvåger", icon: I("rss") },
      { id: "advisory", label: "Advisory Board", icon: "letter" },
      { id: "kunder", label: "Kunder", icon: "letter" },
      { id: "partnere", label: "Salgspartnere", icon: "letter" },
      { id: "flere-firmaer", label: "Flere", icon: I("chevron-down") },
    ],
    footer: { label: "Opret ny liste" },
  },
  { id: "personer", label: "Personer", collapsed: true, items: [{ id: "p1", label: "Kontakter", icon: "letter" }] },
];

const STRIP_TABS: StripTab[] = [
  { id: "t1", label: "Eksempel Byg A/S", active: true },
  { id: "t2", label: "Eksempel Software ApS" },
];

const MODULES: TabItem[] = [
  { id: "overblik", label: "Overblik" },
  { id: "salg", label: "Salg" },
  { id: "stam", label: "Stamoplysninger" },
  { id: "noegletal", label: "Nøgletal" },
  { id: "ejerdiagram", label: "Ejerdiagram" },
  { id: "nyheder", label: "Nyheder" },
  { id: "historik", label: "Historik" },
  { id: "tvilling", label: "Tvilling" },
  { id: "rating", label: "Rating" },
  { id: "regnskab", label: "Regnskab" },
  { id: "ejendomme", label: "Ejendomme" },
];

const MODULE_ACTIONS = [
  { id: "export", label: "Eksportér", items: [{ id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }, { id: "link", label: "Kopiér link" }] },
  { id: "saved", label: "Gemt", tone: "accent" as const, icon: <Icon name="saved" size={15} filled /> },
  { id: "monitor", label: "Overvåg", tone: "accent" as const, icon: <Icon name="bell" size={15} /> },
];

function Strip() {
  return <TabStrip tabs={STRIP_TABS} onSelect={noop} onClose={noop} onAdd={noop} unread={3} onBell={noop} onFeedback={noop} onAccount={noop} />;
}

function Modules() {
  const [v, setV] = useState("overblik");
  return <ModuleBar modules={MODULES} value={v} onChange={setV} actions={MODULE_ACTIONS} />;
}

const HOST: HostCapabilities = { prompt: false, save: true, savePage: true, refine: false, drillDown: true, export: true, monitor: true, openSection: true, verifyContact: true };

const CVR = "CVR-1-99000001";

/** Kroppen i tre kolonner som en LassoView (layout "columns"), løst mod demodata. */
const BODY_SPEC = {
  kind: "company",
  title: "Eksempel Byg A/S",
  layout: "columns",
  columns: 3,
  components: [
    { type: "LassoCompanyHead", company: CVR, variant: "compact", column: 1 },
    { type: "LassoContact", company: CVR, column: 1 },
    { type: "LassoShortcuts", company: CVR, column: 1 },
    { type: "LassoRelations", company: CVR, title: "Relationer", column: 2 },
    { type: "LassoOwnerList", company: CVR, column: 2 },
    { type: "LassoContactPersons", company: CVR, title: "Kontaktpersoner", column: 3 },
    { type: "LassoKeyValueList", company: CVR, column: 3 },
  ],
};

/**
 * Galleriet giver kun demodata til indgange med `spec`. Kroppen i 06.1 står inde i AppShell og er
 * derfor en `render`; den låner demodatasættene fra galleriets andre visninger (uden mutate) og
 * fletter dem, så LassoView har samme data som MCP'en.
 */
function borrowedDataset(): Dataset | null {
  const w = window as unknown as { __GALLERY_DATA__?: Record<string, Dataset> };
  const all = w.__GALLERY_DATA__;
  if (!all) return null;
  let merged: Dataset | null = null;
  for (const [id, ds] of Object.entries(all)) {
    if (ENTRIES[Number(id)]?.mutate) continue;
    if (!merged) {
      merged = structuredClone(ds);
      continue;
    }
    for (const [k, v] of Object.entries(ds)) {
      const cur = (merged as unknown as Record<string, unknown>)[k];
      if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) Object.assign(cur, v);
      else if (cur === undefined) (merged as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return merged;
}

function PageBody() {
  const ds = borrowedDataset();
  const spec = parseViewSpec(BODY_SPEC);
  if (!ds) {
    return (
      <Columns count={3}>
        <Column><h2 className="lasso-h2">Eksempel Byg A/S</h2></Column>
        <Column><h2 className="lasso-h2">Relationer</h2></Column>
        <Column><h2 className="lasso-h2">Kontaktpersoner</h2></Column>
      </Columns>
    );
  }
  return <LassoView spec={spec} dataset={ds} host={HOST} onAction={noop} />;
}

function FullPage() {
  return (
    <div style={{ height: 1000, display: "flex", margin: -24 }}>
      <AppShell rail={{ groups: RAIL_GROUPS, activeItem: "" }} tabs={{ tabs: STRIP_TABS, onSelect: noop, onClose: noop, onAdd: noop, unread: 3, onBell: noop, onFeedback: noop, onAccount: noop }} mobile={{ title: "Eksempel Byg A/S", subtitle: "Overblik", sections: MODULES, activeSection: "overblik", moreItems: [{ id: "export", label: "Eksportér" }, { id: "save", label: "Gem" }] }}>
        <Modules />
        <div style={{ overflow: "auto", minHeight: 0 }}>
          <PageBody />
        </div>
      </AppShell>
    </div>
  );
}

/* ---------------------------------------------------------------- 04 sidehoved */

const HEAD_MENU: MenuItem[] = [
  { id: "export", label: "Eksportér", icon: <Icon name="export" /> },
  { id: "monitor", label: "Overvåg listen", icon: <Icon name="bell" /> },
  { id: "delete", label: "Slet", icon: <Icon name="trash" />, destructive: true },
];

function Head(p: { dirty?: boolean; menu?: boolean; renaming?: boolean }) {
  return (
    <div className="lasso-card" style={{ maxWidth: 760 }}>
      <PageHeader
        title="Store IT-selskaber"
        subtitle="Gemt liste, 1.243 virksomheder"
        dirty={p.dirty}
        onSave={noop}
        secondary={{ label: "Gem som ny", onClick: noop }}
        onRename={noop}
        menuItems={HEAD_MENU}
        defaultMenuOpen={p.menu}
        defaultRenaming={p.renaming}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- 07 trævælger */

const TREE: TreeNode[] = [
  {
    id: "A",
    code: "A",
    label: "Landbrug, jagt, skovbrug og fiskeri",
    count: 40,
    children: [
      {
        id: "01",
        code: "01",
        label: "Plante- og husdyravl, jagt og serviceydelser",
        count: 31,
        children: [
          { id: "01.1", code: "01.1", label: "Dyrkning af etårige afgrøder", count: 7, children: [{ id: "011100", code: "011100", label: "Dyrkning af korn", count: 7 }] },
          { id: "01.2", code: "01.2", label: "Dyrkning af flerårige afgrøder", count: 9, children: [{ id: "012100", code: "012100", label: "Dyrkning af druer", count: 9 }] },
          { id: "01.3", code: "01.3", label: "Planteformering", count: 1, children: [{ id: "013000", code: "013000", label: "Planteformering", count: 1 }] },
          { id: "01.4", code: "01.4", label: "Husdyravl", count: 9, children: [{ id: "014100", code: "014100", label: "Hold af malkekvæg", count: 9 }] },
        ],
      },
      { id: "02", code: "02", label: "Skovbrug og skovning", count: 9, children: [{ id: "021000", code: "021000", label: "Skovdrift", count: 9 }] },
    ],
  },
  { id: "B", code: "B", label: "Råstofindvinding", count: 15, children: [{ id: "08", code: "08", label: "Anden råstofindvinding", count: 15 }] },
  { id: "C", code: "C", label: "Fremstillingsaktiviteter", count: 237, children: [{ id: "10", code: "10", label: "Fødevareindustri", count: 237 }] },
  { id: "D", code: "D", label: "El-, gas- og fjernvarmeforsyning", count: 13, children: [{ id: "35", code: "35", label: "El-, gas- og fjernvarmeforsyning", count: 13 }] },
];

function TreeDialog() {
  const [v, setV] = useState<string[]>(["01.1", "01.4"]);
  return (
    <Room h={880}>
      <TreePickerDialog
        open
        title="Vælg brancher"
        description="Sektion → hovedgruppe → kode"
        nodes={TREE}
        value={v}
        onChange={setV}
        defaultExpanded={["A", "01"]}
        searchPlaceholder="Søg branche eller NACE-kode"
        extra={{ label: "Søg også i bibrancher", checked: false, onChange: noop }}
        effect="Reducerer resultatet med 1.782"
        onClose={noop}
        onConfirm={noop}
      />
    </Room>
  );
}

function FormDialog() {
  const [dep, setDep] = useState<string>("adm");
  const [range, setRange] = useState<string[]>(["10", "50"]);
  return (
    <Room h={800}>
      <Dialog
        open
        title="Tilføj afdeling"
        description="Vælg en afdeling og hvor mange ansatte den skal have."
        onClose={noop}
        actions={{ secondary: { label: "Annuller", onClick: noop }, primary: { label: "Tilføj afdeling", onClick: noop } }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Afdeling</div>
            <SelectField options={[{ id: "adm", label: "Administration" }, { id: "salg", label: "Salg" }, { id: "it", label: "IT" }]} value={dep} onChange={setDep} label="Afdeling" />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Antal ansatte i afdelingen</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <RangeInputs operator="between" values={range} onChange={setRange} />
            </div>
          </div>
        </div>
      </Dialog>
    </Room>
  );
}

function ChoiceDemo() {
  const [v, setV] = useState<string[]>(["Anpartsselskab"]);
  return <ChoiceChips options={["Aktieselskab", "Anpartsselskab", "Enkeltmandsvirksomhed"]} values={v} onChange={setV} label="Virksomhedsform" />;
}

function TagDemo() {
  const [v, setV] = useState<string[]>(["2100", "8000", "Aarhus Kommune"]);
  return (
    <div style={{ maxWidth: 480 }}>
      <TagInput values={v} onChange={setV} label="Postnummer eller kommune" />
    </div>
  );
}

const LONG_PURPOSE =
  "Selskabets formål er at drive virksomhed med entreprise, byggeri og renovering af bolig- og erhvervsejendomme, herunder projektudvikling, byggestyring og rådgivning, samt at eje og administrere fast ejendom og anden virksomhed, som efter bestyrelsens skøn står i forbindelse hermed. Selskabet kan desuden deltage i andre selskaber med lignende formål.";

/* ---------------------------------------------------------------- indgange */

export const entries: GalleryEntry[] = [
  /* ---------- 02c Felter med data ---------- */
  {
    nr: "02c.1",
    title: "Fritekst",
    node: "GKV-0",
    render: () => (
      <KV>
        <ValueRow label="Navn">Eksempel Byg A/S</ValueRow>
        <ValueRow label="Binavne">Eksempel Byg Service A/S, Eksempel Tømrer og Snedker, EB Entreprise</ValueRow>
        <ValueRow label="Formål">
          <FoldText text={LONG_PURPOSE} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.2",
    title: "Tal",
    node: "GLK-0",
    render: () => (
      <KV>
        <ValueRow label="Ansatte (2024)">
          <NumberValue value={1243} />
        </ValueRow>
        <ValueRow label="Årsværk (2024)">
          <NumberValue value={1186} />
        </ValueRow>
        <ValueRow label="P-enheder">
          <NumberValue value={14} />
        </ValueRow>
        <ValueRow label="Ansatte (2023)">
          <NumberValue value={null} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.3",
    title: "Tal-interval",
    node: "GM7-0",
    render: () => (
      <KV>
        <ValueRow label="Ansatte, interval">
          <RangeValue from={10} to={19} />
        </ValueRow>
        <ValueRow label="Ansatte, åbent opad">
          <RangeValue from={1000} to={null} />
        </ValueRow>
        <ValueRow label="Ansatte, åbent nedad">
          <RangeValue from={null} to={5} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.4",
    title: "Beløb + ændring",
    node: "GMN-0",
    note: "Fuldt beløb i tooltip vises ved hover og kan ikke vises statisk.",
    render: () => (
      <KV>
        <ValueRow label="Omsætning (2024)">
          <AmountValue value={48_312_400} previous={42_980_000} />
        </ValueRow>
        <ValueRow label="Resultat før skat (2024)">
          <AmountValue value={3_412_000} previous={4_020_000} />
        </ValueRow>
        <ValueRow label="Årets resultat (2024)">
          <AmountValue value={-2_100_000} previous={1_400_000} />
        </ValueRow>
        <ValueRow label="Egenkapital (2024)">
          <AmountValue value={812_400} previous={640_000} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.5",
    title: "Procent",
    node: "GNF-0",
    render: () => (
      <KV>
        <ValueRow label="Overskudsgrad (2024)">
          <PercentValue value={17.3} compare={11.2} />
        </ValueRow>
        <ValueRow label="Soliditetsgrad (2024)">
          <PercentValue value={-4.1} compare={32} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.6",
    title: "Dato og periode",
    node: "GNY-0",
    render: () => (
      <KV>
        <ValueRow label="Stiftet">
          <PeriodValue date="2016-03-01" extra={formatAge("2016-03-01")} />
        </ValueRow>
        <ValueRow label="Regnskabsperiode">
          <PeriodValue from="2025-01-01" to="2025-12-31" />
        </ValueRow>
        <ValueRow label="Direktør">
          <PeriodValue from="2016" yearOnly />
        </ValueRow>
        <ValueRow label="Bestyrelsesmedlem">
          <PeriodValue from="2016" yearOnly open="arrow" />
        </ValueRow>
        <ValueRow label="Revisor">
          <PeriodValue from="2012" to="2019" yearOnly />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.7",
    title: "Ja/nej",
    node: "GOQ-0",
    render: () => (
      <KV>
        <ValueRow label="Reklamebeskyttet">
          <BooleanValue value={true} consequence="må ikke kontaktes med reklame" />
        </ValueRow>
        <ValueRow label="Revideret regnskab">
          <BooleanValue value={false} />
        </ValueRow>
        <ValueRow label="Momsregistreret">
          <BooleanValue value={null} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.8",
    title: "Enum og status",
    node: "GPE-0",
    render: () => (
      <KV>
        <ValueRow label="Status">
          <StatusBadge status="Aktiv" kind="active" />
        </ValueRow>
        <ValueRow label="Status">
          <StatusBadge status="Ophørt" kind="inactive" />
        </ValueRow>
        <ValueRow label="Status">
          <StatusBadge status="Under konkurs" kind="warning" />
        </ValueRow>
        <ValueRow label="Status">
          <StatusBadge status="Under likvidation" kind="warning" />
        </ValueRow>
        <ValueRow label="Virksomhedsform">Aktieselskab</ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.9",
    title: "Liste af værdier",
    node: "GQ6-0",
    render: () => (
      <KV>
        <ValueRow label="Direktion">
          <ValueList values={["Anne Eksempel", "Bo Eksempel", "Carla Eksempel", "Dan Eksempel"]} onShowAll={noop} />
        </ValueRow>
        <ValueRow label="Bestyrelse">
          <ValueList values={["Erik Eksempel", "Frida Eksempel"]} onShowAll={noop} />
        </ValueRow>
        <ValueRow label="Bibrancher">
          <ValueList values={[]} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.10",
    title: "Branche med kode",
    node: "GQP-0",
    render: () => (
      <KV>
        <ValueRow label="Branche">
          <IndustryValue code="412000" text="Opførelse af bygninger" />
        </ValueRow>
        <ValueRow label="Bibranche">
          <IndustryValue code="682040" text="Udlejning af erhvervsejendomme og andre ikke-boligejendomme samt forvaltning af egen fast ejendom" />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.11",
    title: "Adresse",
    node: "GR8-0",
    render: () => (
      <Stack>
        <KV>
          <ValueRow label="Adresse">
            <AddressValue street="Toldbodgade 37B" zip="1253" city="København K" mapUrl={mapLink(["Toldbodgade 37B", "1253 København K"])} />
          </ValueRow>
          <ValueRow label="Kommune">København</ValueRow>
          <ValueRow label="Region">Region Hovedstaden</ValueRow>
        </KV>
        <div>
          <Cap>I tabeller og hoveder, én linje</Cap>
          <AddressValue street="Toldbodgade 37B" zip="1253" city="København K" inline />
        </div>
      </Stack>
    ),
  },
  {
    nr: "02c.12",
    title: "Telefon, e-mail og web",
    node: "GRT-0",
    render: () => (
      <KV>
        <ValueRow label="Telefon">
          <ContactValue kind="phone" value="71747812" more={2} onShowAll={noop} />
        </ValueRow>
        <ValueRow label="E-mail">
          <ContactValue kind="email" value="Info@EksempelByg.dk" />
        </ValueRow>
        <ValueRow label="Web">
          <ContactValue kind="web" value="https://www.eksempelbyg.dk" />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.13",
    title: "Reference til person eller virksomhed",
    node: "GSI-0",
    render: () => (
      <KV>
        <ValueRow label="Moderselskab" onClick={noop}>
          <EntityRef name="Eksempel Holding ApS" secondary="CVR 99000010" onOpen={noop} />
        </ValueRow>
        <ValueRow label="Direktør" onClick={noop}>
          <EntityRef name="Anne Eksempel" secondary="siden 2016" onOpen={noop} />
        </ValueRow>
        <ValueRow label="Revisor" onClick={noop}>
          <EntityRef name="Eksempel Revision I/S" secondary="CVR 99000002" onOpen={noop} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.14",
    title: "Ejerandel-interval",
    node: "GTA-0",
    render: () => (
      <KV>
        <ValueRow label="Eksempel Holding ApS">
          <ShareValue range={[50, 66.66]} />
        </ValueRow>
        <ValueRow label="Anne Eksempel">
          <ShareValue range={[25, 33.32]} />
        </ValueRow>
        <ValueRow label="Bo Eksempel">
          <ShareValue range={[5, 9.99]} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.15",
    title: "Score",
    node: "GUB-0",
    render: () => (
      <KV>
        <ValueRow label="Risikoscore">
          <ScoreValue score={24} />
        </ValueRow>
        <ValueRow label="Risikoscore">
          <ScoreValue score={68} />
        </ValueRow>
        <ValueRow label="Risikoscore">
          <ScoreValue score={91} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.16",
    title: "Kvalitetsflag (mulig fejl)",
    node: "GV0-0",
    note: "Flagets egen tooltip (hover) og linjen ved tryk (mobil) kan ikke vises statisk; nederst er tooltippen tegnet åben med Tooltip open.",
    render: () => (
      <Stack>
        <KV>
          <ValueRow label="Ansatte (2024)">
            <span>
              <NumberValue value={1243} />
              <QualityFlag text="Antallet er 12 gange højere end sidste år. Vi viser tallet fra regnskabet." />
            </span>
          </ValueRow>
        </KV>
        <div style={{ paddingTop: 70, paddingLeft: 140 }}>
          <Cap>Tooltip ved mouseover</Cap>
          <Tooltip open text="Antallet er 12 gange højere end sidste år. Vi viser tallet fra regnskabet.">
            <span className="lasso-num">1.243</span>
          </Tooltip>
        </div>
      </Stack>
    ),
  },
  {
    nr: "02c.17",
    title: "Manglende værdi",
    node: "GW2-0",
    render: () => (
      <Stack>
        <KV>
          <ValueRow label="Omsætning (2024)">
            <NotReported kind="reported" />
          </ValueRow>
          <ValueRow label="Telefon">
            <NotReported kind="registered" />
          </ValueRow>
        </KV>
        <div>
          <Cap>I tabeller</Cap>
          <table className="lasso-table" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Virksomhed</th>
                <th style={{ textAlign: "right" }}>Omsætning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Eksempel Byg A/S</td>
                <td style={{ textAlign: "right" }}>
                  <Missing />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Stack>
    ),
  },
  {
    nr: "02c.18",
    title: "Låst værdi",
    node: "GWO-0",
    render: () => (
      <KV>
        <ValueRow label="Telefon, direkte">
          <LockedValue onUpgrade={noop} />
        </ValueRow>
        <ValueRow label="Kontaktpersoner">
          <LockedValue count={12} linkLabel="Opgradér for at se dem" onUpgrade={noop} />
        </ValueRow>
      </KV>
    ),
  },
  {
    nr: "02c.19",
    title: "Kilde og opdateret",
    node: "GXL-0",
    render: () => (
      <div style={{ maxWidth: 560 }}>
        <KV>
          <ValueRow label="CVR-nummer">99000001</ValueRow>
          <ValueRow label="Virksomhedsform">Aktieselskab</ValueRow>
          <ValueRow label="Stiftet">01.03.2016</ValueRow>
        </KV>
        <SourceLine source="CVR, Erhvervsstyrelsen" updated="2026-09-24" />
      </div>
    ),
  },

  /* ---------- 04 Sidehoved ---------- */
  { nr: "04.1", title: "Sidehoved (kort med titel og handlinger)", node: "495-0", note: "Tilstand 1: i ro, gemt, intet ændret.", render: () => <Head /> },
  { nr: "04.2", title: "Sidehoved, ændret — ikke gemt", node: "49K-0", render: () => <Head dirty /> },
  { nr: "04.3", title: "Sidehoved, menu åben (omdøb)", node: "4A3-0", render: () => <Room h={800}><Head menu /></Room> },
  { nr: "04.4", title: "Sidehoved, omdøber", node: "4AX-0", render: () => <Head renaming /> },

  /* ---------- 05 Knapper og etiketter ---------- */
  {
    nr: "05.1",
    title: "Knapper",
    node: "9EM-0",
    render: () => (
      <Row>
        <Button variant="primary">Gem liste</Button>
        <Button>Eksportér</Button>
        <Button variant="text">Annuller</Button>
        <Button variant="danger">Slet liste</Button>
        <Button variant="link">Se alle</Button>
      </Row>
    ),
  },
  {
    nr: "05.2",
    title: "Ikonknapper",
    node: "9FU-0",
    render: () => (
      <Stack gap={20}>
        <div>
          <Cap>38 px</Cap>
          <Row>
            <IconButton icon="more" label="Flere handlinger" />
            <IconButton icon="saved" label="Gemt" pressed filled />
            <IconButton icon="edit" label="Redigér" variant="subtle" />
            <IconButton icon="close" label="Luk" variant="bare" />
          </Row>
        </div>
        <div>
          <Cap>32 px</Cap>
          <Row>
            <IconButton icon="more" label="Flere handlinger" size={32} />
            <IconButton icon="saved" label="Gemt" size={32} pressed filled />
            <IconButton icon="edit" label="Redigér" size={32} variant="subtle" />
            <IconButton icon="close" label="Luk" size={32} variant="bare" />
          </Row>
        </div>
      </Stack>
    ),
  },
  {
    nr: "05.3",
    title: "Handlingsrække",
    node: "9GD-0",
    render: () => (
      <ActionRow more={HEAD_MENU} secondary={[{ label: "Eksportér", onClick: noop }]} primary={{ label: "Gem", onClick: noop }} />
    ),
  },
  { nr: "05.4", title: "Valg-chips", node: "9GS-0", render: () => <ChoiceDemo /> },
  { nr: "05.5", title: "Tag i felt", node: "9H4-0", render: () => <TagDemo /> },
  {
    nr: "05.6",
    title: "Etiket",
    node: "9HF-0",
    render: () => (
      <Row gap={8}>
        <Label>Branchekode</Label>
        <Label>Antal ansatte</Label>
      </Row>
    ),
  },
  {
    nr: "05.7",
    title: "Status som ren tekst",
    node: "9HM-0",
    render: () => (
      <Row gap={24}>
        <StatusBadge status="Aktiv" kind="active" />
        <StatusBadge status="Konkurs" kind="warning" />
        <StatusBadge status="Likvidation" />
        <StatusBadge status="Ophørt" kind="inactive" />
        <StatusBadge status="Ny" kind="new" />
      </Row>
    ),
  },
  {
    nr: "05.8",
    title: "Knapstørrelser (42/36/32)",
    node: "9F5-0",
    render: () => (
      <Row gap={16}>
        <div>
          <Cap>42, dialoger og paneler</Cap>
          <Button variant="primary" size={42}>
            Tilføj afdeling
          </Button>
        </div>
        <div>
          <Cap>36, sidehoveder</Cap>
          <Button variant="primary" size={36}>
            Gem
          </Button>
        </div>
        <div>
          <Cap>32, kompakte rækker</Cap>
          <Button variant="primary" size={32}>
            Tilføj
          </Button>
        </div>
      </Row>
    ),
  },
  {
    nr: "05.9",
    title: "Knaptilstande, primær",
    node: "9FE-0",
    note: "Hover og fokus kan ikke vises statisk; kun standard, gemmer (loading) og deaktiveret er tegnet.",
    render: () => (
      <Row gap={16}>
        <div>
          <Cap>Standard</Cap>
          <Button variant="primary">Gem</Button>
        </div>
        <div>
          <Cap>Gemmer</Cap>
          <Button variant="primary" loading>
            Gemmer…
          </Button>
        </div>
        <div>
          <Cap>Deaktiveret</Cap>
          <Button variant="primary" disabled>
            Gem
          </Button>
        </div>
      </Row>
    ),
  },

  /* ---------- 06 Navigation og sideskabelon ---------- */
  {
    nr: "06.1",
    title: "Sideskabelon (ramme + krop i tre kolonner)",
    node: "9IW-0",
    only: "desktop",
    desktopWidth: 1440,
    note: "AppShell med Rail, TabStrip, ModuleBar og en LassoView (layout columns, 3 kolonner) med demodata for Eksempel Byg A/S.",
    render: () => <FullPage />,
  },
  {
    nr: "06.2",
    title: "Skinne (venstre navigation)",
    node: "JNY-0",
    only: "desktop",
    desktopWidth: 1440,
    note: "Kun desktop: under 1200 px bliver skinnen 64 px med ikoner, og på mobil skjules den (bundnavigation, 26a).",
    render: () => (
      <div style={{ width: 260, background: "var(--lasso-chrome)", paddingTop: 12, borderRadius: 10 }}>
        <Rail groups={RAIL_GROUPS} />
      </div>
    ),
  },
  {
    nr: "06.3",
    title: "Fanebjælke (top)",
    node: "JPW-0",
    render: () => (
      <div style={{ background: "var(--lasso-chrome)", paddingLeft: 12 }}>
        <Strip />
        <div style={{ height: 24, background: "var(--lasso-surface)" }} />
      </div>
    ),
  },
  {
    nr: "06.4",
    title: "Modulbjælke",
    node: "JQO-0",
    render: () => (
      <div style={{ border: "1px solid var(--lasso-border)", borderRadius: 10, overflow: "hidden" }}>
        <Modules />
      </div>
    ),
  },

  /* ---------- 07 Dialoger, menuer og beskeder ---------- */
  { nr: "07.1", title: "Dialog med formular", node: "9L6-0", render: () => <FormDialog /> },
  {
    nr: "07.2",
    title: "Bekræftelsesdialog",
    node: "9LY-0",
    render: () => (
      <Room h={800}>
        <Dialog
          open
          title="Gem ændringer først?"
          description="Du har ændret Store IT-selskaber uden at gemme. Går du videre nu, går ændringerne tabt."
          onClose={noop}
          actions={{ destructive: { label: "Kassér", onClick: noop }, secondary: { label: "Annuller", onClick: noop }, primary: { label: "Gem og gå videre", onClick: noop } }}
        />
      </Room>
    ),
  },
  {
    nr: "07.3",
    title: "Menu",
    node: "9MC-0",
    render: () => (
      <Room h={800}>
        <Menu
          trigger={<Icon name="more" size={18} />}
          triggerClassName="lasso-iconbtn lasso-iconbtn--sq lasso-iconbtn--38"
          triggerLabel="Flere handlinger"
          label="Flere handlinger"
          defaultOpen
          items={[
            { id: "rename", label: "Omdøb", icon: <Icon name="edit" /> },
            { id: "export", label: "Eksportér", icon: <Icon name="export" /> },
            { id: "undo", label: "Fortryd ændringer", icon: <Icon name="undo" /> },
            { id: "delete", label: "Slet", icon: <Icon name="trash" />, destructive: true },
          ]}
        />
      </Room>
    ),
  },
  {
    nr: "07.4",
    title: "Vælger-liste",
    node: "9MX-0",
    render: () => (
      <Room h={800}>
        <Picker
          trigger={<span>Store IT-selskaber</span>}
          triggerClassName="lasso-select lasso-select--auto"
          label="Gemte søgninger"
          defaultOpen
          value="store"
          groups={[
            { items: [{ id: "ny", label: "Ny", sub: "Start forfra", icon: <Icon name="plus" /> }] },
            {
              label: "Gemte",
              items: [
                { id: "store", label: "Store IT-selskaber" },
                { id: "hovedstaden", label: "IT i Hovedstaden" },
                { id: "revisor", label: "Revisorkunder Q4" },
              ],
            },
          ]}
        />
      </Room>
    ),
  },
  {
    nr: "07.5",
    title: "Besked (toast)",
    node: "9NH-0",
    note: "Tegnet statisk med ToastItem; i brug står beskeden nederst i midten og forsvinder efter 5 sekunder.",
    render: () => (
      <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
        <ToastItem toast={{ id: 1, text: "Store IT-selskaber er gemt", tone: "ok", action: { label: "Fortryd", onClick: noop } }} />
        <ToastItem toast={{ id: 2, text: "Eksporten kunne ikke hentes", tone: "error", action: { label: "Prøv igen", onClick: noop } }} />
      </div>
    ),
  },
  {
    nr: "07.6",
    title: "Tooltip",
    node: "9O0-0",
    render: () => (
      <div style={{ paddingTop: 90, paddingLeft: 120 }}>
        <Tooltip open text="To eller flere direktions- og bestyrelsesmedlemmer med samme efternavn">
          <span style={{ fontWeight: 500 }}>Familieejet</span>
        </Tooltip>
      </div>
    ),
  },
  { nr: "07.7", title: "Dialog med trævælger", node: "9O5-0", render: () => <TreeDialog /> },
];
