import { useState, type ReactNode } from "react";
import type { Operator } from "@lasso/spec";
import {
  AmountField,
  CATALOG_ICONS,
  CHANGE_LABELS,
  CHANGE_OPERATORS,
  ChoiceChips,
  DateField,
  FieldRow,
  ICON_LABELS,
  Icon,
  IndustryField,
  LassoMark,
  LassoWordmark,
  ListField,
  MultiSelect,
  OperatorSelect,
  PersonaField,
  RangeInputs,
  SectionIntro,
  SegmentYesNo,
  SelectField,
  TagInput,
  TechnologyField,
  TechnologyRow,
  ToggleField,
  ToastItem,
  Tooltip,
  UnitInput,
  XIcon,
  YesNoChips,
  type AmountFieldValue,
  type IndustryTreeNode,
  type Option,
  type PersonaValue,
  type TechValue,
} from "@lasso/ui";
import type { GalleryEntry } from "../types.js";

// ---------- Hjælpere ----------

const noop = () => undefined;

/** Lille grå tekst over hver tilstand. */
function St({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: "var(--lasso-fs-label)", lineHeight: "var(--lasso-lh-label)", fontWeight: 600, letterSpacing: "var(--lasso-ls-label)", textTransform: "uppercase", color: "var(--lasso-muted)" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Grid({ children, cols, gap = 24, minHeight }: { children: ReactNode; cols?: string; gap?: number; minHeight?: number }) {
  return <div style={{ display: "grid", gap, gridTemplateColumns: cols, alignItems: "start", minHeight }}>{children}</div>;
}

const Swatch = ({ v }: { v: string }) => (
  <div style={{ display: "grid", gap: 6 }}>
    <div style={{ height: 44, borderRadius: "var(--lasso-radius)", background: `var(${v})`, border: "1px solid var(--lasso-border)" }} />
    <code style={{ fontSize: 11, color: "var(--lasso-muted)" }}>{v.replace("--lasso-", "")}</code>
  </div>
);

function Swatches({ vars }: { vars: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
      {vars.map((v) => (
        <Swatch key={v} v={v} />
      ))}
    </div>
  );
}

// ---------- 01 Fundament ----------

function Colors() {
  return (
    <Grid>
      <St label="Koral (4)">
        <Swatches vars={["--lasso-accent", "--lasso-accent-text", "--lasso-accent-soft", "--lasso-accent-border"]} />
      </St>
      <St label="Tekst (8)">
        <Swatches vars={["--lasso-text", "--lasso-text-2", "--lasso-text-3", "--lasso-placeholder", "--lasso-icon", "--lasso-faint", "--lasso-danger", "--lasso-positive"]} />
      </St>
      <St label="Flader og linjer (8)">
        <Swatches vars={["--lasso-bg", "--lasso-surface-2", "--lasso-surface-muted", "--lasso-chrome", "--lasso-border", "--lasso-border-strong", "--lasso-divider-subtle", "--lasso-overlay"]} />
      </St>
      <St label="Status">
        <Swatches vars={["--lasso-danger", "--lasso-danger-soft", "--lasso-positive", "--lasso-positive-soft", "--lasso-warning", "--lasso-warning-soft", "--lasso-bankrupt"]} />
      </St>
    </Grid>
  );
}

const TYPE_ROWS: { name: string; fs: string; lh: string; fw: string; extra?: React.CSSProperties; text: string }[] = [
  { name: "Display 32/40/700", fs: "--lasso-fs-display", lh: "--lasso-lh-display", fw: "700", text: "Eksempel Byg A/S" },
  { name: "Titel 24/32/600", fs: "--lasso-fs-xl", lh: "--lasso-lh-xl", fw: "var(--lasso-fw-semibold)", text: "Regnskab 2025" },
  { name: "Sidetitel 18/24/600", fs: "--lasso-fs-lg", lh: "--lasso-lh-lg", fw: "var(--lasso-fw-semibold)", text: "Nøgletal" },
  { name: "Feltnavn 14/18/600", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-semibold)", text: "Postnummer" },
  { name: "Knap/værdi 14/18/500", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-medium)", text: "18,4 mio. kr." },
  { name: "Brødtekst 14/18/400", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-regular)", text: "Virksomheden driver entreprenørvirksomhed i Region Midtjylland." },
  { name: "Lille 13/18/400", fs: "--lasso-fs-sm", lh: "--lasso-lh-sm", fw: "var(--lasso-fw-regular)", text: "Kilde: CVR, Erhvervsstyrelsen" },
  { name: "Overlinje 11/14/600 +8 %", fs: "--lasso-fs-label", lh: "--lasso-lh-label", fw: "var(--lasso-fw-semibold)", extra: { letterSpacing: "var(--lasso-ls-label)", textTransform: "uppercase", color: "var(--lasso-muted)" }, text: "Stamoplysninger" },
];

function Typography() {
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {TYPE_ROWS.map((r) => (
        <div key={r.name} style={{ display: "flex", flexWrap: "wrap", columnGap: 20, rowGap: 4, alignItems: "baseline", padding: "12px 0", borderBottom: "1px solid var(--lasso-border)" }}>
          <span className="lasso-small lasso-muted" style={{ flex: "0 0 220px" }}>{r.name}</span>
          <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: `var(${r.fs})`, lineHeight: `var(${r.lh})`, fontWeight: r.fw as never, color: "var(--lasso-text)", ...r.extra }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

function Spacing() {
  const steps = ["--lasso-space-1", "--lasso-space-2", "--lasso-space-3", "--lasso-space-4", "--lasso-space-row", "--lasso-space-5", "--lasso-space-7", "--lasso-space-10"];
  const px = ["4", "8", "12", "16", "20", "24", "28", "40"];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "center", gap: 16 }}>
          <code style={{ fontSize: 12, color: "var(--lasso-muted)" }}>{s.replace("--lasso-", "")}, {px[i]} px</code>
          <div style={{ width: `var(${s})`, height: 16, background: "var(--lasso-accent-soft)", border: "1px solid var(--lasso-accent-border)" }} />
        </div>
      ))}
    </div>
  );
}

