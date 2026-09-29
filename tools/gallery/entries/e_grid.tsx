// 23.1–23.3 Gridmodellen (Paper KA2-0, KA5-0, L26-0): bånd og stakke på 12 kolonner.
// Skitserne tegnes af koden: packBands (packages/spec/src/grid.ts) pakker Papers eksempelsider med de
// målte højder (MEASURED_HEIGHTS = scratchpad/measure/heights.json), og elementtabellen læses af
// GRID_RULES i catalog.ts. Så viser galleriet det, motoren faktisk gør.
import type { CSSProperties, ReactNode } from "react";
import {
  BAND_COMBOS,
  COMPONENT_CATALOG,
  composeCompany,
  GRID_BEHAVIOR_LABEL,
  GRID_FLEX_LABEL,
  GRID_HEIGHT_LABEL,
  GRID_RULES,
  GRID_WIDTH_LABEL,
  gridRuleOf,
  mainMetric,
  measuredHeight,
  packBands,
  WIDTH_COLUMNS,
  WIDTHS,
  type ComponentType,
  type Dataset,
  type PackedBand,
  type ViewComponent,
  type Width,
} from "@lasso/spec";
import { LassoView, type HostCapabilities } from "@lasso/ui";
import { DocTable, overline, type Col } from "./e_guide.js";

/* ---------- Byggesten (kun tokens) ---------- */

const note: CSSProperties = { margin: 0, fontSize: 12, lineHeight: "17px", color: "var(--lasso-muted)" };
const body: CSSProperties = { margin: 0, fontSize: "var(--lasso-fs)", lineHeight: "20px", color: "var(--lasso-text-2)" };
const h3: CSSProperties = { margin: 0, fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--lasso-text)" };
const card: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "var(--lasso-surface)", minWidth: 0 };
const two: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 32, alignItems: "start" };
const col = (gap = 12): CSSProperties => ({ display: "flex", flexDirection: "column", gap, minWidth: 0 });

