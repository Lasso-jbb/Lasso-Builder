import { useState, type KeyboardEvent, type ReactNode } from "react";
import { formatPercent, percentChange } from "@lasso/spec";

/**
 * Fælles interaktion for graferne i katalog 13 og mobilformerne i 26b.
 *
 * Desktop: hover over et år (en "slot") viser én mørk tooltip (ink, radius 8) med alle serier.
 * Mobil (smal container): der er ingen hover; et tryk vælger året, og det valgte år står i et fast
 * felt under grafen (erstatter tooltip). Uden tryk står seneste år i feltet.
 * Tastatur: grafen kan få fokus; pil venstre/højre flytter mellem årene, Esc fjerner valget.
 */

/** Grafens bredde under denne grænse = mobilformen (26b). Samme grænse som maks 5 punkter. */
export const COMPACT_W = 420;
export const isCompact = (w: number) => w > 0 && w < COMPACT_W;

export interface PickRow {
  label: string;
  value: string;
  /** Seriens farveklasse, fx "s1" (lasso-chart__swatch--s1). Udeladt = ingen farveprik. */
  swatch?: string;
  /** Stiplet streg i stedet for en prik (benchmark/branche). */
  dashed?: boolean;
  /** Ændringen mod året før, fx "▲ 12,1 %". */
  change?: ChangeText | null;
  /** Kort navn til det faste felt på mobil (26b.4), fx "Eksempel Byg" uden selskabsform. */
  short?: string;
}

/** 26b.4: seriens navn i det faste felt: uden selskabsform og højst 16 tegn. */
export function shortSeriesName(name: string): string {
  const bare = name.replace(/\s+(A\/S|ApS|I\/S|P\/S|K\/S|IVS|A\.m\.b\.A\.|SMBA|F\.M\.B\.A\.)$/i, "").trim();
  return bare.length > 16 ? `${bare.slice(0, 15).trimEnd()}…` : bare;
}

export interface ChangeText {
  text: string;
  dir: "up" | "down" | "flat";
}

/**
 * Ændring fra forrige værdi som pil + procent (09: skifter fortegnet, vises kun pilen og ordet).
 * `higherIsWorse` bruges til risiko, hvor en stigning er dårlig; retningen (pilen) er den samme.
 */
export function changeText(prev: number | null | undefined, cur: number | null | undefined): ChangeText | null {
  if (typeof prev !== "number" || typeof cur !== "number") return null;
  const pct = percentChange([prev, cur]);
  if (pct === null) {
    if (prev !== 0 && Math.sign(prev) !== Math.sign(cur)) return { text: cur < 0 ? "▼ underskud" : "▲ overskud", dir: cur < 0 ? "down" : "up" };
    return null;
  }
  if (Math.abs(pct) < 0.05) return { text: "uændret", dir: "flat" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, dir: pct < 0 ? "down" : "up" };
}

/**
 * Hvilket punkt der er aktivt. `hover` følger musen (desktop), `picked` er det valgte punkt (tryk
 * eller tastatur). På mobil står det valgte punkt (eller det seneste) altid i det faste felt.
 */
