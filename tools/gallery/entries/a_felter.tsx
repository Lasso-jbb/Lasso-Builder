import { useState, type ReactNode } from "react";
import type { Operator } from "@lasso/spec";
import {
  AmountField,
  CATALOG_ICONS,
  ChoiceChips,
  DateField,
  DatePicker,
  DB07_EXCERPT,
  FieldRow,
  FieldSection,
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
  SegmentYesNo,
  SelectField,
  TagInput,
  TechnologyField,
  TechnologyRow,
  Toggle,
  ToastItem,
  Tooltip,
  UnitInput,
  XIcon,
  YesNoChips,
  type AmountFieldValue,
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

/** 01.1: én farveflise med navn 14/600, hex og brug (13 muted) under. */
function Tile({ v, name, hex, use, w, h }: { v: string; name: string; hex: string; use?: string; w: number; h: number }) {
  return (
    <div style={{ display: "grid", gap: 8, width: w, alignContent: "start" }}>
      <div style={{ height: h, borderRadius: "var(--lasso-radius-lg)", background: `var(${v})`, border: "1px solid var(--lasso-border)" }} />
      <div>
        <div style={{ fontSize: "var(--lasso-fs)", lineHeight: "var(--lasso-lh)", fontWeight: 600, color: "var(--lasso-text)" }}>{name}</div>
        <div className="lasso-small lasso-muted">{use ? `${hex}, ${use}` : hex}</div>
      </div>
    </div>
  );
}

// ---------- 01 Fundament ----------

const CORAL: [string, string, string, string][] = [
  ["--lasso-accent", "Koral", "primary, #FF6B35", "primær knap, aktiv"],
  ["--lasso-accent-soft", "Koral lys", "primary-soft, #FFF2EB", "valgt, fokus"],
  ["--lasso-accent-border", "Koral kant", "primary-border, #FFCFB6", ""],
  ["--lasso-accent-text", "Koral mørk", "primary-text, #B2450F", "tekst, flueben"],
];
const TEXTS: [string, string, string, string][] = [
  ["--lasso-text", "ink", "#16181D", "overskrift"],
  ["--lasso-text-2", "text", "#3F444B", "brødtekst"],
  ["--lasso-text-3", "text-secondary", "#5B6068", "ikoner"],
  ["--lasso-placeholder", "text-muted", "#8A9099", "hjælpetekst"],
  ["--lasso-icon", "icon", "#9AA0A8", "chevrons"],
  ["--lasso-faint", "text-faint", "#B9BEC5", "tællere"],
  ["--lasso-danger", "danger", "#D92D20", "fejl, slet"],
  ["--lasso-positive", "success", "#1F8A4C", "kvittering"],
];
const SURFACES: [string, string, string, string][] = [
  ["--lasso-surface", "surface", "#FFFFFF", ""],
  ["--lasso-surface-2", "surface-panel", "#FCFCFD", "højre panel"],
  ["--lasso-surface-muted", "surface-muted", "#F4F4F5", "tags, hover"],
  ["--lasso-chrome", "chrome", "#F1F2F4", "topbjælke"],
  ["--lasso-border-strong", "border", "#E4E4E7", "felter"],
  ["--lasso-border", "divider", "#E6E7EB", "områder"],
  ["--lasso-divider-subtle", "divider-subtle", "#F1F1F3", "rækker"],
  ["--lasso-overlay", "overlay", "#43464D", "bag dialog"],
];

function Colors() {
  const row = (list: [string, string, string, string][], w: number, h: number) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {list.map(([v, n, hex, use]) => (
        <Tile key={v} v={v} name={n} hex={hex} use={use} w={w} h={h} />
      ))}
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {row(CORAL, 256, 90)}
      {row(TEXTS, 120, 54)}
      {row(SURFACES, 120, 54)}
    </div>
  );
}

const TYPE_ROWS: { name: string; fs: string; lh: string; fw: string; extra?: React.CSSProperties; text: string }[] = [
  { name: "Display 32/40/700", fs: "--lasso-fs-display", lh: "--lasso-lh-display", fw: "700", text: "Beskriv det du leder efter" },
  { name: "Titel 24/32/600", fs: "--lasso-fs-xl", lh: "--lasso-lh-xl", fw: "var(--lasso-fw-semibold)", text: "Novo Nordisk Denmark A/S" },
  { name: "Sidetitel 18/24/600", fs: "--lasso-fs-lg", lh: "--lasso-lh-lg", fw: "var(--lasso-fw-semibold)", text: "Store IT-selskaber" },
  { name: "Feltnavn 14/18/600", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-semibold)", text: "Antal ansatte" },
  { name: "Knap/værdi 14/18/500", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-medium)", text: "er mindst" },
  { name: "Brødtekst 14/18/400", fs: "--lasso-fs", lh: "--lasso-lh", fw: "var(--lasso-fw-regular)", text: "Aarhus Datacenter A/S, Normal / aktiv, 62.01 Computerprogrammering" },
  { name: "Lille 13/18/400", fs: "--lasso-fs-sm", lh: "--lasso-lh-sm", fw: "var(--lasso-fw-regular)", extra: { color: "var(--lasso-muted)" }, text: "5 kriterier, 1 uden værdi, af 1.243.501 danske virksomheder" },
  { name: "Overlinje 11/14/600 +8 %", fs: "--lasso-fs-label", lh: "--lasso-lh-label", fw: "var(--lasso-fw-semibold)", extra: { letterSpacing: "var(--lasso-ls-label)", textTransform: "uppercase", color: "var(--lasso-muted)" }, text: "Eksempler" },
];