function Radii() {
  const r: [string, string][] = [
    ["--lasso-radius", "Felter og knapper"],
    ["--lasso-radius-menu", "Menupunkter"],
    ["--lasso-radius-lg", "Faner og kort"],
    ["--lasso-radius-xl", "Dialoger"],
    ["--lasso-radius-pill", "Kontakt/pille"],
  ];
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {r.map(([v, t]) => (
        <div key={v} style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <div style={{ width: 96, height: 64, borderRadius: `var(${v})`, border: "1px solid var(--lasso-border-strong)", background: "var(--lasso-surface-2)" }} />
          <code style={{ fontSize: 11, color: "var(--lasso-muted)" }}>{v.replace("--lasso-", "")}</code>
          <span className="lasso-small">{t}</span>
        </div>
      ))}
    </div>
  );
}

function Shadows() {
  const box: React.CSSProperties = { width: 240, height: 110, borderRadius: "var(--lasso-radius-lg)", border: "1px solid var(--lasso-border)", background: "var(--lasso-surface)", padding: 16, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start", paddingBottom: 24 }}>
      <St label="Kort, ingen skygge">
        <div style={{ ...box, boxShadow: "var(--lasso-shadow)" }} className="lasso-small">--lasso-shadow: none</div>
      </St>
      <St label="Svævende (menu, dialog)">
        <div style={{ ...box, boxShadow: "var(--lasso-shadow-pop)", borderRadius: "var(--lasso-radius-xl)" }} className="lasso-small">--lasso-shadow-pop</div>
      </St>
      <St label="Fokus, 1 px koral kant">
        <input className="lasso-input" defaultValue="2100, 2200" style={{ borderColor: "var(--lasso-focus-border)", width: 240 }} aria-label="Fokus" />
      </St>
    </div>
  );
}

