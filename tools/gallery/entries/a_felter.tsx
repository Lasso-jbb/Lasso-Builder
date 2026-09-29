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
  TechnologyRow,
  ToggleField,
  ToastItem,
  Tooltip,
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
  ["--lasso-accent-soft", "Koral lys", "primary-soft, #FFF2EB", "valgt flade, fremhævet nævnelse"],
  ["--lasso-accent-border", "Koral kant", "primary-border, #FFCFB6", "fokuskant 1 px, valgte chips"],
  ["--lasso-accent-text", "Koral mørk", "primary-text, #B2450F", "tekst, flueben"],
];
const TEXTS: [string, string, string, string][] = [
  ["--lasso-text", "ink", "#16181D", "overskrift"],
  ["--lasso-text-2", "text", "#3F444B", "brødtekst"],
  ["--lasso-text-3", "text-secondary", "#5B6068", "hjælpetekst, metatekst, overlinjer"],
  ["--lasso-placeholder", "text-muted", "#8A9099", "ikoner, dekoration"],
  ["--lasso-icon", "icon", "#9AA0A8", "chevrons"],
  ["--lasso-faint", "text-faint", "#B9BEC5", "deaktiveret"],
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

/** 01.6: 20 ikoner i 2 × 10, 18 px ink alene på hvid flade (regel 20), navne med små bogstaver. */
function Icons() {
  return (
    <div className="gal-icons" style={{ display: "grid", rowGap: 32 }}>
      {/* Kontrol r5 (01.6 mobil): 10 kolonner på desktop som i Paper, 4 på mobil (ingen klipning) */}
      <style>{".gal-icons{grid-template-columns:repeat(10,102px)}@media (max-width:560px){.gal-icons{grid-template-columns:repeat(4,minmax(0,1fr))}}"}</style>
      {CATALOG_ICONS.map((n, i) => (
        <div key={n} style={{ display: "grid", justifyItems: "center", alignContent: "center", gap: 10, color: "var(--lasso-text)" }}>
          <Icon name={n} size={18} label={ICON_LABELS[n]} />
          <span className="lasso-small lasso-muted" style={{ fontSize: 12 }}>{ICON_NAMES_PAPER[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** 01.7: Papers faste regler for datavisning, nummereret i to kolonner. */
const DATA_RULES: string[] = [
  "Status er ren tekst i vægt 500: Aktiv i tekstfarve, Ophørt i grå, Under konkurs i mørk rød (#B42318), Under frivillig likvidation i warning-tekst. Ingen piller, prikker eller farvede baggrunde.",
  "Ingen dekorative piller: Positiv, Lav risiko, Ny og lignende skrives som tekst eller udelades. Tællere står kun i overskrifter og tekst, aldrig på faner. Kun filter-chips (valgbare) må have kant.",
  "Ingen ink (sort) baggrund på rækker eller flader. Bundlinjer i tabeller markeres med vægt 700 og en 1 px linje over, ikke fyld. Kun tooltips er ink.",
  "Ingen farvede bannerbokse. Sammenfatninger, risikonoter og AI-analyser er almindelige sektioner på hvid flade: overskrift og brødtekst, ingen kildelinje. Et lille farvet ikon foran en tekstlinje er nok.",
  "\"Skrevet af AI\" eller lignende mærker vises ikke, og der er ingen kildelinje (\"Kilde: …, opdateret …\") på elementerne; ingen \"Vis kilder (N)\" og ingen \"Kilder\" med link, heller ikke i Se alle-panelet (08.7). Nyhedens egen kilde (favicon, navn, tid) er ikke en kildelinje.",
  "Virksomheds- og personnavne står alene i lister, tabeller, hoveder, netværk, kontaktpersoner og diagrammer. Ingen ikonkasse og ingen rund initial-cirkel (\"JB\", \"?\") foran navnet. Person vs. selskab skelnes med tekst (rolle, \"Person\") og i diagrammet med form (pille / kasse); fratrådt og ukendt skrives som tekst, aldrig som stiplet cirkel.",
  "Nyhedskilder vises med sidens favicon som 16 px mærke (radius 3) foran kildenavnet. Ingen bogstavskasser.",
  "Mulig fejl i data: 14 px udråbstegn-ikon i warning-farve FORAN tallet, forklaring i tooltip ved mouseover. Ingen mærke, pille eller stiplet understregning.",
  "Separator i nøglefakta- og metadatalinjer er komma: \"CVR 34580820, A/S, København K\". Midterprik og lodret streg bruges aldrig, og tankestreg (—) erstattes af bindestreg (-) - hverken i produktet eller i katalogets egne noter, overlinjer og specifikationer (\"13/18, 400\").",
  "Reglerne gælder uændret på tablet og mobil. Mobil kompakterer med label over værdi, aldrig med piller eller ikoner som erstatning for tekst.",
  "Faner viser kun navnet: ingen antal, badges eller prikker på sektionsfaner, segmentkontroller, sidepanelets sektioner eller bundnavigationen. Antal hører til i sektionens overskrift eller i teksten.",
  "Hvid flade overalt, også på tablet og mobil. Sektioner adskilles med 1 px linjer og luft, aldrig hvide kort på grå baggrund.",
  "Flere værdier end formen kan vise: vis de første 3 og \"Se N …\", som åbner et panel fra højre over siden (08 Kontaktpersoner). Gælder kontaktpersoner, telefonnumre, e-mails, P-enheder, bibrancher og ejere.",
  "Én grå til al hjælpetekst: metatekst, feltforklaringer og overlinjer bruger samme token (--color-text-muted = --color-text-secondary, #5B6068). Den lysere grå (#8A9099) er kun til ikoner og dekoration, aldrig til tekst der skal læses - på desktop, tablet og mobil.",
  "Aktive elementer har aldrig mørkt fyld. Aktiv side i paginering = ink-tekst i vægt 600 med tynd understregning; aktive segmenter, chips og trin markeres med tekstvægt, tynd kant eller koral-soft, aldrig en sort kasse.",
  "Logo: kun de to mastere i 01b (ikon og navnelogo) i ink, klonet, aldrig tegnet som tekst eller farvet kasse. Logoet er diskret og står aldrig i topbjælken ved siden af entitetens navn: navnelogo 14 px dæmpet (55 %) som bundlinje nederst i sideskinnen på desktop og nederst på mobilskærme (uden kildelinje), ikon 24 px i tabletskinnen, 16 px som Lasso News-kilde, 28/14/12 px på rapportforside og i sidehoved/-fod (27).",
  "Nyheder: én kilde pr. nyhed (favicon 16 px, navn, tid), ingen billeder, ingen tone-mærker, ingen samlede historier eller favicon-stakke. Virksomhedsnavnet i uddraget står i fed (ink, 600), aldrig i koral eller på farvet baggrund.",
  "Korte ikon + værdi-lister (kontaktblok, genveje, maks 5 rækker) adskilles med luft, ikke skillelinjer. Linjer bruges kun i tabeller, nøgle-værdi-lister og lange lister.",
  "Risikoskalaen går fra 0 = lav risiko til 100 = høj risiko. Målere og skalaer har grøn til venstre/nederst (0–60), gul i midten (60–80) og rød til højre/øverst (80–100); en stigning i score er mere risiko og vises i warning- eller danger-tekst, aldrig grøn. Scoren er Lassos egen risikoscore; Creditsafe bruges ikke.",
  "Ikoner står alene på hvid flade: ingen grå eller farvede fliser, kasser eller cirkler bag et ikon (ikonsæt, tomme tilstande, rækker, app-ikoner, fokus). Baggrund og kant kun når ikonet er en ægte knap med tydelig funktion (ikonknap 38/32 med 1 px kant, genvej med kant).",
  "Handlinger i virksomheds- og personhoveder er små ikonknapper øverst til højre (32 px desktop, 40 px mobil, 1 px kant): Overvåg med koral ikon og koral kant, Gem, Eksportér/Netværk, Flere. Aldrig store fyldte knapper eller knapper i fuld bredde i hovedet; den primære handling er et lille koralt ikon, ikke en koral blok.",
];

function DataRules({ split = 9 }: { split?: number }) {
  const col = (from: number, to: number) => (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, alignContent: "start" }}>
      {DATA_RULES.slice(from, to).map((t, i) => (
        <li key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr", columnGap: 10, fontSize: "var(--lasso-fs)", lineHeight: "19px", color: "var(--lasso-text-2)" }}>
          <span style={{ color: "var(--lasso-accent)", fontWeight: 600, fontSize: 12 }}>{from + i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 460px))", gap: "10px 24px" }}>
      {col(0, split)}
      {col(split, DATA_RULES.length)}
    </div>
  );
}

// ---------- 01b Logo ----------

function LogoMasters() {
  const card: React.CSSProperties = { display: "grid", placeItems: "center", height: 120, border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", color: "var(--lasso-text)" };
  const note: React.CSSProperties = { margin: 0, fontSize: "var(--lasso-fs)", lineHeight: "19px", color: "var(--lasso-muted)" };
  return (
    <div className="gal-logos" style={{ display: "grid", gap: 32, alignItems: "start" }}>
      {/* Kontrol r5 (01b.1 mobil): fire kort i to kolonner på mobil (ingen klipning) */}
      <style>{".gal-logos{grid-template-columns:180px 280px 180px minmax(200px,1fr)}@media (max-width:560px){.gal-logos{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px!important}.gal-word{width:120px!important}}.gal-mark{width:76px;height:auto}.gal-word{width:150px;height:auto}.gal-mark48{width:58px;height:48px;display:block}"}</style>
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
        <p style={{ ...note, color: "var(--lasso-text-2)" }}>{LOGO_USE}</p>
      </St>
    </div>
  );
}

const LOGO_USE =
  "Diskret: navnelogo 14 px dæmpet (55 %) nederst i sideskinnen på desktop og nederst på mobilskærme, uden kildelinje. Aldrig i topbjælken ved siden af virksomheds- eller personnavnet. Ikon 24 px i tabletskinnen, 16 px som favicon og Lasso News-kilde. PDF: navnelogo 28 px på forsiden, 14 px i sidehovedet, ikon 12 px i sidefoden. Aldrig i koral, aldrig på farvet flade, aldrig strakt, aldrig med skygge eller ramme.";

function LogoSizes() {
  const mark: [number, string][] = [[16, "favicon, kilde"], [20, "app-ikon"], [24, "skinne"], [32, "tom tilstand"]];
  const word: [number, string][] = [[14, "bundlinje, PDF hoved"], [18, "login, tomme tilstande"], [28, "forside, login"]];
  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap", color: "var(--lasso-text)", padding: "16px 0", borderTop: "1px solid var(--lasso-border)", borderBottom: "1px solid var(--lasso-border)" }}>
      <style>{mark.map(([h]) => `.gal-m${h}{height:${h}px;width:${(h * 117) / 97}px;display:block}`).join("") + word.map(([h]) => `.gal-w${h}{height:${h}px;width:${(h * 453) / 132}px;display:block}`).join("")}</style>
      {mark.map(([h, t]) => (
        <div key={h} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <LassoMark className={`gal-m${h}`} />
          <span className="lasso-small lasso-muted" style={{ fontSize: 12 }}>{h}, {t}</span>
        </div>
      ))}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--lasso-border)" }} />
      {word.map(([h, t]) => (
        <div key={h} style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <LassoWordmark className={`gal-w${h}`} />
          <span className="lasso-small lasso-muted" style={{ fontSize: 12 }}>{h}, {t}</span>
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
  const [a, setA] = useState<AmountFieldValue>({ operator: "gte", values: ["10.000.000"] });
  const [c, setC] = useState<AmountFieldValue>({ operator: "gte", values: ["10"] });
  return (
    <Grid>
      <St label="Beløb (kr.) og % ændring">
        <FieldRow label="Omsætning" layout="form" help="Ingen overskrift: enheden skiller de to rækker. “kr.” er beløbet, “% ændring” er udviklingen. Begge kan bruges alene.">
          <AmountField amount={a} change={c} operators={["gte", "lte", "between"]} onAmount={setA} onChange={setC} />
        </FieldRow>
      </St>
      <St label="Ændring, de tre operatorer">
        <div className="lasso-amountfield">
          {(["gte", "lte", "between"] as Operator[]).map((op) => (
            <div key={op} className="lasso-amountfield__row lasso-amountfield__row--change">
              <OperatorSelect value={op} operators={CHANGE_OPERATORS} labels={CHANGE_LABELS} onChange={noop} />
              <RangeInputs operator={op} values={op === "between" ? ["10", "40"] : ["10"]} unit="% ændring" onChange={noop} />
            </div>
          ))}
        </div>
      </St>
      <St label="Operatoren åben">
        <div style={{ minHeight: 190 }}>
          <div className="lasso-amountfield">
            <div className="lasso-amountfield__row lasso-amountfield__row--change">
              <OperatorSelect value="gte" operators={CHANGE_OPERATORS} labels={CHANGE_LABELS} onChange={noop} defaultOpen />
              <RangeInputs operator="gte" values={["10"]} unit="% ændring" onChange={noop} />
            </div>
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
  const [op2, setOp2] = useState<Operator>("between");
  const [bad, setBad] = useState<string[]>(["01.01.2020", "31.12.2019"]);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <FieldRow label="Stiftelsesdato" layout="form" help="Operatorer: efter den, før den, præcis den, mellem (viser to datofelter)">
        <DateField operator={op} operators={["after", "before", "eq", "between"]} values={vals} onOperator={setOp} onChange={setVals} />
      </FieldRow>
      <FieldRow label="Mellem, fra og til" layout="form">
        <DateField operator={op2} operators={["after", "before", "eq", "between"]} values={bad} onOperator={setOp2} onChange={setBad} />
      </FieldRow>
    </div>
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

const STATUS_TAGS = ["Normal / aktiv", "Ophørt", "Under konkurs", "Under frivillig likvidation", "Tvangsopløst", "Slettet"];

function TagsDemo() {
  const [v, setV] = useState<string[]>(["Normal / aktiv", "Ophørt"]);
  const tag = (t: string, hover = false) => (
    <span className={`lasso-chip ${hover ? "gal-hover" : ""}`}>
      {t}
      <button type="button" className="lasso-chip__remove" aria-label={`Fjern ${t}`}>
        <XIcon />
      </button>
    </span>
  );
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <FieldRow label="Virksomhedsstatus" layout="form" help="Tom = alle. Feltet vokser i højden når tags ombrydes.">
        <OperatorSelect value="in" operators={["in", "not_in"]} onChange={noop} />
        <TagInput values={v} suggestions={STATUS_TAGS} onChange={setV} dropdown morePlaceholder="Tilføj flere…" />
      </FieldRow>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: "var(--lasso-fs-sm)", lineHeight: "18px", fontWeight: 600, color: "var(--lasso-text-2)" }}>Tagets tilstande</div>
        <style>{".gal-hover.lasso-chip{background:var(--lasso-tag-hover)}.gal-hover .lasso-chip__remove{color:var(--lasso-accent)}"}</style>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {tag("Normal / aktiv")}
          <span className="lasso-small lasso-muted" style={{ marginRight: 28 }}>Hvile</span>
          {tag("Normal / aktiv", true)}
          <span className="lasso-small lasso-muted">Markøren over krydset</span>
        </div>
        <p className="lasso-field__help" style={{ margin: 0 }}>
          Krydset er gråt i hvile - ellers står et felt med fem tags og skriger. Det bliver koralt når markøren rammer det, så man ved hvad man er ved at fjerne. Rød er forbeholdt det der ikke kan fortrydes.
        </p>
      </div>
    </div>
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
    <FieldRow label="Branchekode" layout="form" help="Ét felt, ingen løs knap. Feltet viser de valgte som tekst - to navne og “og N flere” - og hele feltet åbner træ-vælgeren. Tomt: “Vælg brancher”.">
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
  { id: "head", label: "Head of", count: 101468 },
  { id: "manager", label: "Manager", count: 100998 },
  { id: "partner", label: "Partner", count: 35617 },
  { id: "best", label: "Bestyrelse", count: 51071 },
];
const DEPTS: Option[] = [
  { id: "adm", label: "Administration", count: 20149 },
  { id: "adv", label: "Advokater", count: 18139 },
  { id: "best", label: "Bestyrelse", count: 88144 },
  { id: "dir", label: "Direktion", count: 41964 },
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

/**
 * 02b.2 (Jakob 29.09.2026, afstemt med 03.3/03.4): teknologier er grupperet i typer. Pr. type:
 * kontakten slår kriteriet til/fra; dropdown'en har tre valg: "Firmaer der benytter et <type>"
 * (kun typen, intet søgefelt), "Inkluder kun følgende" og "Ekskluder følgende" (tags + søg).
 */
function TechOperatorDemo() {
  // Paper (efter Jakob): ét eksempel, "Live chat" med kontakt og dropdown'en ÅBEN, så de tre valg ses.
  const [c, setC] = useState<TechValue>({ on: true, mode: "any", values: [] });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ minHeight: 200 }}>
        <TechnologyRow label="Live chat" value={c} onChange={setC} onClear={noop} suggestions={["Intercom", "Zendesk", "LiveChat"]} defaultOpen />
      </div>
      {/* Kontrol r5: de to andre valg med tags + "Søg efter flere…" vises også her (ikke kun i 03.2) */}
      <TechRow label="Live chat" init={{ on: true, mode: "include", values: ["Intercom", "Zendesk"] }} />
      <TechRow label="CMS" init={{ on: true, mode: "exclude", values: ["Umbraco"] }} />
    </div>
  );
}

function ToggleDemo() {
  const [a, setA] = useState(true);
  return <ToggleField label="Skal have direkte telefonnummer" on={a} onChange={setA} help="Er “Nej” meningsløst, brug en kontakt i stedet for chips. Slukket = filteret tæller ikke med." />;
}

function SectionIntroDemo() {
  return (
    <div>
      <SectionIntro>Find firmaer hvor du kan få telefonnummer og mailadresse direkte på de beslutningstagere du leder efter. Fx salgschefen, CTO’en eller den HR-ansvarlige.</SectionIntro>
      <div className="lasso-field__help">Kun på sektioner der har brug for en forklaring. Står øverst, før første felt.</div>
    </div>
  );
}

function InfoDemo() {
  return (
    <div style={{ minHeight: 90 }}>
      {/* Mobil: forklaringen står under feltnavnet i fuld bredde; rækken gøres høj nok til den */}
      <style>{"@media (max-width:560px){.gal-infodemo{min-height:0!important}.gal-infodemo+.lasso-field__helpline{margin-top:96px}}"}</style>
      <div className="lasso-field lasso-field--form" role="group">
        {/* Hover-tilstanden tegnet statisk som i Paper: rækken er så høj som boblen, så den står centreret på ikonet og hjælpeteksten under er fri. */}
        <div className="lasso-field__name gal-infodemo" style={{ minHeight: 80 }}>
          <span>Familiedrevet virksomhed</span>
          <Tooltip text="To eller flere direktions- og bestyrelsesmedlemmer med samme efternavn" className="lasso-infotip" placement="right" open>
            <button type="button" className="lasso-infotip__btn" aria-label="Om Familiedrevet virksomhed">
              <Icon name="info" size={14} />
            </button>
          </Tooltip>
        </div>
        <div className="lasso-field__help lasso-field__helpline">Erstatter underlinjen under feltnavnet, så forklaringen ikke fylder i listen når man ikke har brug for den.</div>
      </div>
    </div>
  );
}

function RequiredDemo() {
  const [v, setV] = useState("2100, 2200");
  return (
    <FieldRow label="Postnummer" layout="side" required active>
      <input className="lasso-input" style={{ width: 300, flex: "none" }} value={v} onChange={(e) => setV(e.target.value)} aria-label="Postnummer" />
    </FieldRow>
  );
}

const STATUSER = ["Ophørt", "Tvangsopløst", "Normal / aktiv", "Slettet"];

function DropdownOpen() {
  const [v, setV] = useState<string[]>(["Normal / aktiv"]);
  return (
    <div style={{ minHeight: 480, maxWidth: 520 }}>
      <FieldRow label="Status" layout="form">
        <MultiSelect options={STATUSER} values={v} onChange={setV} defaultOpen searchable help="Vælg en eller flere. Tom = alle." label="Status" />
      </FieldRow>
    </div>
  );
}

function SegmentDemo() {
  const [v, setV] = useState<boolean | null>(null);
  return (
    <FieldRow label="Har ejere" layout="form" help="Dev3 bruger denne. Variant 10 (to chips) er stadig anbefalingen - den fjerner en knap der ikke gør noget. Dokumenteret her, så valget er bevidst.">
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
  const [range, setRange] = useState<string[]>(["10.09.2026", ""]);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ minHeight: 360 }}>
        <FieldRow label="Stiftelsesdato" layout="form">
          <DateField operator="after" operators={["after", "before", "eq", "between"]} labels={{ after: "Efter", before: "Før", eq: "Præcis", between: "Mellem" }} placeholder="Vælg dato" values={vals} onOperator={noop} onChange={setVals} defaultOpen today={new Date(2026, 8, 4)} />
        </FieldRow>
      </div>
      <div>
        {/* Kontrol r5 (02b.10 mobil): på mobil står til-feltet under fra-feltet, så kalenderen skal have mere plads */}
        <style>{".gal-dateopen{min-height:340px}@media (max-width:560px){.gal-dateopen{min-height:420px}}"}</style>
        <div className="gal-dateopen">
          <FieldRow label="Stiftelsesdato, mellem (til-dato åben)" layout="form">
            <DateField operator="between" operators={["after", "before", "eq", "between"]} labels={{ after: "Efter", before: "Før", eq: "Præcis", between: "Mellem" }} placeholder="Vælg dato" values={range} onOperator={noop} onChange={setRange} defaultOpenTo today={new Date(2026, 8, 4)} />
          </FieldRow>
        </div>
        {/* Paper K4Q-0: noten står under kalenderen, så den åbne kalender ikke dækker den. */}
        <div className="lasso-field__help">Dagene før fra-datoen (10.09.2026) er deaktiverede i kalenderen.</div>
      </div>
    </div>
  );
}

function ChipsCountDemo() {
  const [v, setV] = useState<string[]>(["dir", "head"]);
  return (
    <FieldRow label="Rolle" layout="form" help="Tom = alle roller. Valgt chip får fuld koral kant, ikke kun blød flade - den skal kunne skelnes selv når fem står ved siden af hinanden.">
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
          allLabel="Alle afdelinger"
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
  "Påkrævet uden værdi: rød stjerne efter feltnavnet. Fejl: rød hjælpetekst under feltet - kanten forbliver neutral.",
  "Koral markerer valg, fokus og den ene primære handling - aldrig dekoration.",
  "Under seks faste værdier: chips (09). Ja/nej: segmenteret kontrol eller kontakt. Ellers: søgbar liste (11) eller dropdown.",
  "En valgt chip er koral lys med flueben. Et tag inde i et felt er neutralt med kryds, fordi alt i feltet allerede er valgt.",
  "Sammenklappet viser et felt sin værdi som rolig grå tekst til højre for navnet. Flere værdier: de to første nævnes, resten tælles - “Normal / aktiv, Ophørt og 3 flere”.",
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
        <FieldRow label="Kommune" layout="stacked" collapsible open={open} onToggle={() => setOpen(!open)}>
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
  { nr: "01.7", title: "Datavisning, faste regler", node: "GY5-0", note: "Reglerne tegnet som i Paper (nummereret, to kolonner).", render: () => <DataRules /> },
  { nr: "01b.1", title: "Logo, mastere (ikon, navnelogo, frizone, brug)", node: "IFD-0", render: () => <LogoMasters /> },
  { nr: "01b.2", title: "Logostørrelser", node: "IG6-0", render: () => <LogoSizes />, note: "Paper (live 29.09) har 7 størrelser: ikon 16/20/24/32 og navnelogo 14/18/28." },

  { nr: "02a.1", title: "Fritekst", node: "4BF-0", render: () => <FreeText /> },
  { nr: "02a.2", title: "Tal", node: "4BU-0", render: () => <NumberDemo /> },
  { nr: "02a.3", title: "Tal, mellem", node: "4CA-0", render: () => <NumberDemo between /> },
  { nr: "02a.4", title: "Beløb + ændring", node: "4SC-0", render: () => <AmountDemo /> },
  { nr: "02a.5", title: "Procent", node: "4DE-0", render: () => <PercentDemo /> },
  { nr: "02a.6", title: "Dato", node: "4DT-0", render: () => <DateDemo />, note: "Jakob 29.09.2026: \"mellem\" med fra-dato og til-dato; til-datoen kan ikke være før fra-datoen (afvises med fejltekst)." },
  { nr: "02a.7", title: "Enkeltvalg", node: "4EC-0", render: () => <SingleDemo /> },
  { nr: "02a.8", title: "Multivalg (tags)", node: "4R0-0", render: () => <TagsDemo />, note: "Hover-tilstanden på krydset er tegnet med inline koral farve (kan ikke hovers statisk)." },
  { nr: "02a.9", title: "Chips", node: "4FH-0", render: () => <ChipsDemo /> },
  { nr: "02a.10", title: "Ja / Nej", node: "4G3-0", render: () => <YesNoDemo /> },
  { nr: "02a.11", title: "Søgbar liste", node: "4GO-0", render: () => <SearchListDemo /> },
  { nr: "02a.12", title: "Hierarki (brancher)", node: "4H6-0", render: () => <IndustryDemo /> },
  { nr: "02a.13", title: "Multivalg med loft", node: "4HR-0", render: () => <CapDemo /> },

  { nr: "02b.1", title: "Persona (sammensat kriterie)", node: "4IA-0", render: () => <PersonaDemo /> },
  { nr: "02b.1", title: "Persona, redigér i dialog (separat tilstand)", node: "4IA-0", render: () => <PersonaModal />, note: "Separat tilstand: Redigér på kortet åbner dialogen (07.1) på overlay. Selve elementet (kortet + Tilføj persona) står i indgangen ovenfor." },
  { nr: "02b.2", title: "Teknologi med / uden", node: "4IV-0", render: () => <TechOperatorDemo />, note: "Jakob 29.09.2026 (afstemt med 03.3/03.4): teknologier grupperet i typer; dropdown med \"Firmaer der benytter et <type>\" (kun typen), \"Inkluder kun følgende\" og \"Ekskluder følgende\". Kontakten slår kriteriet til og fra." },
  { nr: "02b.3", title: "Til / fra-kontakt", node: "4JT-0", render: () => <ToggleDemo /> },
  { nr: "02b.4", title: "Sektionens brødtekst", node: "4KA-0", render: () => <SectionIntroDemo /> },
  { nr: "02b.5", title: "Info-ikon med forklaring", node: "4KF-0", render: () => <InfoDemo /> },
  { nr: "02b.6", title: "Påkrævet felt uden værdi", node: "4KR-0", render: () => <RequiredDemo /> },
  { nr: "02b.7", title: "Dropdown, åben", node: "4LZ-0", render: () => <DropdownOpen /> },
  { nr: "02b.8", title: "Segmenteret ja/nej", node: "4MS-0", render: () => <SegmentDemo /> },
  { nr: "02b.9", title: "Indsæt liste", node: "4NA-0", render: () => <PasteDemo /> },
  { nr: "02b.10", title: "Datovælger, åben", node: "4NS-0", render: () => <DateOpen />, note: "Jakob 29.09.2026: ved \"Mellem\" er dagene før fra-datoen deaktiverede i til-datoens kalender." },
  { nr: "02b.11", title: "Chips med antal", node: "4PD-0", render: () => <ChipsCountDemo /> },
  { nr: "02b.12", title: "Liste med antal", node: "4Q1-0", render: () => <ListCountDemo /> },
  { nr: "02b.13", title: "Direkte redigering (filtergruppe udfoldet)", node: "5G6-0", render: () => <DirectEdit />, note: "Fokuskanten er FieldRow active (ingen fokus i skærmbilledet); toasten er tegnet inline med ToastItem variant added." },
  { nr: "02b.14", title: "Gennemgående regler (felter)", node: "4JJ-0", render: () => <RulesDemo />, note: "Reglerne er ren tekst i Paper og tegnes som tekst." },

  { nr: "03.1", title: "Filterfelt, tilstande (i ro / i redigering / opdater)", node: "47B-0", render: () => <FieldStates /> },
  { nr: "03.2", title: "Teknologifelt (kontakt + dropdown + søg-og-vælg)", node: "6LR-0", render: () => <TechRow label="CMS" init={{ on: true, mode: "exclude", values: ["Umbraco"] }} pending /> },
  { nr: "03.3", title: "Teknologifelt, kontakt til (kun dropdown)", node: "6NM-0", render: () => <TechRow label="E-commerce" init={{ on: true, mode: "any", values: [] }} />, note: "Jakob 29.09.2026: kun typen = dropdown-valget \"Firmaer der benytter et E-commerce\" (ingen tekst foran, intet søgefelt); de to andre valg er Inkluder kun følgende / Ekskluder følgende." },
  { nr: "03.4", title: "Teknologifelt, kontakt fra", node: "6O1-0", render: () => <TechRow label="Live chat" init={{ on: false, mode: "any", values: [] }} />, note: "Kontakt fra = kriteriet er slået fra; kun kontakten vises. Slås den til, står dropdown'en med \"Firmaer der benytter et Live chat\"." },
];