function Typography() {
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {TYPE_ROWS.map((r) => (
        <div key={r.name} style={{ display: "flex", flexWrap: "wrap", columnGap: 0, rowGap: 4, alignItems: "baseline", padding: "14px 0", borderBottom: "1px solid var(--lasso-border)" }}>
          <span className="lasso-small lasso-muted" style={{ flex: "0 0 205px" }}>{r.name}</span>
          <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: `var(${r.fs})`, lineHeight: `var(${r.lh})`, fontWeight: r.fw as never, color: "var(--lasso-text)", ...r.extra }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** 01.3: 8 koral kvadrater i stigende størrelse på en bundlinje, tallet under. */
function Spacing() {
  const steps = ["--lasso-space-1", "--lasso-space-2", "--lasso-space-3", "--lasso-space-4", "--lasso-space-row", "--lasso-space-5", "--lasso-space-7", "--lasso-space-10"];
  const px = ["4", "8", "12", "16", "20", "24", "28", "40"];
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "grid", justifyItems: "center", gap: 6 }}>
          <div style={{ width: `var(${s})`, height: `var(${s})`, background: "var(--lasso-accent)" }} />
          <span className="lasso-small lasso-muted">{px[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** 01.4: 5 kvadrater 60×60 med 1,5 px ink-kant: 6, 8, 10, 14 og rund. */
function Radii() {
  const r: [string, string][] = [
    ["--lasso-radius-xs", "6"],
    ["--lasso-radius", "8"],
    ["--lasso-radius-lg", "10"],
    ["--lasso-radius-xl", "14"],
    ["--lasso-radius-pill", "rund"],
  ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {r.map(([v, t]) => (
        <div key={v} style={{ display: "grid", gap: 8, justifyItems: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: `var(${v})`, border: "1.5px solid var(--lasso-text)", background: "var(--lasso-surface)" }} />
          <span className="lasso-small lasso-muted">{t}</span>
        </div>
      ))}
    </div>
  );
}

/** 01.5: menu (radius 10, blød skygge), dialog (radius 14, skygge) og fokus (1 px koral kant, radius 8), 66×50 uden tekst. */
function Shadows() {
  const box: React.CSSProperties = { width: 66, height: 50, background: "var(--lasso-surface)" };
  const items: [string, React.CSSProperties][] = [
    ["menu", { ...box, borderRadius: "var(--lasso-radius-lg)", boxShadow: "var(--lasso-shadow-pop)" }],
    ["dialog", { ...box, borderRadius: "var(--lasso-radius-xl)", boxShadow: "var(--lasso-shadow-pop)" }],
    ["fokus", { ...box, borderRadius: "var(--lasso-radius)", border: "1px solid var(--lasso-focus-border)" }],
  ];
  return (
    <div style={{ display: "flex", gap: 16, padding: "8px 8px 32px" }}>
      {items.map(([t, st]) => (
        <div key={t} style={{ display: "grid", gap: 10, justifyItems: "center" }}>
          <div style={st} />
          <span className="lasso-small lasso-muted">{t}</span>
        </div>
      ))}
    </div>
  );
}

const ICON_NAMES_PAPER = ["søg", "chevron", "videre", "valgt", "luk", "tilføj", "eksportér", "redigér", "flere", "info", "slet", "fortryd", "gemt", "liste", "oversigt", "sidepanel", "notifikation", "bruger", "AI", "virksomhed"];

/** 01.6: 20 ikoner i 2 × 10, 18 px ink, navne med små bogstaver. */
function Icons() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 92px)", gap: 10 }}>
      {CATALOG_ICONS.map((n, i) => (
        <div key={n} style={{ display: "grid", justifyItems: "center", alignContent: "center", gap: 8, height: 74, borderRadius: "var(--lasso-radius-lg)", background: "var(--lasso-surface-muted)", color: "var(--lasso-text)" }}>
          <Icon name={n} size={18} label={ICON_LABELS[n]} />
          <span className="lasso-small lasso-muted" style={{ fontSize: 11 }}>{ICON_NAMES_PAPER[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** 01.7: Papers faste regler for datavisning, nummereret i to kolonner. */
const DATA_RULES: string[] = [
  "Status er ren tekst i vægt 500: Aktiv i tekstfarve, Ophørt i grå, Under konkurs i mørk rød (#B42318), Under likvidation i warning-tekst. Ingen piller, prikker eller farvede baggrunde.",
  "Ingen dekorative piller: Positiv, Lav risiko, Ny og lignende skrives som tekst eller udelades. Tællere står kun i overskrifter og tekst, aldrig på faner. Kun filter-chips (valgbare) må have kant.",
  "Ingen ink (sort) baggrund på rækker eller flader. Bundlinjer i tabeller markeres med vægt 700 og en 1 px linje over, ikke fyld. Kun tooltips er ink.",
  "Ingen farvede bannerbokse. Sammenfatninger, risikonoter og AI-analyser er almindelige sektioner på hvid flade: overskrift, brødtekst, diskret kildelink. Et lille farvet ikon foran en tekstlinje er nok.",
  "\"Skrevet af AI\" eller lignende mærker vises ikke. Kilden angives i stedet i kildelinjen.",
  "Virksomheds- og personnavne står alene i lister og tabeller. Ingen grå ikonkasse med bygnings- eller personikon foran navnet.",
  "Nyhedskilder vises med sidens favicon som 16 px mærke (radius 3) foran kildenavnet. Ingen bogstavskasser.",
  "Mulig fejl i data: 14 px udråbstegn-ikon i warning-farve efter tallet, forklaring i tooltip ved mouseover. Ingen mærke, pille eller stiplet understregning.",
  "Separator i nøglefakta-, metadata- og kildelinjer er komma: \"CVR 34580820, A/S, København K\". Midterprik og lodret streg bruges aldrig, hverken i produktet eller i katalogets egne noter, overlinjer og specifikationer.",
  "Reglerne gælder uændret på tablet og mobil. Mobil kompakterer med label over værdi, aldrig med piller eller ikoner som erstatning for tekst.",
  "Faner viser kun navnet: ingen antal, badges eller prikker på sektionsfaner, segmentkontroller, sidepanelets sektioner eller bundnavigationen. Antal hører til i sektionens overskrift eller i teksten.",
  "Hvid flade overalt, også på tablet og mobil. Sektioner adskilles med 1 px linjer og luft, aldrig hvide kort på grå baggrund. Muted tekst er mindst #667085 (4,5:1); faint bruges kun til dekoration.",
  "Flere værdier end formen kan vise: vis de første 3 og \"Se N …\", som åbner et panel fra højre over siden (08 Kontaktpersoner). Gælder kontaktpersoner, telefonnumre, e-mails, P-enheder, bibrancher og ejere.",
  "Én grå til al hjælpetekst: metatekst, kildelinjer, feltforklaringer og overlinjer bruger samme token (text-muted = text-secondary, #5B6068). Den lysere grå (#8A9099) er kun til ikoner og dekoration, aldrig til tekst der skal læses, på desktop, tablet og mobil.",
  "Aktive elementer har aldrig mørkt fyld. Aktiv side i paginering = ink-tekst i vægt 600 med tynd understregning; aktive segmenter, chips og trin markeres med tekstvægt, tynd kant eller koral-soft, aldrig en sort kasse.",
  "Logo: kun de to mastere i 01b (ikon og navnelogo) i ink på hvid, klonet, aldrig tegnet som tekst eller farvet kasse. Navnelogo 18 px i fanebjælken, ikon 20 px i mobil-topbjælke og tabletskinne, 16 px som Lasso News-kilde, 28/14 px på rapportforside og i sidehoved/-fod.",
  "Nyheder: én kilde pr. nyhed (favicon 16 px, navn, tid), ingen billeder, ingen tone-mærker, ingen samlede historier eller favicon-stakke. Virksomhedsnavnet i uddraget står i fed (ink, 600), aldrig i koral eller på farvet baggrund.",
  "Korte ikon + værdi-lister (kontaktblok, genveje, maks 5 rækker) adskilles med luft, ikke skillelinjer. Linjer bruges kun i tabeller, nøgle-værdi-lister og lange lister.",
];

function DataRules({ split = 9 }: { split?: number }) {
  const col = (from: number, to: number) => (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14, alignContent: "start" }}>
      {DATA_RULES.slice(from, to).map((t, i) => (
        <li key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr", fontSize: "var(--lasso-fs-sm)", lineHeight: "var(--lasso-lh-body)", color: "var(--lasso-text-2)" }}>
          <span style={{ color: "var(--lasso-accent-text)", fontWeight: 600 }}>{from + i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px 56px" }}>
      {col(0, split)}
      {col(split, DATA_RULES.length)}
    </div>
  );
}

// ---------- 01b Logo ----------

function LogoMasters() {
  const card: React.CSSProperties = { display: "grid", placeItems: "center", height: 118, border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", color: "var(--lasso-text)" };
  const note: React.CSSProperties = { margin: 0, fontSize: "var(--lasso-fs-sm)", lineHeight: "var(--lasso-lh-body)", color: "var(--lasso-text-2)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 280px 180px minmax(200px, 1fr)", gap: 32, alignItems: "start" }}>
      <style>{".gal-mark{width:76px;height:auto}.gal-word{width:150px;height:auto}.gal-mark48{width:58px;height:48px;display:block}"}</style>
      <St label="Master, ikon">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <LassoMark className="gal-mark" />
          </div>
          <p style={note}>Viewbox 117×97, forhold 1,2:1. Ikon alene i topbjælke, skinne, favicon og hvor pladsen er under 100 px.</p>
        </div>
      </St>
      <St label="Master, navnelogo">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <LassoWordmark className="gal-word" />
          </div>
          <p style={note}>Viewbox 453×132, forhold 3,4:1. Navnelogo i fanebjælke (desktop), rapportforside, login og tomme tilstande.</p>
        </div>
      </St>
      <St label="Frizone">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ padding: 12, border: "1px dashed var(--lasso-accent-border)" }}>
              <LassoMark className="gal-mark48" />
            </div>
          </div>
          <p style={note}>Frizone = ¼ af logoets højde hele vejen rundt (ikon 48 px → 12 px). Intet andet element inden for zonen.</p>
        </div>
      </St>
      <St label="Brug">
        <p style={note}>{LOGO_USE}</p>
      </St>
    </div>
  );
}

const LOGO_USE =
  "Ikon 20 px i topbjælken og i tabletskinnen, 16 px som favicon og som Lasso News-kilde (radius 3, samme mønster som andre favicons). Navnelogo 18 px høj i fanebjælken og mobil-topbjælken, 28 px på rapportforsiden, 14 px i sidehoved/-fod på PDF. Aldrig i koral, aldrig på farvet flade, aldrig strakt, aldrig med skygge eller ramme. Minimum: ikon 12 px, navnelogo 12 px høj.";

function LogoSizes() {
  const mark: [number, string][] = [[16, "favicon, kilde"], [20, "topbjælke"], [24, "skinne"], [32, "tom tilstand"]];
  const word: [number, string][] = [[14, "PDF hoved/fod"], [18, "fanebjælke, mobil"], [28, "forside, login"]];
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

function FreeText() {
  const [op, setOp] = useState<Operator>("contains");
  const [v, setV] = useState("Byg");
  return (
    <FieldRow label="Firmanavn" onClear={noop}>
      <OperatorSelect value={op} operators={["contains", "starts_with", "eq", "neq"]} onChange={setOp} />
      <input className="lasso-input" value={v} onChange={(e) => setV(e.target.value)} aria-label="Firmanavn" />
    </FieldRow>
  );
}

function NumberDemo({ between = false }: { between?: boolean }) {
  const [op, setOp] = useState<Operator>(between ? "between" : "gte");
  const [vals, setVals] = useState<string[]>(between ? ["10", "49"] : ["10"]);
  return (
    <FieldRow label="Antal ansatte" onClear={noop}>
      <OperatorSelect value={op} operators={["eq", "gte", "lte", "gt", "lt", "between", "neq"]} onChange={setOp} />
      <RangeInputs operator={op} values={vals} placeholder="Antal" onChange={setVals} />
    </FieldRow>
  );
}

function AmountDemo({ openOp = false }: { openOp?: boolean }) {
  const [a, setA] = useState<AmountFieldValue>({ operator: "gte", values: ["5.000.000"] });
  const [c, setC] = useState<AmountFieldValue>({ operator: "gte", values: ["10"] });
  return (
    <Grid>
      {openOp ? (
        <St label="Operatoren åben (liste)">
          <div style={{ minHeight: 260 }}>
            <FieldRow label="Omsætning">
              <AmountField amount={{ operator: "gte", values: [""] }} change={{ operator: "gte", values: [""] }} operators={["gte", "lte", "between"]} onAmount={noop} onChange={noop} defaultOpenChange />
            </FieldRow>
          </div>
        </St>
      ) : null}
      <St label="Beløb (kr.) og % ændring">
        <FieldRow label="Omsætning" onClear={noop}>
          <AmountField amount={a} change={c} operators={["gte", "lte", "between"]} onAmount={setA} onChange={setC} />
        </FieldRow>
      </St>
      <St label="Ændring, de tre operatorer">
        <Grid gap={8}>
          {(["gte", "lte", "between"] as Operator[]).map((op) => (
            <FieldRow key={op} label="Bruttofortjeneste">
              <AmountField amount={{ operator: "gte", values: [""] }} change={{ operator: op, values: op === "between" ? ["5", "20"] : ["10"] }} operators={["gte", "lte", "between"]} onAmount={noop} onChange={noop} />
            </FieldRow>
          ))}
        </Grid>
      </St>
    </Grid>
  );
}

function PercentDemo() {
  const [op, setOp] = useState<Operator>("gte");
  const [vals, setVals] = useState<string[]>(["15"]);
  return (
    <FieldRow label="Soliditetsgrad" onClear={noop}>
      <OperatorSelect value={op} operators={["eq", "gte", "lte", "between"]} onChange={setOp} />
      <RangeInputs operator={op} values={vals} unit="%" placeholder="Procent" onChange={setVals} />
    </FieldRow>
  );
}

function DateDemo() {
  const [op, setOp] = useState<Operator>("after");
  const [vals, setVals] = useState<string[]>(["01.01.2020"]);
  const [op2, setOp2] = useState<Operator>("between");
  const [vals2, setVals2] = useState<string[]>(["01.01.2015", "31.12.2020"]);
  return (
    <Grid gap={8}>
      <St label="Efter den">
        <FieldRow label="Stiftelsesdato" onClear={noop}>
          <DateField operator={op} operators={["after", "before", "eq", "between"]} values={vals} onOperator={setOp} onChange={setVals} />
        </FieldRow>
      </St>
      <St label="Mellem (to datofelter)">
        <FieldRow label="Stiftelsesdato" onClear={noop}>
          <DateField operator={op2} operators={["after", "before", "eq", "between"]} values={vals2} onOperator={setOp2} onChange={setVals2} />
        </FieldRow>
      </St>
    </Grid>
  );
}

const FORMS = ["Aktieselskab", "Anpartsselskab", "Enkeltmandsvirksomhed", "Interessentskab", "Iværksætterselskab", "Andelsselskab", "Forening", "Fond"];

function SingleDemo() {
  const [op, setOp] = useState<Operator>("eq");
  const [v, setV] = useState<string>("Anpartsselskab");
  return (
    <FieldRow label="Virksomhedsform" onClear={noop}>
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
      <St label="Tags, feltet vokser i højden">
        <FieldRow label="Kommune" onClear={noop}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={v} suggestions={KOMMUNER} onChange={setV} />
        </FieldRow>
      </St>
      <St label="Tag i hvile og ved hover (kryds gråt / koralt)">
        <div style={{ display: "flex", gap: 12 }}>
          <span className="lasso-chip">
            Aarhus
            <button type="button" className="lasso-chip__remove" aria-label="Fjern Aarhus">
              <XIcon />
            </button>
          </span>
          <style>{".gal-hover.lasso-chip{background:var(--lasso-tag-hover)}.gal-hover .lasso-chip__remove{color:var(--lasso-accent)}"}</style>
          <span className="lasso-chip gal-hover">
            Odense
            <button type="button" className="lasso-chip__remove" aria-label="Fjern Odense">
              <XIcon />
            </button>
          </span>
        </div>
      </St>
      <St label="Tom = alle">
        <FieldRow label="Kommune">
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <TagInput values={[]} suggestions={KOMMUNER} onChange={noop} />
        </FieldRow>
      </St>
    </Grid>
  );
}

const REGIONER = ["Hovedstaden", "Sjælland", "Syddanmark", "Midtjylland", "Nordjylland"];

function ChipsDemo() {
  const [v, setV] = useState<string[]>(["Midtjylland", "Nordjylland"]);
  return (
    <FieldRow label="Region" onClear={noop}>
      <ChoiceChips options={REGIONER} values={v} onChange={setV} label="Region" />
    </FieldRow>
  );
}

function YesNoDemo() {
  const [a, setA] = useState<boolean | null>(true);
  return (
    <Grid gap={8}>
      <St label="Ja valgt">
        <FieldRow label="Reklamebeskyttet" info="Virksomheden har frabedt sig henvendelser med reklame." onClear={noop}>
          <YesNoChips value={a} onChange={setA} label="Reklamebeskyttet" />
        </FieldRow>
      </St>
      <St label="Intet valgt = tæller ikke med">
        <FieldRow label="Reklamebeskyttet" info="Virksomheden har frabedt sig henvendelser med reklame.">
          <YesNoChips value={null} onChange={noop} label="Reklamebeskyttet" />
        </FieldRow>
      </St>
    </Grid>
  );
}

const POSTNUMRE = ["2100 København Ø", "2200 København N", "8000 Aarhus C", "8200 Aarhus N", "5000 Odense C", "9000 Aalborg"];

function SearchListDemo() {
  const [v, setV] = useState<string[]>(["2100", "8000"]);
  return (
    <FieldRow label="Postnummer" onClear={noop}>
      <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
      <TagInput values={v} suggestions={POSTNUMRE} onChange={setV} />
    </FieldRow>
  );
}

function IndustryDemo() {
  const [v, setV] = useState<string[]>(["412000", "432100", "433200", "432200"]);
  return (
    <Grid gap={8}>
      <St label="Valgt: to navne og “og N flere”">
        <FieldRow label="Branche" onClear={noop}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <IndustryField tree={DB07_EXCERPT} values={v} onChange={setV} />
        </FieldRow>
      </St>
      <St label="Tomt">
        <FieldRow label="Branche">
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <IndustryField tree={DB07_EXCERPT} values={[]} onChange={noop} />
        </FieldRow>
      </St>
    </Grid>
  );
}

const TECH = ["Umbraco", "WordPress", "Shopify", "Magento", "Dynamicweb", "Sitecore", "Drupal", "Wix"];

function CapDemo() {
  const [v, setV] = useState<string[]>(["Umbraco", "WordPress"]);
  return (
    <Grid gap={8}>
      <St label="2 / 3">
        <FieldRow label="CMS" onClear={noop}>
          <TagInput values={v} max={3} suggestions={TECH} onChange={setV} />
        </FieldRow>
      </St>
      <St label="Loftet er nået (3 / 3)">
        <FieldRow label="CMS" onClear={noop}>
          <TagInput values={["Umbraco", "WordPress", "Shopify"]} max={3} suggestions={TECH} onChange={noop} />
        </FieldRow>
      </St>
    </Grid>
  );
}

// ---------- 02b Mønstre og tilstande ----------

const ROLES: Option[] = [
  { id: "ceo", label: "Direktør", count: 412 },
  { id: "cfo", label: "Økonomichef", count: 188 },
  { id: "sales", label: "Salgschef", count: 164 },
  { id: "it", label: "IT-chef", count: 97 },
  { id: "hr", label: "HR-chef", count: 76 },
];
const DEPTS: Option[] = [
  { id: "dir", label: "Direktion", count: 540 },
  { id: "oek", label: "Økonomi", count: 312 },
  { id: "salg", label: "Salg", count: 298 },
  { id: "it", label: "IT", count: 141 },
  { id: "hr", label: "HR", count: 118 },
  { id: "mark", label: "Marketing", count: 96 },
  { id: "prod", label: "Produktion", count: 87 },
  { id: "lager", label: "Lager og logistik", count: 54 },
];

function PersonaDemo() {
  const [v, setV] = useState<PersonaValue>({ roles: ["ceo", "cfo"], departments: ["dir", "oek", "salg"] });
  return (
    <Grid>
      <St label="Opsummering i feltet">
        <FieldRow label="Kontaktpersoner" onClear={noop}>
          <PersonaField value={v} onChange={setV} roles={ROLES} departments={DEPTS} />
        </FieldRow>
      </St>
    </Grid>
  );
}

function PersonaModal() {
  const [v, setV] = useState<PersonaValue>({ roles: ["ceo"], departments: ["dir"] });
  return (
    <div style={{ minHeight: 740 }}>
      <FieldRow label="Kontaktpersoner">
        <PersonaField value={v} onChange={setV} roles={ROLES} departments={DEPTS} defaultOpen countFor={(p) => Math.max(0, 1240 - p.roles.length * 310 - p.departments.length * 120)} />
      </FieldRow>
    </div>
  );
}

function TechOperatorDemo() {
  const [v, setV] = useState<TechValue>({ on: true, mode: "include", values: ["Shopify"] });
  const [w, setW] = useState<TechValue>({ on: true, mode: "exclude", values: ["WordPress", "Wix"] });
  return (
    <Grid gap={8}>
      <St label="Benytter">
        <FieldRow label="E-commerce" onClear={noop}>
          <TechnologyField label="E-commerce" variant="operator" value={v} onChange={setV} suggestions={TECH} />
        </FieldRow>
      </St>
      <St label="Benytter ikke">
        <FieldRow label="CMS" onClear={noop}>
          <TechnologyField label="CMS" variant="operator" value={w} onChange={setW} suggestions={TECH} />
        </FieldRow>
      </St>
    </Grid>
  );
}

function ToggleDemo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <Grid gap={8}>
      <St label="Til">
        <FieldRow label="Har hjemmeside" onClear={noop}>
          <Toggle on={a} onChange={setA} label="Har hjemmeside" />
        </FieldRow>
      </St>
      <St label="Fra = tæller ikke med">
        <FieldRow label="Har hjemmeside">
          <Toggle on={b} onChange={setB} label="Har hjemmeside" />
        </FieldRow>
      </St>
    </Grid>
  );
}

function SectionIntroDemo() {
  return (
    <FieldSection title="Økonomi" intro="Tallene er fra seneste offentliggjorte årsregnskab. Virksomheder i regnskabsklasse B skal ikke oplyse omsætning.">
      <NumberDemo />
      <PercentDemo />
    </FieldSection>
  );
}

function InfoDemo() {
  return (
    <Grid>
      <St label="Info-ikon i hvile">
        <FieldRow label="Bruttofortjeneste" info="Omsætning minus vareforbrug og andre eksterne omkostninger.">
          <OperatorSelect value="gte" operators={["gte", "lte"]} onChange={noop} />
          <UnitInput value="2.000.000" onChange={noop} unit="kr." />
        </FieldRow>
      </St>
      <St label="Forklaring vist (hover/fokus)">
        <div style={{ paddingTop: 56 }}>
          <div className="lasso-field lasso-field--inline" role="group">
            <div className="lasso-field__name">
              <span>Bruttofortjeneste</span>
              <Tooltip text="Omsætning minus vareforbrug og andre eksterne omkostninger." className="lasso-infotip" open>
                <button type="button" className="lasso-infotip__btn" aria-label="Om Bruttofortjeneste">
                  <Icon name="info" size={14} />
                </button>
              </Tooltip>
            </div>
            <div className="lasso-field__control">
              <OperatorSelect value="gte" operators={["gte", "lte"]} onChange={noop} />
              <UnitInput value="2.000.000" onChange={noop} unit="kr." />
            </div>
          </div>
        </div>
      </St>
    </Grid>
  );
}

function RequiredDemo() {
  return (
    <FieldRow label="Kommune" required error="Vælg mindst én kommune.">
      <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
      <TagInput values={[]} suggestions={KOMMUNER} invalid onChange={noop} />
    </FieldRow>
  );
}

function DropdownOpen() {
  const [v, setV] = useState<string[]>(["Midtjylland"]);
  return (
    <div style={{ minHeight: 580, maxWidth: 760 }}>
      <FieldRow label="Region">
        <MultiSelect options={[...REGIONER, "Grønland", "Færøerne", "Udlandet"]} values={v} onChange={setV} defaultOpen help="Vælg en eller flere. Tom = alle." label="Region" />
      </FieldRow>
    </div>
  );
}

function SegmentDemo() {
  const [v, setV] = useState<boolean | null>(null);
  const [w, setW] = useState<boolean | null>(true);
  return (
    <Grid gap={8}>
      <St label="Ingen betydning">
        <FieldRow label="Reklamebeskyttet">
          <SegmentYesNo value={v} onChange={setV} />
        </FieldRow>
      </St>
      <St label="Ja">
        <FieldRow label="Reklamebeskyttet">
          <SegmentYesNo value={w} onChange={setW} />
        </FieldRow>
      </St>
    </Grid>
  );
}

function PasteDemo() {
  const [v, setV] = useState<string[]>(["2100", "8000"]);
  return (
    <div style={{ maxWidth: 900 }}>
      <FieldRow label="Postnummer">
        <ListField values={v} onChange={setV} suggestions={POSTNUMRE} defaultPasteOpen />
      </FieldRow>
    </div>
  );
}

function DateOpen() {
  return (
    <Grid cols="repeat(auto-fit, minmax(320px, 1fr))" gap={40}>
      <St label="Datofelt med kalender åben">
        <div style={{ minHeight: 380 }}>
          <DateOpenField />
        </div>
      </St>
      <St label="Datovælgeren alene">
        <DatePicker value="2026-09-14" today={new Date(2026, 8, 29)} onSelect={noop} />
      </St>
    </Grid>
  );
}

function DateOpenField() {
  const [vals, setVals] = useState<string[]>(["14.09.2026"]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <DateField operator="after" operators={["after", "before", "eq", "between"]} values={vals} onOperator={noop} onChange={setVals} defaultOpen today={new Date(2026, 8, 29)} />
    </div>
  );
}

function ChipsCountDemo() {
  const [v, setV] = useState<string[]>(["ceo", "sales"]);
  return (
    <FieldRow label="Rolle">
      <ChoiceChips options={ROLES} values={v} onChange={setV} label="Rolle" />
    </FieldRow>
  );
}

function ListCountDemo() {
  const [v, setV] = useState<string[]>(["dir", "salg"]);
  const live = Math.max(0, 1240 - v.length * 310);
  return (
    <div style={{ minHeight: 580, maxWidth: 760 }}>
      <FieldRow label="Afdelinger">
        <MultiSelect options={DEPTS} values={v} onChange={setV} defaultOpen help={`${live.toLocaleString("da-DK")} kontaktpersoner matcher personaen.`} label="Afdelinger" />
      </FieldRow>
    </div>
  );
}

function DirectEdit() {
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>(["2100", "8000"]);
  return (
    <Grid>
      <St label="Aktivt, koral kant om inputtet, Ryd til højre">
        <FieldRow label="Postnummer" active onClear={noop}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <div className="gal-focus" style={{ flex: 1, display: "flex" }}>
            <TagInput values={a} suggestions={POSTNUMRE} onChange={setA} />
          </div>
        </FieldRow>
        <style>{".gal-focus .lasso-tagfield{border-color:var(--lasso-focus-border);flex:1;min-width:0}"}</style>
      </St>
      <St label="Taster, effekten under, Annuller / Tilføj">
        <FieldRow label="Postnummer" active pending={{ mode: "add", delta: -28910, onCancel: noop, onConfirm: noop }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <div className="gal-focus" style={{ flex: 1, display: "flex" }}>
            <TagInput values={b} suggestions={POSTNUMRE} onChange={setB} />
          </div>
        </FieldRow>
      </St>
      <St label="Tilføjet, besked nederst i midten">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ToastItem toast={{ id: 1, text: "Postnummer er tilføjet", tone: "ok", action: { label: "Se alle filtre", onClick: noop } }} />
        </div>
      </St>
    </Grid>
  );
}

function RulesDemo() {
  return (
    <FieldSection title="Firmaoplysninger" intro="Feltnavn over/til venstre (14/600), hjælpetekst under (13/400, grå), info-ikon i stedet for hjælpetekst.">
      <FieldRow label="Firmanavn" info="Søger i nuværende og tidligere navne." onClear={noop}>
        <OperatorSelect value="contains" operators={["contains", "starts_with", "eq", "neq"]} onChange={noop} />
        <input className="lasso-input" defaultValue="Byg" aria-label="Firmanavn" />
      </FieldRow>
      <FieldRow label="Region" onClear={noop}>
        <ChoiceChips options={REGIONER} values={["Midtjylland"]} onChange={noop} />
      </FieldRow>
      <FieldRow label="Omsætning" pending={{ mode: "update", delta: 4120, onCancel: noop, onConfirm: noop }}>
        <OperatorSelect value="gte" operators={["gte", "lte", "between"]} onChange={noop} />
        <UnitInput value="1.000.000" onChange={noop} unit="kr." />
      </FieldRow>
      <FieldRow label="Kommune" collapsible open={false} onToggle={noop}>
        <span />
      </FieldRow>
      <FieldRow label="Antal ansatte" error="Skriv et tal, fx 10.">
        <OperatorSelect value="gte" operators={["gte", "lte"]} onChange={noop} />
        <UnitInput value="ti" onChange={noop} invalid />
      </FieldRow>
    </FieldSection>
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
        <FieldRow label="Kommune" layout="stacked" collapsible open={open} onToggle={() => setOpen(!open)}>
          <span />
        </FieldRow>
      </St>
      <St label="2 I redigering">
        <FieldRow label="Postnummer" layout="stacked" collapsible open active onToggle={noop} pending={{ mode: "add", onCancel: noop, onConfirm: noop }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <div className="gal-focus" style={{ flex: 1, display: "flex" }}>
            <TagInput values={a} suggestions={POSTNUMRE} onChange={setA} defaultText="2100, 2200, 8000" />
          </div>
        </FieldRow>
        <style>{".gal-focus .lasso-tagfield{border-color:var(--lasso-focus-border);flex:1;min-width:0}"}</style>
      </St>
      <St label="Redigering af felt med eksisterende værdi">
        <FieldRow label="Kommune" active pending={{ mode: "update", delta: 4120, onCancel: noop, onConfirm: noop }}>
          <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
          <div className="gal-focus" style={{ flex: 1, display: "flex" }}>
            <TagInput values={b} suggestions={KOMMUNER} onChange={setB} />
          </div>
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
  { nr: "01.7", title: "Datavisning, faste regler", node: "GY5-0", note: "Reglerne tegnet som i Paper (nummereret, to kolonner).", render: () => <DataRules /> },
  { nr: "01b.1", title: "Logo, mastere (ikon, navnelogo, frizone, brug)", node: "IFD-0", render: () => <LogoMasters /> },
  { nr: "01b.2", title: "Logostørrelser", node: "IG6-0", render: () => <LogoSizes />, note: "Paper viser 8 eksempler (4 ikon, 3–4 navnelogo); her 4 + 3 størrelser tegnet med samme komponenter." },

  { nr: "02a.1", title: "Fritekst", node: "4BF-0", render: () => <FreeText /> },
  { nr: "02a.2", title: "Tal", node: "4BU-0", render: () => <NumberDemo /> },
  { nr: "02a.3", title: "Tal, mellem", node: "4CA-0", render: () => <NumberDemo between /> },
  { nr: "02a.4", title: "Beløb + ændring", node: "4SC-0", render: () => <AmountDemo openOp /> },
  { nr: "02a.5", title: "Procent", node: "4DE-0", render: () => <PercentDemo /> },
  { nr: "02a.6", title: "Dato", node: "4DT-0", render: () => <DateDemo /> },
  { nr: "02a.7", title: "Enkeltvalg", node: "4EC-0", render: () => <SingleDemo /> },
  { nr: "02a.8", title: "Multivalg (tags)", node: "4R0-0", render: () => <TagsDemo />, note: "Hover-tilstanden på krydset er tegnet med inline koral farve (kan ikke hovers statisk)." },
  { nr: "02a.9", title: "Chips", node: "4FH-0", render: () => <ChipsDemo /> },
  { nr: "02a.10", title: "Ja / Nej", node: "4G3-0", render: () => <YesNoDemo /> },
  { nr: "02a.11", title: "Søgbar liste", node: "4GO-0", render: () => <SearchListDemo /> },
  { nr: "02a.12", title: "Hierarki (brancher)", node: "4H6-0", render: () => <IndustryDemo /> },
  { nr: "02a.13", title: "Multivalg med loft", node: "4HR-0", render: () => <CapDemo /> },

  { nr: "02b.1", title: "Persona (sammensat kriterie)", node: "4IA-0", render: () => (<Grid><PersonaDemo /><St label="Redigér i modal (dialog åben)"><PersonaModal /></St></Grid>) },
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
  { nr: "02b.13", title: "Direkte redigering (filtergruppe udfoldet)", node: "5G6-0", render: () => <DirectEdit />, note: "Fokuskanten er sat statisk (ingen fokus i skærmbilledet); toasten er tegnet inline med ToastItem." },
  { nr: "02b.14", title: "Gennemgående regler (felter)", node: "4JJ-0", render: () => <RulesDemo />, note: "Reglerne er tekst i Paper; her vist som en sektion, der bruger dem (operator, 42 px felter, chips, Ryd, handlingslinje, sammenklappet, fejl)." },

  { nr: "03.1", title: "Filterfelt, tilstande (i ro / i redigering / opdater)", node: "47B-0", render: () => <FieldStates /> },
  { nr: "03.2", title: "Teknologifelt (kontakt + dropdown + søg-og-vælg)", node: "6LR-0", render: () => <TechRow label="CMS" init={{ on: true, mode: "exclude", values: ["Umbraco"] }} pending /> },
  { nr: "03.3", title: "Teknologifelt, kontakt til (kun dropdown)", node: "6NM-0", render: () => <TechRow label="E-commerce" init={{ on: true, mode: "any", values: [] }} /> },
  { nr: "03.4", title: "Teknologifelt, kontakt fra", node: "6O1-0", render: () => <TechRow label="Live chat" init={{ on: false, mode: "any", values: [] }} /> },
];