export function useChartPick(count: number, compact: boolean) {
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const clamp = (i: number | null) => (i === null || count === 0 ? null : Math.max(0, Math.min(count - 1, i)));
  const active = clamp(hover ?? picked);
  /** Mobilens faste felt: valgt punkt, ellers seneste. */
  const readout = compact ? clamp(picked ?? count - 1) : null;
  const onKeyDown = (e: KeyboardEvent) => {
    if (count === 0) return;
    const cur = picked ?? count - 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setPicked(clamp(cur + (e.key === "ArrowLeft" ? -1 : 1)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setPicked(e.key === "Home" ? 0 : count - 1);
    } else if (e.key === "Escape") {
      setPicked(null);
    }
  };
  return {
    /** Desktop: punktet med tooltip og fremhævning. */
    active: compact ? readout : active,
    /** Desktop-tooltip vises kun ved hover/valg; mobil bruger det faste felt. */
    tooltip: compact ? null : active,
    readout,
    enter: (i: number) => (compact ? undefined : setHover(i)),
    leave: () => setHover(null),
    pick: (i: number) => setPicked(i),
    /** Props til grafens ramme: fokus og tastatur. */
    frame: {
      tabIndex: 0,
      onKeyDown,
      onMouseLeave: () => setHover(null),
      onBlur: () => (compact ? undefined : setPicked(null)),
    },
  };
}

function Swatch({ row }: { row: PickRow }) {
  if (!row.swatch) return null;
  return <span className={`lasso-chart__swatch lasso-chart__swatch--${row.swatch}${row.dashed ? " lasso-chart__swatch--dashed" : ""}`} aria-hidden="true" />;
}

function Rows({ rows }: { rows: readonly PickRow[] }) {
  return (
    <>
      {rows.map((r, i) => (
        <div className="lasso-pick__row" key={i}>
          <Swatch row={r} />
          <span className="lasso-pick__label">{r.label}</span>
          <span className="lasso-pick__value">{r.value}</span>
          {r.change ? <span className={`lasso-pick__change lasso-pick__change--${r.change.dir}`}>{r.change.text}</span> : null}
        </div>
      ))}
    </>
  );
}

/**
 * Mørk tooltip over grafen (desktop). `x` er punktets midte i px fra grafens venstre kant, `y` toppen
 * af det højeste element i punktet. Vender til venstre, når den ville gå ud over højre kant.
 */
export function ChartTooltip({ x, y, width, title, rows, note }: { x: number; y: number; width: number; title: ReactNode; rows: readonly PickRow[]; note?: ReactNode }) {
  const flip = x > width - 180;
  const style = { left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined, top: Math.max(0, y - 8) };
  return (
    <div className="lasso-pick lasso-pick--tooltip" role="status" style={style}>
      <div className="lasso-pick__title">{title}</div>
      <Rows rows={rows} />
      {note ? <div className="lasso-pick__note">{note}</div> : null}
    </div>
  );
}

/**
 * Mobil (26b): det valgte år i et fast felt under grafen (erstatter tooltip).
 * `inline` (26b.1/26b.4): én 44 px linje med divider over, året 600 til venstre og værdierne til højre,
 * fx "2025 | 18,8 mio. kr., ▲ 7,5 %" eller "2024 | LASSO X 221, branche 133".
 */
export function ChartReadout({ title, rows, note, hint = "Tryk på et år for at se tallene", inline = false }: { title: ReactNode; rows: readonly PickRow[]; note?: ReactNode; hint?: string; inline?: boolean }) {
  if (inline) {
    const one = rows.length === 1;
    return (
      <div className="lasso-pick lasso-pick--line" aria-live="polite">
        <span className="lasso-pick__title">{title}</span>
        <span className="lasso-pick__line">
          {rows.map((r, i) => (
            <span key={i} className="lasso-pick__item">
              {i > 0 ? <span className="lasso-pick__sep">,&nbsp;</span> : null}
              {/* 13.6: feltet står altid på én linje; lange navne afkortes, tallet står altid. */}
              {one ? null : (
                <span className="lasso-pick__label" title={r.label}>
                  {r.label}
                </span>
              )}
              {one ? null : "\u00a0"}
              <span className="lasso-pick__value">{r.value}</span>
              {one && r.change ? (
                <>
                  {", "}
                  <span className={`lasso-pick__change lasso-pick__change--${r.change.dir}`}>{r.change.text}</span>
                </>
              ) : null}
            </span>
          ))}
        </span>
      </div>
    );
  }
  return (
    <div className="lasso-pick lasso-pick--readout" aria-live="polite">
      <div className="lasso-pick__head">
        <span className="lasso-pick__title">{title}</span>
        <span className="lasso-pick__hint">{hint}</span>
      </div>
      <Rows rows={rows} />
      {note ? <div className="lasso-pick__note">{note}</div> : null}
    </div>
  );
}
