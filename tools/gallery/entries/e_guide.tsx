// 23 Guide og 30.12: Papers instruktionsartboards (skitser, tabeller, tjeklister) tegnet med tokens,
// så de kan sammenlignes 1:1. Teksterne står i e_guide_data.ts (hentet fra Paper med get_jsx).
import type { CSSProperties, ReactNode } from "react";
import {
  CHECKLIST,
  COVERAGE_INTRO,
  COVERAGE_ROWS,
  COVERAGE_SOURCE,
  DATATYPE_ROWS,
  LOOKUP_ROWS,
  LOOKUP_RULES,
  MAPPING_CARDS,
  MAPPING_INTRO,
  MAPPING_ROWS,
  NUMBER_DEFS,
  ORDER_STEPS,
  STATE_DEFS,
  WIDTH_NOTE,
  WIDTH_PAPER_CARDS,
  WIDTH_ROWS,
  ZONE_NOTE,
} from "./e_guide_data.js";

/* ---------- Byggesten (kun tokens) ---------- */

export const overline: CSSProperties = {
  fontSize: "var(--lasso-fs-label)",
  lineHeight: "16px",
  fontWeight: 600,
  letterSpacing: "var(--lasso-ls-label)",
  textTransform: "uppercase",
  color: "var(--lasso-muted)",
};
const note: CSSProperties = { margin: 0, fontSize: 12, lineHeight: "17px", color: "var(--lasso-muted)" };
const body: CSSProperties = { fontSize: "var(--lasso-fs)", lineHeight: "19px", color: "var(--lasso-text-2)" };
const frame: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius)", overflow: "hidden", background: "var(--lasso-surface)" };
const card: CSSProperties = { border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", padding: 20, display: "flex", flexDirection: "column", gap: 10, background: "var(--lasso-surface)", minWidth: 0 };
const cardTitle: CSSProperties = { fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--lasso-text)" };

function Block({ label, children, gap = 12 }: { label: string; children: ReactNode; gap?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <div style={overline}>{label}</div>
      {children}
    </div>
  );
}

export interface Col {
  label: string;
  /** Fast bredde i px; uden bredde fylder kolonnen resten. */
  width?: number;
  align?: "right";
  /** Celleudseende: "strong" (ink 600), "accent" (koral 600), "ink" (ink 400), standard tekst. */
  tone?: "strong" | "accent" | "ink" | "muted";
}

const cellTone = (tone: Col["tone"], emph?: boolean): CSSProperties => ({
  color: tone === "accent" ? "var(--lasso-accent-text)" : tone === "muted" ? "var(--lasso-muted)" : tone === "strong" || tone === "ink" || emph ? "var(--lasso-text)" : "var(--lasso-text-2)",
  fontWeight: tone === "strong" || tone === "accent" || emph ? 600 : 400,
});

/** Papers dokumentationstabel: overlinje-hoved 36 px på panel-flade, rækker ≥ 36 px med tynde linjer. */
export function DocTable({ cols, rows, small = false }: { cols: readonly Col[]; rows: readonly (readonly ReactNode[] | { group: string } | { emph: readonly ReactNode[] })[]; /** 13 px tekst og 14 px sidemargen (23.7). */ small?: boolean }) {
  const cell = (c: Col): CSSProperties => ({ flex: c.width ? `0 0 ${c.width}px` : "1 1 0", minWidth: 0, overflowWrap: "anywhere", textAlign: c.align ?? "left", paddingRight: c.align ? 0 : small ? 12 : 16 });
  const padX = small ? 14 : 16;
  return (
    <div style={frame}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 36, padding: `0 ${padX}px`, background: "var(--lasso-surface-muted)", borderBottom: "1px solid var(--lasso-border)" }}>
        {cols.map((c) => (
          <div key={c.label} style={{ ...cell(c), ...overline }}>
            {c.label}
          </div>
        ))}
      </div>
      {rows.map((r, i) => {
        const last = i === rows.length - 1;
        const line = last ? undefined : "1px solid var(--lasso-divider-subtle)";
        if ("group" in r) {
          return (
            <div key={i} style={{ padding: "14px 16px 8px", borderBottom: line, ...overline, color: "var(--lasso-accent-text)" }}>
              {r.group}
            </div>
          );
        }
        const emph = "emph" in r;
        const cells = "emph" in r ? r.emph : r;
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", minHeight: 36, padding: `9px ${padX}px`, borderBottom: line, background: emph ? "var(--lasso-surface-muted)" : undefined, fontSize: small ? "var(--lasso-fs-sm)" : "var(--lasso-fs)", lineHeight: "18px" }}>
            {cols.map((c, j) => (
              <div key={j} style={{ ...cell(c), ...cellTone(c.tone, emph) }}>
                {cells[j]}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- 23.1 Sideskabelon: skitse af zonerne (660 px som i Paper) ---------- */

const sketchText = (color = "var(--lasso-text-2)"): CSSProperties => ({ fontSize: 10, lineHeight: "12px", fontWeight: 600, color });
const box = (grow: number, height: number, label: string, accent = false) => (
  <div
    style={{
      flex: `${grow} 1 0`,
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px dashed ${accent ? "var(--lasso-accent-border)" : "var(--lasso-border)"}`,
      borderRadius: 6,
      background: accent ? "var(--lasso-accent-soft)" : undefined,
    }}
  >
    <span style={sketchText(accent ? "var(--lasso-accent-text)" : undefined)}>{label}</span>
  </div>
);
const side = (width: number, title: string, text: string, edge: "left" | "right") => (
  <div
    style={{
      width,
      flex: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      padding: 8,
      textAlign: "center",
      background: "var(--lasso-surface-muted)",
      [edge === "left" ? "borderRight" : "borderLeft"]: "1px solid var(--lasso-border)",
    }}
  >
    <span style={{ fontSize: 11, lineHeight: "14px", fontWeight: 600, color: "var(--lasso-text)" }}>{title}</span>
    <span style={{ fontSize: 10, lineHeight: "12px", color: "var(--lasso-muted)" }}>{text}</span>
  </div>
);

export function ZoneSketch() {
  return (
    <div style={{ width: 660 }}>
      <Block label="23.1, Trin 1, Sideskabelon (06) - én ramme, tre zoner">
        <div style={{ border: "1px solid var(--lasso-border)", borderRadius: "var(--lasso-radius-lg)", overflow: "hidden", background: "var(--lasso-surface)" }}>
          <div style={{ height: 26, display: "flex", alignItems: "center", padding: "0 12px", background: "var(--lasso-chrome)", borderBottom: "1px solid var(--lasso-chrome-border)" }}>
            <span style={sketchText()}>Fanebjælke, 56 px, åbne virksomheder og værktøjer (06)</span>
          </div>
          <div style={{ height: 32, display: "flex", alignItems: "center", padding: "0 12px", borderBottom: "1px solid var(--lasso-border)" }}>
            <span style={sketchText()}>Modulbjælke, 56 px, hvert punkt er et modul + sidens handlinger til højre (06, niveau 1 i 29) - navnet står øverst i første kolonne (08)</span>
          </div>
          <div style={{ display: "flex", height: 300 }}>
            {side(108, "Skinne", "236 px, sektioner / kriterier (06, 02)", "left")}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>{box(1, 44, "Nøgletalskort 4/4 (09)", true)}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {box(2, 120, "Graf 2/4 (13)")}
                {box(2, 120, "Nøgle-værdi 2/4 (09)")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>{box(1, 70, "Tabel 4/4 (15)")}</div>
              <div style={{ fontSize: 10, lineHeight: "12px", color: "var(--lasso-muted)", textAlign: "center" }}>Midte, flydende, padding 28, gutter 24, 4-kolonne grid</div>
            </div>
            {side(150, "Panel", "336 px, kontakt, genveje, risiko-sammenfatning (08, 17), valgfrit", "right")}
          </div>
        </div>
        <p style={note}>{ZONE_NOTE}</p>
      </Block>
    </div>
  );
}

/* ---------- 23.2–23.8 ---------- */

export const WidthTable = () => (
  <Block label="23.2, Trin 2, Kolonnebredder ved 1440 px">
    <DocTable
      cols={[{ label: "Zone" }, { label: "Med panel", width: 120, align: "right", tone: "ink" }, { label: "Uden panel", width: 120, align: "right", tone: "ink" }]}
      rows={WIDTH_ROWS.map(([z, a, b, strong]) => (strong ? { emph: [z, a, b] } : [z, a, b === "-" ? <span style={{ color: "var(--lasso-faint)" }}>-</span> : b]))}
    />
    <p style={note}>{WIDTH_NOTE}</p>
  </Block>
);

export const OrderSteps = () => (
  <Block label="23.3, Trin 3, Rækkefølge på en side - oppefra og ned">
    <div style={{ display: "flex", flexDirection: "column" }}>
      {ORDER_STEPS.map(([n, title, text], i) => (
        <div key={n} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < ORDER_STEPS.length - 1 ? "1px solid var(--lasso-divider-subtle)" : undefined }}>
          <div
            style={{
              width: 24,
              height: 24,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              border: n === "P" ? "0" : "1px solid var(--lasso-text)",
              fontSize: 12,
              fontWeight: n === "P" ? 700 : 600,
              color: "var(--lasso-text)",
            }}
          >
            {n}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 15, lineHeight: "22px", fontWeight: 600, color: "var(--lasso-text)" }}>{title}</div>
            <div style={{ fontSize: 12, lineHeight: "17px", color: "var(--lasso-muted)" }}>{text}</div>
          </div>
        </div>
      ))}
    </div>
  </Block>
);

export const DatatypeTable = () => (
  <Block label="23.4, Trin 4, Datatype → element - slå op før du tegner noget nyt">
    <DocTable cols={[{ label: "Datatype", width: 230 }, { label: "Element", tone: "ink" }, { label: "Artboard", width: 90, align: "right", tone: "accent" }]} rows={DATATYPE_ROWS} />
  </Block>
);

function DefList({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 10 }}>
          <div style={{ ...body, width: 84, flex: "none", fontWeight: 600, color: "var(--lasso-text)" }}>{k}</div>
          <div style={body}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export const StatesAndFormat = () => (
  <Block label="23.5, Trin 5, Tjek tilstande og talformat før du afleverer">
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ ...card, flex: "1 1 0" }}>
        <div style={cardTitle}>Hvert dataelement har fem tilstande</div>
        <DefList rows={STATE_DEFS} />
      </div>
      <div style={{ ...card, flex: "1 1 0" }}>
        <div style={cardTitle}>Talformat (fra 09)</div>
        <DefList rows={NUMBER_DEFS} />
      </div>
      <div style={{ ...card, flex: "0 0 300px" }}>
        <div style={cardTitle}>Aflever aldrig uden</div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {CHECKLIST.map((t, i) => (
            <li key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ ...body, width: 16, flex: "none", fontWeight: 700, color: "var(--lasso-accent-text)" }}>{i + 1}</span>
              <span style={body}>{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  </Block>
);

function TwoCards({ cards }: { cards: readonly (readonly [string, string])[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {cards.map(([t, text]) => (
        <div key={t} style={{ ...card, gap: 8 }}>
          <div style={cardTitle}>{t}</div>
          <div style={body}>{text}</div>
        </div>
      ))}
    </div>
  );
}

export const WidthAndPaper = () => (
  <Block label="23.6, Trin 6, Tænk bredden og papiret med fra start">
    <TwoCards cards={WIDTH_PAPER_CARDS} />
  </Block>
);

export const MappingTable = () => (
  <Block label="23.7, Trin 7, Mapping pr. element: desktop → tablet → mobil">
    <p style={{ ...body, margin: 0 }}>{MAPPING_INTRO}</p>
    <DocTable
      small
      cols={[{ label: "Element", width: 170, tone: "strong" }, { label: "Desktop 1440", width: 220 }, { label: "Tablet 768", width: 220 }, { label: "Mobil 390" }, { label: "Ref.", width: 64, align: "right", tone: "muted" }]}
      rows={MAPPING_ROWS}
    />
    <TwoCards cards={MAPPING_CARDS} />
  </Block>
);

export const CoverageTable = () => (
  <Block label="23.8, Trin 8, Dækningstabel mod docs.lassox.com/api - hver datatype har et element på desktop og mobil">
    <p style={{ ...body, margin: 0 }}>{COVERAGE_INTRO}</p>
    <DocTable
      cols={[{ label: "Datatype / endpoint", width: 250, tone: "ink" }, { label: "Element(er)" }, { label: "Desktop", width: 150 }, { label: "Mobil / tablet", width: 150 }, { label: "Dækket", width: 60 }]}
      rows={COVERAGE_ROWS.map((r) => (typeof r === "string" ? { group: r } : [...r, "Ja"]))}
    />
    <p style={note}>{COVERAGE_SOURCE}</p>
  </Block>
);

/* ---------- 30.12 Fra spørgsmål til layout ---------- */

export const LookupTable = () => (
  <Block label="30.12, Fra spørgsmål til layout - den tabel en AI slår op i, før den tegner. Findes spørgsmålet ikke, vælges nærmeste række, aldrig en ny form">
    <DocTable
      cols={[{ label: "Spørgsmål", width: 300, tone: "ink" }, { label: "Niveau", width: 90 }, { label: "Mønster", width: 130 }, { label: "Elementer i rækkefølge (artboard)" }, { label: "Link videre", width: 200, tone: "accent" }]}
      rows={LOOKUP_ROWS.map(([q, lvl, m, el, link]) => [q, lvl, m, el, <span style={{ fontWeight: 400 }}>{link}</span>])}
    />
    <p style={note}>{LOOKUP_RULES}</p>
  </Block>
);
