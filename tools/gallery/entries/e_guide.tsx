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
export function DocTable({ cols, rows }: { cols: readonly Col[]; rows: readonly (readonly ReactNode[] | { group: string } | { emph: readonly ReactNode[] })[] }) {
  const cell = (c: Col): CSSProperties => ({ flex: c.width ? `0 0 ${c.width}px` : "1 1 0", minWidth: 0, textAlign: c.align ?? "left", paddingRight: c.align ? 0 : 16 });
  return (
    <div style={frame}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 36, padding: "0 16px", background: "var(--lasso-surface-muted)", borderBottom: "1px solid var(--lasso-border)" }}>
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
          <div key={i} style={{ display: "flex", alignItems: "flex-start", minHeight: 36, padding: "9px 16px", borderBottom: line, background: emph ? "var(--lasso-surface-muted)" : undefined, fontSize: "var(--lasso-fs)", lineHeight: "18px" }}>
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

/* ---------- 23.1 Sideskabelon: skitse af zonerne ---------- */

const zone = (extra: CSSProperties = {}): CSSProperties => ({
  border: "1px dashed var(--lasso-border-strong)",
  borderRadius: "var(--lasso-radius)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 12,
  fontSize: "var(--lasso-fs-sm)",
  lineHeight: "18px",
  color: "var(--lasso-muted)",
  background: "var(--lasso-surface)",
  ...extra,
});
const bar = (label: string) => (
  <div style={{ height: 56, flex: "none", display: "flex", alignItems: "center", padding: "0 20px", borderBottom: "1px solid var(--lasso-border)", fontSize: "var(--lasso-fs-sm)", color: "var(--lasso-text-2)", background: "var(--lasso-surface)" }}>
    {label}
  </div>
);

export function ZoneSketch() {
  return (
    <Block label="23.1, Trin 1, Sideskabelon (06) — én ramme, tre zoner">
      <div style={{ ...frame, display: "flex", height: 640, background: "var(--lasso-chrome)" }}>
        <div style={{ width: 236, flex: "none", borderRight: "1px solid var(--lasso-border)", padding: 16, display: "flex" }}>
          <div style={zone({ flex: 1 })}>Skinne 236 px, sektioner / kriterier (06, 02)</div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {bar("Fanebjælke, 56 px, åbne virksomheder og værktøjer (06)")}
          {bar("Modulbjælke, 56 px, hvert punkt er et modul + sidens handlinger til højre")}
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <div style={{ flex: 1, minWidth: 0, padding: 28, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gridAutoRows: "min-content", gap: 24, alignContent: "start" }}>
              <div style={zone({ gridColumn: "1 / -1", height: 88, background: "var(--lasso-accent-soft)", borderColor: "var(--lasso-accent-border)", color: "var(--lasso-accent-text)", fontWeight: 600 })}>Nøgletalskort 4/4 (09)</div>
              <div style={zone({ gridColumn: "span 2", height: 180 })}>Graf 2/4 (13)</div>
              <div style={zone({ gridColumn: "span 2", height: 180 })}>Nøgle-værdi 2/4 (09)</div>
              <div style={zone({ gridColumn: "1 / -1", height: 120 })}>Tabel 4/4 (15)</div>
              <div style={{ gridColumn: "1 / -1", ...note }}>Midte, flydende, padding 28, gutter 24, 4-kolonne grid</div>
            </div>
            <div style={{ width: 336, flex: "none", borderLeft: "1px solid var(--lasso-border)", padding: 16, display: "flex", background: "var(--lasso-surface)" }}>
              <div style={zone({ flex: 1 })}>Panel 336 px, kontakt, genveje, risiko-sammenfatning (08, 17), valgfrit</div>
            </div>
          </div>
        </div>
      </div>
      <p style={note}>{ZONE_NOTE}</p>
    </Block>
  );
}

/* ---------- 23.2–23.8 ---------- */

export const WidthTable = () => (
  <Block label="23.2, Trin 2, Kolonnebredder ved 1440 px">
    <DocTable
      cols={[{ label: "Zone" }, { label: "Med panel", width: 120, align: "right", tone: "ink" }, { label: "Uden panel", width: 120, align: "right", tone: "ink" }]}
      rows={WIDTH_ROWS.map(([z, a, b, strong]) => (strong ? { emph: [z, a, b] } : [z, a, b === "—" ? <span style={{ color: "var(--lasso-faint)" }}>—</span> : b]))}
    />
    <p style={note}>{WIDTH_NOTE}</p>
  </Block>
);

export const OrderSteps = () => (
  <Block label="23.3, Trin 3, Rækkefølge på en side — oppefra og ned">
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
  <Block label="23.4, Trin 4, Datatype → element — slå op før du tegner noget nyt">
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
        <div key={t} style={card}>
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
      cols={[{ label: "Element", width: 190, tone: "strong" }, { label: "Desktop 1440" }, { label: "Tablet 768" }, { label: "Mobil 390", tone: "ink" }, { label: "Ref.", width: 90, align: "right", tone: "muted" }]}
      rows={MAPPING_ROWS}
    />
    <TwoCards cards={MAPPING_CARDS} />
  </Block>
);

export const CoverageTable = () => (
  <Block label="23.8, Trin 8, Dækningstabel mod docs.lassox.com/api — hver datatype har et element på desktop og mobil">
    <p style={{ ...body, margin: 0 }}>{COVERAGE_INTRO}</p>
    <DocTable
      cols={[{ label: "Datatype / endpoint", width: 260, tone: "ink" }, { label: "Element(er)" }, { label: "Desktop", width: 160 }, { label: "Mobil / tablet", width: 160 }, { label: "Dækket", width: 70 }]}
      rows={COVERAGE_ROWS.map((r) => (typeof r === "string" ? { group: r } : [...r, "Ja"]))}
    />
    <p style={note}>{COVERAGE_SOURCE}</p>
  </Block>
);

/* ---------- 30.12 Fra spørgsmål til layout ---------- */

export const LookupTable = () => (
  <Block label="Fra spørgsmål til layout — den tabel en AI slår op i, før den tegner. Findes spørgsmålet ikke, vælges nærmeste række, aldrig en ny form">
    <DocTable
      cols={[{ label: "Spørgsmål", width: 270, tone: "ink" }, { label: "Niveau", width: 90 }, { label: "Mønster", width: 130 }, { label: "Elementer i rækkefølge (artboard)" }, { label: "Link videre", width: 170, tone: "accent" }]}
      rows={LOOKUP_ROWS.map(([q, lvl, m, el, link]) => [q, lvl, m, el, <span style={{ fontWeight: 400 }}>{link}</span>])}
    />
    <p style={note}>{LOOKUP_RULES}</p>
  </Block>
);