function Title({ nr, text, intro }: { nr: string; text: string; intro: string }) {
  return (
    <div style={col(8)}>
      <div style={overline}>{`${nr}, ${text}`}</div>
      <p style={{ ...body, maxWidth: 900 }}>{intro}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--lasso-divider-subtle)" }}>
      <span
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1px solid var(--lasso-border)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--lasso-text)",
        }}
      >
        {n}
      </span>
      <div style={col(2)}>
        <div style={{ fontSize: "var(--lasso-fs)", fontWeight: 600, color: "var(--lasso-text)", lineHeight: "20px" }}>{title}</div>
        <div style={{ ...body, fontSize: 13, lineHeight: "19px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ---------- Skitse af bånd og stakke (tegnet ud fra packBands) ---------- */

const TITLE: Partial<Record<ComponentType, string>> = Object.fromEntries(COMPONENT_CATALOG.map((c) => [c.type, c.title]));
const SHORT: Partial<Record<ComponentType, string>> = {
  LassoCompanyHead: "Hoved",
  LassoKeyFigureCards: "Nøgletalskort",
  LassoTextSections: "Profil",
  LassoKeyValueList: "Oplysninger",
  LassoRelations: "Relationer",
  LassoBarChart: "Søjlegraf",
  LassoGroupedBarChart: "Grupperet graf",
  LassoWaterfallChart: "Vandfald",
  LassoContact: "Kontakt",
  LassoTimeline: "Historik",
  LassoNews: "Nyheder",
  LassoShortcuts: "Genveje",
  LassoShareBars: "Andelsbjælker",
  LassoMultiYearTable: "Flerårstabel",
  LassoOwnershipDiagram: "Ejerdiagram",
  LassoOwnerList: "Ejerliste",
  LassoBeneficialOwners: "Reelle ejere",
  LassoPersonList: "Ledelse",
};
function label(c: ViewComponent): string {
  if (c.type === "LassoKeyValueList" && c.variant === "financials") return "Regnskabsliste";
  if (c.type === "LassoTextSections" && c.variant === "analyse") return "Regnskabsanalyse";
  const lim = (c as { limit?: number }).limit;
  const base = SHORT[c.type] ?? TITLE[c.type] ?? c.type;
  return lim && (c.type === "LassoTimeline" || c.type === "LassoNews") ? `${base} (${lim})` : base;
}

/** Højder som i gridmodel.md afsnit 5: målt højde, tidslinje 88 og nyheder 48 px pr. række under 5. */
const ROW_PX: Partial<Record<ComponentType, number>> = { LassoTimeline: 88, LassoNews: 48 };
export function docHeight(c: ViewComponent, w: Width): number {
  const base = measuredHeight(c, w);
  const lim = (c as { limit?: number }).limit;
  const row = ROW_PX[c.type];
  return lim && row ? base - row * (5 - lim) : base;
}

function itemStyle(c: ViewComponent, fill: boolean): CSSProperties {
  const r = gridRuleOf(c);
  const flex = Boolean(r.flex);
  return {
    flex: fill ? "1 0 auto" : "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 4,
    borderRadius: 6,
    fontSize: 10,
    lineHeight: "13px",
    fontWeight: 600,
    color: flex ? "var(--lasso-positive)" : "var(--lasso-text-2)",
    background: flex ? "var(--lasso-positive-soft)" : r.behavior === "fixed" ? "var(--lasso-surface-muted)" : "var(--lasso-surface)",
    border: `1px ${r.behavior === "fixed" && !flex ? "solid" : "dashed"} ${flex ? "var(--lasso-positive)" : "var(--lasso-border-strong)"}`,
    boxSizing: "border-box",
  };
}

/** Et bånd som skitse: stakkene i deres kolonnebredde, elementerne i målt højde / skala, sidste element strakt. */
function BandSketch({ bands, width, scale, h = docHeight }: { bands: readonly PackedBand[]; width: number; scale: number; h?: (c: ViewComponent, w: Width) => number }) {
  const gap = 24 / scale;
  const colW = (cols: number) => ((width - 11 * gap) / 12) * cols + gap * (cols - 1);
  return (
    <div style={{ ...col(gap), width, padding: 8, border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", background: "var(--lasso-surface)", boxSizing: "content-box" }}>
      {bands.map((b, i) => (
        <div key={i} style={{ display: "flex", gap, alignItems: "stretch", minHeight: b.height / scale }}>
          {b.stacks.map((s, k) => (
            <div key={k} style={{ ...col(gap), width: colW(WIDTH_COLUMNS[s.width]), flex: "none" }}>
              {s.items.map((c, j) => (
                <div key={j} style={{ ...itemStyle(c, j === s.items.length - 1), minHeight: h(c, s.width) / scale }}>
                  {`${label(c)} ${h(c, s.width)}`}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function bandText(b: PackedBand, i: number, h: (c: ViewComponent, w: Width) => number = docHeight): string {
  if (b.stacks.length === 1) return `B${i + 1} fuld: ${b.stacks[0]!.items.map((c) => `${label(c)} ${h(c, "full")}`).join(" + ")}`;
  const combo = b.stacks.map((s) => WIDTH_COLUMNS[s.width]).join("+");
  const stacks = b.stacks.map((s) => s.items.map((c) => `${label(c)} ${h(c, s.width)}`).join(" + ") + (s.items.length > 1 ? ` = ${s.height}` : "")).join(" | ");
  return `B${i + 1} ${combo}: ${stacks} → bånd ${b.height}, afvigelse ${Math.round(b.deviation * 100)} %`;
}

/* ---------- Papers eksempelsider (gridmodel.md afsnit 5) ---------- */

const X = "CVR-1-99000001";
const c = (type: string, extra: Record<string, unknown> = {}) => ({ type, company: X, ...extra }) as ViewComponent;
export const DOC_PAGES: Record<"overblik" | "oekonomi" | "ejerskab", { title: string; items: ViewComponent[] }> = {
  overblik: {
    title: "Overblik (default-siden, 23.3)",
    items: [
      c("LassoCompanyHead"),
      c("LassoKeyFigureCards"),
      c("LassoTextSections", { variant: "profil" }),
      c("LassoKeyValueList", { variant: "company" }),
      c("LassoRelations"),
      c("LassoBarChart", { metric: "omsaetning", years: 5 }),
      c("LassoContact"),
      c("LassoTimeline", { limit: 3 }),
      c("LassoNews", { limit: 3 }),
      c("LassoShortcuts"),
    ],
  },
  oekonomi: {
    title: "Økonomi",
    items: [
      c("LassoCompanyHead"),
      c("LassoKeyFigureCards"),
      c("LassoGroupedBarChart", { metrics: ["omsaetning", "resultat"], years: 5 }),
      c("LassoWaterfallChart"),
      c("LassoKeyValueList", { variant: "financials" }),
      c("LassoShareBars"),
      c("LassoMultiYearTable"),
      c("LassoTextSections", { variant: "analyse", width: "full" }),
    ],
  },
  ejerskab: {
    title: "Ejerskab",
    items: [
      c("LassoCompanyHead"),
      c("LassoOwnershipDiagram"),
      c("LassoOwnerList"),
      c("LassoBeneficialOwners"),
      c("LassoPersonList"),
      c("LassoTimeline", { limit: 3 }),
      c("LassoContact"),
      c("LassoShortcuts"),
    ],
  },
};

function Verification({ page, width }: { page: keyof typeof DOC_PAGES; width: number }) {
  const bands = packBands(DOC_PAGES[page].items, docHeight);
  const total = bands.reduce((s, b) => s + b.height, 0) + (bands.length - 1) * 24;
  const max = Math.max(...bands.map((b) => b.deviation));
  return (
    <div style={col(8)}>
      <div style={h3}>{DOC_PAGES[page].title}</div>
      <BandSketch bands={bands} width={width} scale={3} />
      <div style={{ ...note, color: "var(--lasso-text-2)", fontWeight: 600 }}>Beregning (px, gap 24)</div>
      {bands.map((b, i) => (
        <p key={i} style={note}>
          {bandText(b, i)}
        </p>
      ))}
      <p style={note}>{`Side: ${total} px. Huller: 0. Maks. afvigelse ${Math.round(max * 100)} %.`}</p>
    </div>
  );
}

/* ---------- 23.1 Gridmodel ---------- */

function GridColumns() {
  const W = 540;
  const gap = 8;
  const colW = (W - 11 * gap) / 12;
  return (
    <div style={{ ...card, gap: 8 }}>
      <div style={{ display: "flex", gap }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ width: colW, height: 10, borderRadius: 3, background: "var(--lasso-accent-soft)" }} />
        ))}
      </div>
      {WIDTHS.map((w) => {
        const n = WIDTH_COLUMNS[w];
        return (
          <div key={w} style={{ width: colW * n + gap * (n - 1), height: 20, borderRadius: 4, border: "1px solid var(--lasso-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "var(--lasso-text-2)" }}>
            {`${GRID_WIDTH_LABEL[w]} = ${n} kolonner, ${n * 74 + (n - 1) * 24} px`}
          </div>
        );
      })}
      <p style={note}>Skala 1:2. Indhold 1152 px ved 1200, kolonne 74 px, gutter 24 px. Lodret afstand 24 px. Kolonnerne skaleres med bredden (portalen uden panel: 1148).</p>
    </div>
  );
}

const CLASS_ROWS: { cls: keyof typeof GRID_HEIGHT_LABEL; range: string; h: number }[] = [
  { cls: "low", range: "≤ 176 px (22 u)", h: 40 },
  { cls: "medium", range: "177–320 px", h: 70 },
  { cls: "high", range: "321–640 px", h: 120 },
  { cls: "very-high", range: "> 640 px", h: 160 },
];

function HeightClasses() {
  const members = (cls: string) =>
    (Object.keys(GRID_RULES) as ComponentType[])
      .filter((t) => GRID_RULES[t].height === cls && MEASURED_KEYS.has(t))
      .map((t) => `${SHORT[t] ?? TITLE[t] ?? t} ${measuredHeight({ type: t } as ViewComponent, GRID_RULES[t].std)}`)
      .join(", ");
  return (
    <div style={col(12)}>
      <div style={{ ...card, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        {CLASS_ROWS.map((r) => (
          <div key={r.cls} style={{ ...col(6), flex: "1 1 0", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: "80%", height: r.h, border: "1px dashed var(--lasso-border-strong)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--lasso-text-2)" }}>{r.range}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--lasso-text)" }}>{GRID_HEIGHT_LABEL[r.cls][0]!.toUpperCase() + GRID_HEIGHT_LABEL[r.cls].slice(1)}</div>
            <p style={{ ...note, fontSize: 10, lineHeight: "13px" }}>{members(r.cls)}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {[
          { t: "Fast", s: itemStyle(c("LassoContact"), false), d: "Elementet bestemmer højden, ikke data: hoved, nøgletalskort, grafer, målere, kontakt, andelsbjælker." },
          { t: "Voksende", s: itemStyle(c("LassoRelations"), false), d: "Data bestemmer højden med et loft (limit, rows, 8 rækker) og 'Se alle' under: lister, tidslinje, feed, tabeller, regnskaber, tekst." },
          { t: "Flex", s: itemStyle(c("LassoTimeline"), false), d: "Kan fylde restplads i sin stak: rækker (flere rækker op til loftet), linjer (tekst klippes senere), plot (højere tegneareal, højst +25 %). Uden flex strækkes kun rammen." },
        ].map((x) => (
          <div key={x.t} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...x.s, flex: "none", width: 28, height: 16, padding: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--lasso-text)" }}>{x.t}</span>
            </div>
            <p style={note}>{x.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MEASURED_KEYS = new Set<string>([
  "LassoCompanyHead", "LassoKeyFigureCards", "LassoKeyValueList", "LassoContact", "LassoContactPersons", "LassoShortcuts", "LassoTextSections", "LassoTimeline", "LassoNews",
  "LassoBarChart", "LassoShareBars", "LassoKeyFigureGauge", "LassoMultiYearTable", "LassoIncomeStatement", "LassoBalanceSheet", "LassoCashFlow", "LassoFinancialStatements",
  "LassoPersonList", "LassoOwnerList", "LassoBeneficialOwners", "LassoOwnershipDiagram", "LassoRelations", "LassoRiskObservations", "LassoScoreGauge", "LassoProductionUnits",
  "LassoProperties", "LassoMap", "LassoRegistration", "LassoAnnouncements", "LassoPersonStats", "LassoPersonRoles", "LassoPersonNetwork", "LassoPersonRisk", "LassoPersonFacts",
  "LassoChangeFeed", "LassoHeatmap",
]);

function StructureExample() {
  const bands = packBands(DOC_PAGES.ejerskab.items.slice(0, 5), docHeight);
  const split = bands[1]!;
  return (
    <div style={{ ...card, gap: 10 }}>
      <div style={{ ...overline, color: "var(--lasso-accent-text)" }}>Bånd 1, fuld (12)</div>
      <BandSketch bands={bands.slice(0, 1)} width={300} scale={2.5} />
      <div style={{ ...overline, color: "var(--lasso-accent-text)" }}>{`Bånd 2, delt (${split.stacks.map((s) => WIDTH_COLUMNS[s.width]).join(" + ")})`}</div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "none" }}>
          <BandSketch bands={[split]} width={300} scale={2.5} />
        </div>
        <div style={{ ...col(8), flex: "1 1 0" }}>
          <p style={note}>{`Stak B (⅓) = ${split.stacks[1]!.items.map((x) => docHeight(x, "third")).join(" + ")} + ${split.stacks[1]!.items.length - 1} × 24 = ${split.stacks[1]!.height}`}</p>
          <p style={note}>{`Båndhøjde = højeste stak = ${split.height}`}</p>
          <p style={note}>{`Afvigelse = (${split.height} − ${Math.min(...split.stacks.map((s) => s.height))}) / ${split.height} = ${Math.round(split.deviation * 100)} % ≤ 15 %`}</p>
          <p style={note}>Flex: ankerets plot fylder resten, så begge stakke ender ved båndets bund.</p>
        </div>
      </div>
      <p style={note}>
        Bånd = vandret række, altid 12 kolonner, 1–4 stakke. Stak = elementer under hinanden i samme bredde, gap 24. CSS (LassoView): bånd = grid med bredderne som fr, stak = flex-kolonne med
        align-items stretch; sidste element i stakken får flex 1, så rammerne altid når båndets bund.
      </p>
    </div>
  );
}

const ALGO: { t: string; d: string }[] = [
  { t: "Input i prioriteret rækkefølge", d: "Svar-elementet først, dernæst kontekst efter relevans. Højden h(type, bredde, rækker) slås op i tabellen (23.2) og rettes efter datas omfang (compose.ts gridHeight)." },
  { t: "Fuldbånd", d: "Hoved, nøgletalskort/persontal, opfølgning og alle elementer med minimum 1/1 (fuldt regnskab, virksomhedstabel, persontabel) får hvert sit fuldbånd i rækkefølgen." },
  { t: "Anker og restbredde", d: "Det første element i restlisten er anker i sin standardbredde; H = h(anker). Hver lovlig kombination med ankerets bredde fyldes: hver ledig stak tager den første delmængde af restlisten (i prioritet), der tillader stakkens bredde og lander mellem 0,85 × H og H / 0,85." },
  { t: "Vælg kombinationen", d: "Afvigelse ≤ 15 % først, så færrest kolonner uden for standardbredderne, lavest afvigelse, færrest stakke, flest elementer brugt og rækkefølgen tættest på prioriteten. Kan det første element ikke bære et bånd, bliver det næste høje element (højst 3 frem) anker, og det første stables ved siden af." },
  { t: "Gentag, afslut, fold", d: "Næste bånd starter med det næste element i restlisten. Sidste bånd er opfølgning (fuld). Under 1200 bliver 9+3 og 8+4 til 12+12, 4+4+4 til 6+6+12, 6+6 holder til 768; mobil er én kolonne. Rækkefølgen ændres aldrig, kun foldningen." },
];

const RULES: { t: string; d: string; bands: PackedBand[] }[] = (() => {
  const s = (items: ViewComponent[]) => packBands(items, docHeight);
  return [
    { t: "(a) Høje elementer står sammen", d: "Er det næste element også højt og tillader samme bredde, lægges de 6+6. To høje i samme bånd er billigere end en høj mod tre lave.", bands: s([c("LassoTextSections"), c("LassoKeyValueList")]) },
    { t: "(b) Lave stables ved siden af et højt", d: "Stakken fyldes med de næste elementer, der tillader bredden, til den er ≥ 0,85 × H. Uden genveje: 37 %.", bands: s([c("LassoTimeline", { limit: 3 }), c("LassoNews", { limit: 3 }), c("LassoShortcuts")]) },
    { t: "(c) Flex-elementer fylder resten", d: "Den korteste stak strækkes: dens sidste element fylder resten (flere rækker, tekst klippes senere, højere plot); ellers strækkes rammen. Efter flex er afvigelsen 0 %.", bands: s([c("LassoRelations"), c("LassoBarChart"), c("LassoContact")]) },
    { t: "(d) Aldrig et halvt element alene", d: "Kan restbredden ikke fyldes, udvides ankeret til 1/1 (hvis tilladt); ellers lægges ankeret som stakfyld i den korteste stak i forrige bånd.", bands: s([c("LassoBarChart")]) },
  ];
})();

export function GridModel() {
  return (
    <div style={col(32)}>
      <Title
        nr="23.1"
        text="Trin 1, Gridmodel – bånd og stakke på 12 kolonner"
        intro="Elementerne placeres efter formål og behov: nogle er høje, nogle lave, nogle fulde, andre halve, en tredjedel eller to tredjedele. Base-layoutet pakker dem selv ud fra elementets egenskaber (bredde, højdeklasse, fast/voksende/flex), så modulet altid er helt fyldt uden huller, og stakkene i hvert bånd er omtrent lige høje. Skitserne nedenfor er tegnet af koden (packBands) med de målte højder."
      />
      <div style={two}>
        <div style={col(12)}>
          <div style={h3}>A. Gitteret: 12 kolonner, seks tilladte bredder</div>
          <GridColumns />
          <p style={body}>
            {`Lovlige kombinationer i ét bånd (summen er altid 12): ${BAND_COMBOS.map((x) => x.join("+")).join(" | ")}. Ulovlige: 2/3 + 1/4 (11) og 3/4 + 1/3 (13). Minimumsbredder er hårde: smalle bredder gør tekst, nøgle-værdi-lister og tabeller 30–100 % højere (nøgle-værdi-liste 924 px i 1/3 mod 662 i 1/2; registrering 1153 i 1/4 mod 420 i 1/1).`}
          </p>
        </div>
        <div style={col(12)}>
          <div style={h3}>B. Højdeenhed 8 px, fire højdeklasser og tre adfærd</div>
          <HeightClasses />
        </div>
      </div>
      <div style={two}>
        <div style={col(12)}>
          <div style={h3}>C. Bånd og stakke: sådan hænger et modul sammen</div>
          <StructureExample />
        </div>
        <div style={col(4)}>
          <div style={h3}>D. Pakkealgoritmen: deterministisk, samme input giver samme side</div>
          {ALGO.map((a, i) => (
            <Step key={a.t} n={i + 1} title={a.t}>
              {a.d}
            </Step>
          ))}
        </div>
      </div>
      <div style={col(12)}>
        <div style={h3}>E. Fire udligningsregler, i den rækkefølge de prøves</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {RULES.map((r) => (
            <div key={r.t} style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lasso-text)" }}>{r.t}</div>
              <BandSketch bands={r.bands} width={230} scale={4.5} />
              <p style={note}>{r.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={col(12)}>
        <div style={h3}>F. Verifikation: tre sider pakket af motoren med de målte højder (skala 1:3, gap 24 = 8)</div>
        <p style={note}>Grå = fast, stiplet = voksende, grøn = flex (kan fylde rest). Tallet er den målte højde i px i den bredde. Alle bånd er fulde i bredden (summen = 12), og afvigelsen mellem stakkene er under 15 % før flex; efter flex er alle stakke lige høje.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24, alignItems: "start" }}>
          <Verification page="overblik" width={340} />
          <Verification page="oekonomi" width={340} />
          <Verification page="ejerskab" width={340} />
        </div>
      </div>
    </div>
  );
}

/* ---------- 23.2 Elementtabel ---------- */

const NOTES: Partial<Record<string, string>> = {
  LassoCompanyHead: "Altid første bånd",
  LassoKeyFigureCards: "1/3 giver 2×2 (230); aldrig 1/4",
  LassoKeyValueList: "rows N + 'Se N oplysninger'",
  "LassoKeyValueList (financials)": "12 rækker; rows kan korte",
  LassoShortcuts: "Fylder rest i en stak",
  LassoTextSections: "Klip efter N linjer + 'Vis mere'",
  LassoTimeline: "limit 3 = 338 i 1/2; filterColumn = 1/1",
  LassoNews: "limit 3 = 214 i 1/2; layout grid = 1/1",
  LassoBarChart: "Plot kan vokse op til +25 %",
  LassoMultiYearTable: "Rækker = nøgletal, kolonner = år",
  LassoIncomeStatement: "Fuld bredde = LassoFinancialStatements",
  LassoFinancialStatements: "5 år + værktøjslinje; kun 1/1",
  LassoPersonList: "8 vist + 'Se alle' over 10",
  LassoOwnershipDiagram: "Diagrammet fylder rest i båndet",
  LassoScoreGauge: "1/2 = 302 (med forklaring)",
  LassoProductionUnits: "Tabel",
  LassoMap: "220 i 1/4–1/3, 400 fra 1/2",
  LassoRegistration: "Tekstfelter; aldrig smalt",
  LassoCompareTable: "Én kolonne pr. virksomhed",
  LassoCompanyTable: "Kun 1/1; sider af 25",
  LassoPersonHead: "Altid første bånd",
  LassoChangeFeed: "Feed; 'Vis flere'",
};

const TABLE_TYPES: { key: string; c: ViewComponent }[] = [
  ...(Object.keys(GRID_RULES) as ComponentType[])
    .filter((t) => MEASURED_KEYS.has(t) || ["LassoGroupedBarChart", "LassoLineChart", "LassoStackedBarChart", "LassoWaterfallChart", "LassoMergers", "LassoAnnouncements", "LassoPublications", "LassoLivestock", "LassoCompareTable", "LassoRanking", "LassoCompanyTable", "LassoPersonHead"].includes(t))
    .flatMap((t) => (t === "LassoKeyValueList" ? [{ key: t, c: { type: t } as ViewComponent }, { key: "LassoKeyValueList (financials)", c: { type: t, variant: "financials" } as ViewComponent }] : [{ key: t, c: { type: t } as ViewComponent }])),
];

export function ElementTable() {
  const cols: Col[] = [
    { label: "Element", width: 250, tone: "strong" },
    { label: "Std", width: 44 },
    { label: "Tilladt", width: 76 },
    { label: "Klasse", width: 80 },
    ...WIDTHS.map((w): Col => ({ label: GRID_WIDTH_LABEL[w], width: 50, align: "right" })),
    { label: "Højde", width: 78 },
    { label: "Flex", width: 64 },
    { label: "Note" },
  ];
  const rows = TABLE_TYPES.map(({ key, c: comp }) => {
    const r = gridRuleOf(comp);
    return [
      <span key="n">
        {key === "LassoKeyValueList (financials)" ? "Nøgle-værdi-liste, financials" : TITLE[comp.type] ?? comp.type} <span style={{ color: "var(--lasso-muted)", fontWeight: 400 }}>{key.replace(" (financials)", "")}</span>
      </span>,
      GRID_WIDTH_LABEL[r.std],
      r.min === r.max ? `kun ${GRID_WIDTH_LABEL[r.min]}` : `${GRID_WIDTH_LABEL[r.min]}–${GRID_WIDTH_LABEL[r.max]}`,
      GRID_HEIGHT_LABEL[r.height],
      ...WIDTHS.map((w) => {
        const h = measuredHeight(comp, w);
        const i = WIDTHS.indexOf(w);
        const allowed = i >= WIDTHS.indexOf(r.min) && i <= WIDTHS.indexOf(r.max);
        return (
          <span key={w} style={{ fontWeight: w === r.std ? 600 : 400, color: allowed ? (w === r.std ? "var(--lasso-text)" : undefined) : "var(--lasso-placeholder)" }}>
            {allowed ? h : `(${h})`}
          </span>
        );
      }),
      GRID_BEHAVIOR_LABEL[r.behavior],
      r.flex ? GRID_FLEX_LABEL[r.flex] : "–",
      NOTES[key] ?? "",
    ];
  });
  return (
    <div style={col(16)}>
      <Title
        nr="23.2"
        text="Trin 2, Elementtabel – bredde, højdeklasse og adfærd pr. element"
        intro="Én række pr. komponenttype, læst direkte fra GRID_RULES (catalog.ts) og de målte højder (grid.ts MEASURED_HEIGHTS = measure/heights.json). Fed = standardbredde; tal i parentes er bredder, elementet ikke må stå i. Udgået: LassoScoreHistory, LassoAuditorIndependence, LassoCreditRating. Ikke målt: LassoSummary (som tekst), LassoPersonTable (som virksomhedstabel), LassoFollowUps (1/1, lav, fast, sidste bånd), LassoSavedPages (1/1)."
      />
      <DocTable cols={cols} rows={rows} small />
      <p style={note}>Rækkehøjder til h(type, bredde, rækker): tidslinje 88 px pr. begivenhed; nyheder ca. 48 pr. artikel; person-, ejer- og kontaktlister ca. 40 pr. række; nøgle-værdi-liste ca. 38 pr. række; feed ca. 96 pr. ændring; tekst 17 pr. linje.</p>
    </div>
  );
}

/* ---------- 23.3 Default-siden og spørgsmålet ---------- */

const ORDER: { t: string; d: string }[] = [
  { t: "Hvem er de? Virksomhedshoved (08), fuld", d: "Navn, status, form, branche, adresse og sidens handlinger (Overvåg, Gem, Eksportér). Altid første bånd." },
  { t: "Hvor store er de, og går det godt? Nøgletalskort (09), fuld", d: "Omsætning eller bruttofortjeneste, resultat, egenkapital, ansatte med ændring mod året før. Udelades uden regnskab." },
  { t: "Hvad laver de? Virksomhedsprofil (12), 1/2", d: "Formål og tegningsregler fra CVR plus analysens korte afsnit, klippet efter 6 linjer med 'Vis mere'. Flex: linjer." },
  { t: "Stamdata og revisor? Virksomhedsoplysninger (09), 1/2", d: "Revisor, seneste revisorskift, regnskabsperiode, branchekode, kommune, region. Uden det, hovedet og kontaktblokken allerede viser. Høj mod høj (regel a)." },
  { t: "Hvem står bag? Relationer (11), 1/4", d: "Direktion, bestyrelse og ejere som én kompakt liste. Står ejerlisten på siden, udelades ejerne her." },
  { t: "Hvordan går det over tid? Søjlegraf (13), 1/2", d: "Hovednøgletallet over 5 år. Under 3 år bliver grafen til regnskabslisten med årsvælger (compose.ts)." },
  { t: "Hvordan kontakter jeg dem? Kontaktblok (08), 1/3", d: "Telefon, e-mail, web klikbare. Udelades uden kontaktoplysninger; så tager genveje pladsen i stakken." },
  { t: "Hvad er der sket? Historik (12) og Nyheder (12), 1/2", d: "3 begivenheder + 'Se alle N' og 3 artikler." },
  { t: "Hvor kommer jeg videre? Genveje (08), stakfyld", d: "Ejerdiagram, regnskabsanalyse, nøgletal, ejendomme. Stakfyld under nyhederne, ellers et lavt fuldbånd. Ingen kildelinjer på siden." },
];

const PRINCIPLE: { t: string; d: string }[] = [
  { t: "Svar-elementet først", d: "Det element, der svarer direkte på spørgsmålet, er ankeret i første delte bånd, lige under hovedet. Hovedet er i variant line (40) eller compact (56) på niveau A og B, fuldt (87) på niveau C." },
  { t: "Afgrænset data", d: "Kun det, spørgsmålet nævner: de nævnte nøgletal (metrics), roller, år (years), antal (limit, rows). 'Hvad er omsætningen' giver ét kort, ikke fire." },
  { t: "Kontekst rundt om", d: "De elementer, spørgsmålets emne naturligt trækker med (ejere → reelle ejere og ledelse; økonomi → regnskabsliste), pakkes som stakfyld og næste bånd med algoritmen i 23.1 D. Data, der ikke findes, giver ingen tom ramme: elementet udelades, og stakken pakkes om." },
  { t: "Svarniveau A, B eller C (30)", d: "A Element: ét spørgsmål, ét element, ét fuldbånd. B Sektion: ét emne, 2–4 elementer i ét eller to bånd. C Side: det hele, som default-siden med moduler. Vælg det laveste niveau, der svarer fuldt; svaret vokser via links, aldrig omvendt." },
  { t: "Mønsteret følger af spørgsmålet", d: "1 Overblik, 2 Fokus (stort element 2/3 + fakta 1/3), 3 Ligeværdige (1/2 + 1/2), 4 Liste først, 5 Sammenligning, 6 Tidslinje, 7 Fortælling, 8 Kortgitter, 9 Harmonika. Samme spørgsmål giver samme mønster hver gang; kun data varierer." },
];

/** De tre eksempler fra Paper L5X-0, pakket af motoren (hoved i variant line = 40 px). */
const EX_H = (cmp: ViewComponent, w: Width) => {
  if (cmp.type === "LassoCompanyHead") return 40;
  if (cmp.type === "LassoKeyValueList" && cmp.variant === "financials") return 269;
  if (cmp.type === "LassoKeyValueList") return 194;
  return docHeight(cmp, w);
};
const EXAMPLES: { q: string; level: string; items: ViewComponent[]; text: string }[] = [
  {
    q: "“Hvordan går det med X?”",
    level: "Niveau B, mønster 1 Overblik",
    items: [c("LassoCompanyHead", { variant: "line" }), c("LassoKeyFigureCards"), c("LassoGroupedBarChart", { metrics: ["omsaetning", "resultat"], years: 5 }), c("LassoKeyValueList", { variant: "financials", years: 2, rows: 5 })],
    text: "Listen viser en 6. række som flex. Link: 'Se hele økonomien'.",
  },
  {
    q: "“Hvem ejer X?”",
    level: "Niveau B, mønster 2 Fokus",
    items: [c("LassoCompanyHead", { variant: "line" }), c("LassoOwnershipDiagram"), c("LassoOwnerList"), c("LassoBeneficialOwners"), c("LassoPersonList")],
    text: "Diagrammets plot fylder resten. Kun ejerlisten uden selskaber som ejere: intet diagram, ejerliste + reelle ejere 1/2. Link: 'Åbn X i Lasso'.",
  },
  {
    q: "“Hvem er revisor for X?”",
    level: "Niveau A, ét element",
    items: [c("LassoCompanyHead", { variant: "line" }), c("LassoKeyValueList", { variant: "company", rows: 3, width: "full" })],
    text: "Ét fuldbånd, ingen afvigelse at måle. Ingen kontekst: svaret er tre rækker. Link: 'Se alle oplysninger'. Aldrig to A-svar under hinanden.",
  },
];

const HOST: HostCapabilities = { save: true, refine: false, drillDown: true, refresh: true, export: true, back: false, openSection: true };
const noop = () => undefined;

export function DefaultPageGuide({ ds, company }: { ds: Dataset; company: string }) {
  const spec = composeCompany(company, ds, { focus: "overblik", name: ds.companies[company]?.name, chartMetric: mainMetric(ds.financials[company]?.years ?? []), followUps: false });
  const bands = packBands(DOC_PAGES.overblik.items, docHeight);
  return (
    <div style={col(32)}>
      <Title
        nr="23.3"
        text="Trin 3, Default-virksomhedssiden uden kontekst, og hvordan spørgsmålet gør siden dynamisk"
        intro="Går brugeren direkte ind på en virksomhed uden at have spurgt om noget, vises default-siden: det, en gennemsnitlig bruger har brug for at se, i den rækkefølge spørgsmålene melder sig. Den er kun udgangspunktet. Hele konceptet er, at skærmbilledet tilpasser sig det behov og formål, brugeren har defineret i sit spørgsmål: svar-elementet først med afgrænset data, konteksten pakket rundt om med samme gridmodel (23.1)."
      />
      <div style={two}>
        <div style={col(12)}>
          <div style={h3}>A. Default-siden i gridmodellen (skala 1:2, 1200-gitter, målte højder)</div>
          <BandSketch bands={bands} width={540} scale={2} />
        </div>
        <div style={col(4)}>
          <div style={h3}>Hvad en gennemsnitlig bruger vil vide, i den rækkefølge</div>
          {ORDER.map((o, i) => (
            <Step key={o.t} n={i + 1} title={o.t}>
              {o.d}
            </Step>
          ))}
          <p style={{ ...note, marginTop: 8 }}>Ikke på default-siden: risiko, kreditvurdering, fuldt regnskab, ejerdiagram, produktionsenheder, ejendomme. De hører til det spørgsmål, der peger på dem, og nås via genveje, moduler og opfølgning.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.8fr)", gap: 32, alignItems: "start" }}>
        <div style={col(4)}>
          <div style={h3}>B. Sådan gør spørgsmålet siden dynamisk</div>
          {PRINCIPLE.map((p, i) => (
            <Step key={p.t} n={i + 1} title={p.t}>
              {p.d}
            </Step>
          ))}
        </div>
        <div style={col(12)}>
          <div style={h3}>Tre eksempler (skala 1:3; grøn = flex, grå = fast, stiplet = voksende)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20, alignItems: "start" }}>
            {EXAMPLES.map((e) => {
              const b = packBands(e.items, EX_H);
              return (
                <div key={e.q} style={col(8)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--lasso-text)" }}>{e.q}</div>
                  <div style={note}>{e.level}</div>
                  <BandSketch bands={b} width={220} scale={3} h={EX_H} />
                  <p style={note}>{b.filter((x) => x.stacks.length > 1).map((x, i) => bandText(x, i + 1, EX_H)).join(" ")}</p>
                  <p style={note}>{e.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={col(12)}>
        <div style={h3}>C. Default-siden tegnet af koden (composeCompany, focus overblik, demodata Eksempel Byg A/S)</div>
        <p style={note}>{`Bånd: ${bandSummary(spec.components)}. LassoView tegner hvert bånd på 12 kolonner; stakkene strækkes, og sidste element i hver stak fylder resten, så kolonnelinjerne når båndets bund.`}</p>
        <div style={{ border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", padding: 24 }}>
          <LassoView spec={spec} dataset={ds} host={HOST} onAction={noop} theme="light" frameless />
        </div>
      </div>
    </div>
  );
}

/** "12 | 12 | 6+6 | 3+9 | 6+6 | 12" ud fra kolonne og width på sidens komponenter. */
function bandSummary(components: readonly ViewComponent[]): string {
  const out: string[] = [];
  let last = 0;
  let cur: number[] = [];
  const flush = () => {
    if (cur.length) out.push(cur.join("+"));
    cur = [];
  };
  for (const x of components) {
    if (!x.column) {
      flush();
      out.push("12");
      last = 0;
      continue;
    }
    if (x.column < last) flush();
    if (x.column !== last) cur.push(WIDTH_COLUMNS[x.width ?? "half"]);
    last = x.column;
  }
  flush();
  return out.join(" | ");
}