function Icons() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 16 }}>
      {CATALOG_ICONS.map((n) => (
        <div key={n} style={{ display: "grid", justifyItems: "center", gap: 8, padding: "12px 4px", color: "var(--lasso-text)" }}>
          <Icon name={n} size={24} />
          <span className="lasso-small lasso-muted">{ICON_LABELS[n]}</span>
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", color: "var(--lasso-text-2)" }}>
        <span className="lasso-small lasso-muted">Størrelser:</span>
        {[14, 16, 18, 20].map((s) => (
          <span key={s} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Icon name="search" size={s} />
            <span className="lasso-small" style={{ whiteSpace: "nowrap" }}>{s} px</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- 01b Logo ----------

function LogoMasters() {
  const card: React.CSSProperties = { display: "grid", placeItems: "center", height: 120, border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", color: "var(--lasso-text)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, alignItems: "start" }}>
      <St label="Master, ikon">
        <div style={card}>
          <LassoMark className="gal-mark" />
        </div>
        <style>{".gal-mark{width:76px;height:auto}.gal-word{width:150px;height:auto}"}</style>
      </St>
      <St label="Master, navnelogo">
        <div style={card}>
          <LassoWordmark className="gal-word" />
        </div>
      </St>
      <St label="Frizone">
        <div style={card}>
          <div style={{ padding: 12, outline: "1px dashed var(--lasso-accent-border)" }}>
            <LassoMark className="gal-mark48" />
          </div>
          <style>{".gal-mark48{width:58px;height:48px;display:block}"}</style>
        </div>
      </St>
      <St label="Brug">
        <p className="lasso-small" style={{ margin: 0, color: "var(--lasso-text-2)" }}>
          Tegnet med LassoMark og LassoWordmark (currentColor = ink). Brugsreglerne står kun i Paper; koden har ingen frizone-token.
        </p>
      </St>
    </div>
  );
}

function LogoSizes() {
  const mark: [number, string][] = [[16, "favicon, kilde"], [20, "app-ikon"], [24, "skinne"], [32, "tom tilstand"]];
  const word: [number, string][] = [[14, "bundlinje, PDF hoved"], [18, "login, tomme tilstande"], [28, "forside, login"]];
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap", color: "var(--lasso-text)", padding: "16px 0", borderTop: "1px solid var(--lasso-border)", borderBottom: "1px solid var(--lasso-border)" }}>
      <style>{mark.map(([h]) => `.gal-m${h}{height:${h}px;width:${(h * 117) / 97}px;display:block}`).join("") + word.map(([h]) => `.gal-w${h}{height:${h}px;width:${(h * 453) / 132}px;display:block}`).join("")}</style>
      {mark.map(([h, t]) => (
        <div key={h} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <LassoMark className={`gal-m${h}`} />
          <span className="lasso-small lasso-muted">{h}, {t}</span>
        </div>
      ))}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--lasso-border)" }} />
      {word.map(([h, t]) => (
        <div key={h} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <LassoWordmark className={`gal-w${h}`} />
          <span className="lasso-small lasso-muted">{h}, {t}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- 02a Grundformer ----------
// Paper 02a/02b.14: feltnavnet står over feltet (14/600), hjælpeteksten under (13/400, grå). Felterne
// tegnes derfor med FieldRow layout="form" og Papers eksempeltekster.

function FreeText() {
  const [op, setOp] = useState<Operator>("contains");
  const [v, setV] = useState("");
  return (
    <FieldRow label="Navn" layout="form" help="Operatorer: indeholder, begynder med, er lig med, er ikke">
      <OperatorSelect value={op} operators={["contains", "starts_with", "eq", "neq"]} onChange={setOp} />
      <input className="lasso-input" value={v} placeholder="Indtast" onChange={(e) => setV(e.target.value)} aria-label="Navn" />
    </FieldRow>
  );
}

const NUMBER_HELP = "Operatorer: er lig med (=), er mindst (≥), er højst (≤), er større end (>), er mindre end (<), er mellem, er ikke (≠)";

function NumberDemo({ between = false }: { between?: boolean }) {
  const [op, setOp] = useState<Operator>(between ? "between" : "gte");
  const [vals, setVals] = useState<string[]>(between ? ["10", "49"] : ["10"]);
  return (
    <FieldRow label="Antal ansatte" layout="form" help={between ? undefined : NUMBER_HELP}>
      <OperatorSelect value={op} operators={["eq", "gte", "lte", "gt", "lt", "between", "neq"]} onChange={setOp} />
      <RangeInputs operator={op} values={vals} onChange={setVals} />
    </FieldRow>
  );
}

function AmountDemo() {
  const [a, setA] = useState<AmountFieldValue>({ operator: "gte", values: ["5.000.000"] });
  const [c, setC] = useState<AmountFieldValue>({ operator: "gte", values: ["10"] });
  return (
    <Grid>
      <St label="Beløb (kr.) og % ændring">
        <FieldRow label="Omsætning" layout="form" help="Ingen overskrift: enheden skiller de to rækker. “kr.” er beløbet, “% ændring” er udviklingen. Begge kan bruges alene.">
          <AmountField amount={a} change={c} operators={["gte", "lte", "between"]} onAmount={setA} onChange={setC} />
        </FieldRow>
      </St>
      <St label="Ændring, de tre operatorer">
        <Grid gap={10}>
          {(["gte", "lte", "between"] as Operator[]).map((op) => (
            <div key={op} className="lasso-amountfield__row">
              <OperatorSelect value={op} operators={CHANGE_OPERATORS} labels={CHANGE_LABELS} onChange={noop} />
              <RangeInputs operator={op} values={op === "between" ? ["10", "40"] : ["10"]} unit="% ændring" onChange={noop} />
            </div>
          ))}
        </Grid>
      </St>
      <St label="Operatoren åben (liste)">
        <div style={{ minHeight: 190 }}>
          <div className="lasso-amountfield__row">
            <OperatorSelect value="gte" operators={CHANGE_OPERATORS} labels={CHANGE_LABELS} onChange={noop} defaultOpen />
          </div>
        </div>
      </St>
    </Grid>
  );
}

function PercentDemo() {
  const [op, setOp] = useState<Operator>("gte");
  const [vals, setVals] = useState<string[]>(["15"]);
  return (
    <FieldRow label="Soliditetsgrad" layout="form">
      <OperatorSelect value={op} operators={["eq", "gte", "lte", "between"]} onChange={setOp} />
      <RangeInputs operator={op} values={vals} unit="%" onChange={setVals} />
    </FieldRow>
  );
}

function DateDemo() {
  const [op, setOp] = useState<Operator>("after");
  const [vals, setVals] = useState<string[]>([""]);
  return (
    <FieldRow label="Stiftelsesdato" layout="form" help="Operatorer: efter den, før den, præcis den, mellem (viser to datofelter)">
      <DateField operator={op} operators={["after", "before", "eq", "between"]} values={vals} onOperator={setOp} onChange={setVals} />
    </FieldRow>
  );
}

const FORMS = ["Aktieselskab", "Anpartsselskab", "Enkeltmandsvirksomhed", "Interessentskab", "Iværksætterselskab", "Andelsselskab", "Forening", "Fond"];

function SingleDemo() {
  const [op, setOp] = useState<Operator>("eq");
  const [v, setV] = useState<string>("Anpartsselskab");
  return (
    <FieldRow label="Virksomhedsform" layout="form">
      <OperatorSelect value={op} operators={["eq", "neq"]} onChange={setOp} />
      <SelectField options={FORMS} value={v} onChange={setV} />
    </FieldRow>
  );
}

const KOMMUNER = ["Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde", "Herning", "Silkeborg", "København", "Frederiksberg"];

function TagsDemo() {
  const [v, setV] = useState<string[]>(["Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers"]);
  return (
    <Grid>
      <FieldRow label="Kommune" layout="form" help="Tom = alle. Feltet vokser i højden når tags ombrydes.">
        <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
        <TagInput values={v} suggestions={KOMMUNER} onChange={setV} dropdown morePlaceholder="Tilføj flere…" />
      </FieldRow>
      <St label="Tagets tilstande">
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
            <span className="lasso-chip">
              Aarhus
              <button type="button" className="lasso-chip__remove" aria-label="Fjern Aarhus">
                <XIcon />
              </button>
            </span>
            <span className="lasso-field__help" style={{ marginTop: 0 }}>Hvile</span>
          </div>
          <style>{".gal-hover.lasso-chip{background:var(--lasso-tag-hover)}.gal-hover .lasso-chip__remove{color:var(--lasso-accent)}"}</style>
          <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
            <span className="lasso-chip gal-hover">
              Odense
              <button type="button" className="lasso-chip__remove" aria-label="Fjern Odense">
                <XIcon />
              </button>
            </span>
            <span className="lasso-field__help" style={{ marginTop: 0 }}>Markøren over krydset</span>
          </div>
        </div>
        <p className="lasso-field__help" style={{ maxWidth: 720 }}>
          Krydset er gråt i hvile — ellers står et felt med fem tags og skriger. Det bliver koralt når markøren rammer det, så man ved hvad man er ved at fjerne. Rød er forbeholdt det der ikke kan fortrydes.
        </p>
      </St>
    </Grid>
  );
}

const REGIONER = ["Hovedstaden", "Sjælland", "Syddanmark", "Midtjylland", "Nordjylland"];

function ChipsDemo() {
  const [v, setV] = useState<string[]>(["Midtjylland", "Nordjylland"]);
  return (
    <FieldRow label="Region" layout="form">
      <ChoiceChips options={REGIONER} values={v} onChange={setV} label="Region" />
    </FieldRow>
  );
}

function YesNoDemo() {
  const [a, setA] = useState<boolean | null>(true);
  return (
    <FieldRow label="Telefonnummer findes" layout="form" info="Kun virksomheder med et registreret telefonnummer." help="Intet valgt = filteret tæller ikke med. Erstatter produktionens radiogruppe med “Ingen betydning”. Info-ikonet viser en forklaring ved hover.">
      <YesNoChips value={a} onChange={setA} label="Telefonnummer findes" />
    </FieldRow>
  );
}

const POSTNUMRE = ["2100 København Ø", "2200 København N", "8000 Aarhus C", "8200 Aarhus N", "5000 Odense C", "9000 Aalborg"];

function SearchListDemo() {
  const [v, setV] = useState<string[]>([]);
  return (
    <FieldRow label="Postnummer" layout="form" help="Accepterer indsat liste adskilt med komma. Valgte værdier bliver til tags som i 08.">
      <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
      <TagInput values={v} suggestions={POSTNUMRE} onChange={setV} searchIcon />
    </FieldRow>
  );
}

/** Papers eksempel i 02a.12 (koder og navne som i Paper). */
const PAPER_TREE: IndustryTreeNode[] = [
  { code: "J", label: "Information og kommunikation", children: [
    { code: "62", label: "It-konsulenter mv.", children: [
      { code: "620100", label: "Computerprogrammering" },
      { code: "620200", label: "It-konsulentvirksomhed" },
      { code: "620300", label: "Computerdrift" },
    ] },
  ] },
];

function IndustryDemo() {
  const [v, setV] = useState<string[]>(["620100", "620200", "620300"]);
  return (
    <FieldRow label="Branche" layout="form" help="Ét felt, ingen løs knap. Feltet viser de valgte som tekst — to navne og “og N flere” — og hele feltet åbner træ-vælgeren. Tomt: “Vælg brancher”.">
      <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
      <IndustryField tree={PAPER_TREE} values={v} onChange={setV} />
    </FieldRow>
  );
}

const TECH = ["Umbraco", "WordPress", "Shopify", "Magento", "Dynamicweb", "Sitecore", "Drupal", "Wix"];

function CapDemo() {
  const [v, setV] = useState<string[]>(["Umbraco", "WordPress"]);
  return (
    <Grid gap={16}>
      <FieldRow label="CMS" layout="form">
        <TagInput values={v} max={3} suggestions={TECH} onChange={setV} />
      </FieldRow>
      <FieldRow label="CMS" layout="form" help="Tælleren står i feltet. Ved 3 af 3 bliver placeholderen “Loftet er nået”, og listen kan ikke åbnes.">
        <TagInput values={["Umbraco", "WordPress", "Shopify"]} max={3} suggestions={TECH} onChange={noop} />
      </FieldRow>
    </Grid>
  );
}

// ---------- 02b Mønstre og tilstande ----------

const ROLES: Option[] = [
  { id: "dir", label: "Direktør", count: 122856 },
  { id: "head", label: "Head of", count: 18412 },
  { id: "chef", label: "Chef", count: 64210 },
  { id: "leder", label: "Leder", count: 41377 },
  { id: "ejer", label: "Ejer", count: 98530 },
];
const DEPTS: Option[] = [
  { id: "dir", label: "Direktion", count: 54012 },
  { id: "oek", label: "Økonomi", count: 31264 },
  { id: "salg", label: "Salg", count: 29870 },
  { id: "it", label: "IT", count: 14102 },
  { id: "hr", label: "HR", count: 11846 },
  { id: "mark", label: "Marketing", count: 9655 },
  { id: "prod", label: "Produktion", count: 8702 },
  { id: "lager", label: "Lager og logistik", count: 5431 },
];

function PersonaDemo() {
  const [v, setV] = useState<PersonaValue>({ roles: ["dir", "head"], departments: [], directPhone: true });
  return (
    <FieldRow label="Kontaktpersoner" layout="form">
      <PersonaField value={v} onChange={setV} roles={ROLES} departments={DEPTS} onRemove={noop} onAdd={noop} />
    </FieldRow>
  );
}

function PersonaModal() {
  const [v, setV] = useState<PersonaValue>({ roles: ["dir"], departments: ["dir"] });
  return (
    <div style={{ minHeight: 740 }}>
      <PersonaField value={v} onChange={setV} roles={ROLES} departments={DEPTS} defaultOpen countFor={(p) => Math.max(0, 224324 - p.roles.length * 31000 - p.departments.length * 12000)} />
    </div>
  );
}

function TechOperatorDemo() {
  const [v, setV] = useState<TechValue>({ on: true, mode: "include", values: ["HubSpot"] });
  return (
    <FieldRow label="Teknologier" layout="form" info="Teknologier fundet på virksomhedens hjemmeside." help="Operatoren erstatter to separate felter i produktionen: benytter, benytter ikke.">
      <TechnologyField label="Teknologier" variant="operator" value={v} onChange={setV} suggestions={["HubSpot", "Salesforce", "Pipedrive", ...TECH]} />
    </FieldRow>
  );
}

function ToggleDemo() {
  const [a, setA] = useState(true);
  return <ToggleField label="Skal have direkte telefonnummer" on={a} onChange={setA} help="Er “Nej” meningsløst, brug en kontakt i stedet for chips. Slukket = filteret tæller ikke med." />;
}

function SectionIntroDemo() {
  return (
    <div>
      <SectionIntro>Tallene er fra seneste offentliggjorte årsregnskab. Virksomheder i regnskabsklasse B skal ikke oplyse omsætning.</SectionIntro>
      <div className="lasso-field__help">Kun på sektioner der har brug for en forklaring. Står øverst, før første felt.</div>
    </div>
  );
}

function InfoDemo() {
  return (
    <div style={{ minHeight: 90 }}>
      <div className="lasso-field lasso-field--form" role="group">
        <div className="lasso-field__name">
          <span>Bruttofortjeneste</span>
          <Tooltip text="Omsætning minus vareforbrug og andre eksterne omkostninger. Oplyses af de fleste virksomheder i regnskabsklasse B." className="lasso-infotip" placement="right" open>
            <button type="button" className="lasso-infotip__btn" aria-label="Om Bruttofortjeneste">
              <Icon name="info" size={14} />
            </button>
          </Tooltip>
        </div>
        <div className="lasso-field__control">
          <OperatorSelect value="gte" operators={["gte", "lte"]} onChange={noop} />
          <UnitInput value="2.000.000" onChange={noop} unit="kr." />
        </div>
        <div className="lasso-field__help lasso-field__helpline">Erstatter underlinjen under feltnavnet, så forklaringen ikke fylder i listen når man ikke har brug for den.</div>
      </div>
    </div>
  );
}

function RequiredDemo() {
  const [v, setV] = useState("2100, 2200");
  return (
    <FieldRow label="Postnummer" layout="form" required active>
      <input className="lasso-input" style={{ width: 300, flex: "none" }} value={v} onChange={(e) => setV(e.target.value)} aria-label="Postnummer" />
    </FieldRow>
  );
}

const STATUSER = ["Normal / aktiv", "Under konkurs", "Under likvidation", "Under frivillig likvidation", "Opløst efter konkurs", "Opløst efter fusion", "Tvangsopløst", "Ophørt"];

function DropdownOpen() {
  const [v, setV] = useState<string[]>(["Normal / aktiv"]);
  return (
    <div style={{ minHeight: 480, maxWidth: 520 }}>
      <FieldRow label="Status" layout="form">
        <MultiSelect options={STATUSER} values={v} onChange={setV} defaultOpen help="Vælg en eller flere. Tom = alle." label="Status" />
      </FieldRow>
    </div>
  );
}

function SegmentDemo() {
  const [v, setV] = useState<boolean | null>(null);
  return (
    <FieldRow label="Reklamebeskyttet" layout="form" help="Dev3 bruger denne. Variant 10 (to chips) er stadig anbefalingen — den fjerner en knap der ikke gør noget. Dokumenteret her, så valget er bevidst.">
      <SegmentYesNo value={v} onChange={setV} />
    </FieldRow>
  );
}

function PasteDemo() {
  const [v, setV] = useState<string[]>([]);
  return (
    <FieldRow label="Postnummer" layout="form" help="Kommasepareret eller én pr. linje. Tekstområdet er til at klistre ind i; dropdown’en er til at browse. Begge fylder samme tag-liste.">
      <ListField values={v} onChange={setV} suggestions={POSTNUMRE} label="Postnummer" />
    </FieldRow>
  );
}

function DateOpen() {
  const [vals, setVals] = useState<string[]>([""]);
  return (
    <div style={{ minHeight: 360 }}>
      <FieldRow label="Stiftelsesdato" layout="form">
        <DateField operator="after" operators={["after", "before", "eq", "between"]} labels={{ after: "Efter", before: "Før", eq: "Præcis", between: "Mellem" }} placeholder="Vælg dato" values={vals} onOperator={noop} onChange={setVals} defaultOpen today={new Date(2026, 8, 4)} />
      </FieldRow>
    </div>
  );
}

function ChipsCountDemo() {
  const [v, setV] = useState<string[]>(["dir", "head"]);
  return (
    <FieldRow label="Rolle" layout="form" help="Tom = alle roller. Valgt chip får fuld koral kant, ikke kun blød flade — den skal kunne skelnes selv når fem står ved siden af hinanden.">
      <ChoiceChips options={ROLES} values={v} onChange={setV} label="Rolle" />
    </FieldRow>
  );
}

function ListCountDemo() {
  const [v, setV] = useState<string[]>([]);
  return (
    <div style={{ minHeight: 520, maxWidth: 480 }}>
      <FieldRow label="Afdelinger" layout="form">
        <MultiSelect
          options={DEPTS}
          values={v}
          onChange={setV}
          defaultOpen
          searchable
          placeholder="Alle afdelinger"
          searchPlaceholder="Søg i afdelinger…"
          help={
            <>
              Tom = alle afdelinger.
              <br />
              224.324 beslutningstagere i alt.
            </>
          }
          label="Afdelinger"
        />
      </FieldRow>
    </div>
  );
}

function DirectEdit() {
  const [a, setA] = useState<string[]>(["Aarhus"]);
  const [b, setB] = useState<string[]>(["2100 København Ø"]);
  return (
    <Grid>
      <St label="Aktivt, koral kant om inputtet, Ryd til højre">
        <FieldRow label="Kommune" active onClear={noop}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={a} suggestions={KOMMUNER} onChange={setA} />
        </FieldRow>
      </St>
      <St label="Taster, effekten under, Annuller / Tilføj">
        <FieldRow label="Postnummer" active pending={{ mode: "add", delta: -28910, onCancel: noop, onConfirm: noop }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={b} suggestions={POSTNUMRE} onChange={setB} defaultText="80" morePlaceholder="" />
        </FieldRow>
      </St>
      <St label="Tilføjet, besked nederst i midten">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ToastItem toast={{ id: 1, text: "Postnummer er tilføjet", tone: "ok", variant: "added", action: { label: "Se alle filtre", onClick: noop } }} />
        </div>
      </St>
    </Grid>
  );
}

const RULES = [
  "Feltnavn står over feltet (14/600). Hjælpetekst står under (13/400, grå). Et info-ikon ved navnet erstatter hjælpeteksten, når forklaringen kun sjældent er nødvendig.",
  "Har feltet en operator, står den altid først og bestemmer resten af rækken. Vælger man “er mellem”, folder et andet felt sig ud. Tekst: indeholder, begynder med, er lig med, er ikke. Tal: er lig med, er mindst, er højst, er større end, er mindre end, er mellem, er ikke.",
  "Alle felter er 44 px høje med 8 px radius og 1 px kant i border-farven. Tags inde i felter er 30 px med 6 px radius, neutrale og med kryds.",
  "Feltet man redigerer får kun en tynd 1 px koral kant (primary-border). Ingen blød ring eller skygge udenom. Rammen om en hel feltblok bruges aldrig.",
  "Påkrævet uden værdi: rød stjerne efter feltnavnet. Fejl: rød hjælpetekst under feltet — kanten forbliver neutral.",
  "Koral markerer valg, fokus og den ene primære handling — aldrig dekoration.",
  "Under seks faste værdier: chips (09). Ja/nej: segmenteret kontrol eller kontakt. Ellers: søgbar liste (11) eller dropdown.",
  "En valgt chip er koral lys med flueben. Et tag inde i et felt er neutralt med kryds, fordi alt i feltet allerede er valgt.",
  "Sammenklappet viser et felt sin værdi som rolig grå tekst til højre for navnet. Flere værdier: de to første nævnes, resten tælles — “Normal / aktiv, Ophørt og 3 flere”.",
  "Et felt med værdi har “Ryd” yderst til højre i rækken. Der er intet kryds på rækken.",
  "Handlingslinjen under et felt (effekt til venstre, Annuller + primær knap til højre) vises kun, når en ændring venter på at blive bekræftet. Knappen hedder det man gør: “Tilføj”, “Opdater”, “Gem”.",
  "Man kan aldrig have to ubekræftede ændringer på én gang. Går man videre fra et felt med ubekræftet indhold, spørger en dialog: gå videre uden, annullér, gem og gå videre.",
  "Tal skrives dansk: 1.243.501, 12,4 %, 3,2 mio. kr. Datoer: dd.mm.åååå.",
  "Mens data hentes, står skelet-linjer (14 px høje, 7 px radius, #EEEFF2, skiftende bredde) i de rækker indholdet skal stå i, så intet hopper.",
];

function RulesDemo() {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: "var(--lasso-fs-lg)", lineHeight: "24px", fontWeight: 600, color: "var(--lasso-text)" }}>02b.14, Gennemgående regler</h3>
      {RULES.map((r) => (
        <p key={r} style={{ margin: 0, fontSize: "var(--lasso-fs)", lineHeight: "22px", color: "var(--lasso-text-2)" }}>
          {r}
        </p>
      ))}
    </div>
  );
}

// ---------- 03 Feltets tilstande ----------

function FieldStates() {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>(["Aarhus", "Odense"]);
  return (
    <Grid gap={32}>
      <St label="1 I ro">
        <FieldRow label="Kommune" layout="stacked" collapsible open={open} onToggle={() => setOpen(!open)} summary="Aarhus, Odense og 3 flere">
          <span />
        </FieldRow>
      </St>
      <St label="2 I redigering">
        <FieldRow label="Postnummer" layout="stacked" collapsible open active onToggle={noop} pending={{ mode: "add", onCancel: noop, onConfirm: noop }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={a} suggestions={POSTNUMRE} onChange={setA} defaultText="2100, 2200, 8000" />
        </FieldRow>
      </St>
      <St label="Redigering af felt med eksisterende værdi">
        <FieldRow label="Kommune" active pending={{ mode: "update", delta: 4120, onCancel: noop, onConfirm: noop, compact: true }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={b} suggestions={KOMMUNER} onChange={setB} morePlaceholder="" />
        </FieldRow>
      </St>
    </Grid>
  );
}

function TechRow({ label, init, pending }: { label: string; init: TechValue; pending?: boolean }) {
  const [v, setV] = useState<TechValue>(init);
  return (
    <TechnologyRow label={label} value={v} onChange={setV} onClear={noop} suggestions={TECH} active={pending} pending={pending ? { mode: "add", delta: -402310, onCancel: noop, onConfirm: noop } : undefined} />
  );
}

// ---------- Indgange ----------

export const entries: GalleryEntry[] = [
  { nr: "01.1", title: "Farver", node: "964-0", render: () => <Colors /> },
  { nr: "01.2", title: "Typografi", node: "98Q-0", render: () => <Typography /> },
  { nr: "01.3", title: "Afstande", node: "99K-0", render: () => <Spacing /> },
  { nr: "01.4", title: "Hjørner", node: "9AC-0", render: () => <Radii /> },
  { nr: "01.5", title: "Skygger og fokus", node: "9AV-0", render: () => <Shadows /> },
  { nr: "01.6", title: "Ikoner", node: "9B9-0", render: () => <Icons /> },
  {
    nr: "01.7",
    title: "Datavisning, faste regler",
    node: "GY5-0",
    spec: {
      kind: "company",
      title: "Eksempel Byg A/S",
      components: [
        { type: "LassoKeyFigureCards", company: "CVR-1-99000001" },
        { type: "LassoKeyValueList", company: "CVR-1-99000001" },
        { type: "LassoKeyValueList", company: "CVR-1-99000001", variant: "financials" },
      ],
    },
    note: "Reglerne er tekst i Paper; her vist anvendt på demodata (danske tal, mio. kr. med én decimal, “Ikke oplyst”, nøgle-værdi-rækker).",
  },
  { nr: "01b.1", title: "Logo, mastere (ikon, navnelogo, frizone, brug)", node: "IFD-0", render: () => <LogoMasters /> },
  { nr: "01b.2", title: "Logostørrelser", node: "IG6-0", render: () => <LogoSizes />, note: "Paper viser 8 eksempler (4 ikon, 3–4 navnelogo); her 4 + 3 størrelser tegnet med samme komponenter." },

  { nr: "02a.1", title: "Fritekst", node: "4BF-0", render: () => <FreeText /> },
  { nr: "02a.2", title: "Tal", node: "4BU-0", render: () => <NumberDemo /> },
  { nr: "02a.3", title: "Tal, mellem", node: "4CA-0", render: () => <NumberDemo between /> },
  { nr: "02a.4", title: "Beløb + ændring", node: "4SC-0", render: () => <AmountDemo /> },
  { nr: "02a.5", title: "Procent", node: "4DE-0", render: () => <PercentDemo /> },
  { nr: "02a.6", title: "Dato", node: "4DT-0", render: () => <DateDemo /> },
  { nr: "02a.7", title: "Enkeltvalg", node: "4EC-0", render: () => <SingleDemo /> },
  { nr: "02a.8", title: "Multivalg (tags)", node: "4R0-0", render: () => <TagsDemo />, note: "Hover-tilstanden på krydset er tegnet med inline koral farve (kan ikke hovers statisk)." },
  { nr: "02a.9", title: "Chips", node: "4FH-0", render: () => <ChipsDemo /> },
  { nr: "02a.10", title: "Ja / Nej", node: "4G3-0", render: () => <YesNoDemo /> },
  { nr: "02a.11", title: "Søgbar liste", node: "4GO-0", render: () => <SearchListDemo /> },
  { nr: "02a.12", title: "Hierarki (brancher)", node: "4H6-0", render: () => <IndustryDemo /> },
  { nr: "02a.13", title: "Multivalg med loft", node: "4HR-0", render: () => <CapDemo /> },

  { nr: "02b.1", title: "Persona (sammensat kriterie)", node: "4IA-0", render: () => (<Grid><PersonaDemo /><St label="Redigér i modal (dialog åben)"><PersonaModal /></St></Grid>), note: "Paper viser kun kortet; dialogen (07.1) er tegnet åben under som ekstra." },
  { nr: "02b.2", title: "Teknologi med / uden", node: "4IV-0", render: () => <TechOperatorDemo /> },
  { nr: "02b.3", title: "Til / fra-kontakt", node: "4JT-0", render: () => <ToggleDemo /> },
  { nr: "02b.4", title: "Sektionens brødtekst", node: "4KA-0", render: () => <SectionIntroDemo /> },
  { nr: "02b.5", title: "Info-ikon med forklaring", node: "4KF-0", render: () => <InfoDemo /> },
  { nr: "02b.6", title: "Påkrævet felt uden værdi", node: "4KR-0", render: () => <RequiredDemo /> },
  { nr: "02b.7", title: "Dropdown, åben", node: "4LZ-0", render: () => <DropdownOpen /> },
  { nr: "02b.8", title: "Segmenteret ja/nej", node: "4MS-0", render: () => <SegmentDemo /> },
  { nr: "02b.9", title: "Indsæt liste", node: "4NA-0", render: () => <PasteDemo /> },
  { nr: "02b.10", title: "Datovælger, åben", node: "4NS-0", render: () => <DateOpen /> },
  { nr: "02b.11", title: "Chips med antal", node: "4PD-0", render: () => <ChipsCountDemo /> },
  { nr: "02b.12", title: "Liste med antal", node: "4Q1-0", render: () => <ListCountDemo /> },
  { nr: "02b.13", title: "Direkte redigering (filtergruppe udfoldet)", node: "5G6-0", render: () => <DirectEdit />, note: "Fokuskanten er FieldRow active (ingen fokus i skærmbilledet); toasten er tegnet inline med ToastItem variant added." },
  { nr: "02b.14", title: "Gennemgående regler (felter)", node: "4JJ-0", render: () => <RulesDemo />, note: "Reglerne er ren tekst i Paper og tegnes som tekst." },

  { nr: "03.1", title: "Filterfelt, tilstande (i ro / i redigering / opdater)", node: "47B-0", render: () => <FieldStates /> },
  { nr: "03.2", title: "Teknologifelt (kontakt + dropdown + søg-og-vælg)", node: "6LR-0", render: () => <TechRow label="CMS" init={{ on: true, mode: "exclude", values: ["Umbraco"] }} pending /> },
  { nr: "03.3", title: "Teknologifelt, kontakt til (kun dropdown)", node: "6NM-0", render: () => <TechRow label="E-commerce" init={{ on: true, mode: "any", values: [] }} /> },
  { nr: "03.4", title: "Teknologifelt, kontakt fra", node: "6O1-0", render: () => <TechRow label="Live chat" init={{ on: false, mode: "any", values: [] }} /> },
];
