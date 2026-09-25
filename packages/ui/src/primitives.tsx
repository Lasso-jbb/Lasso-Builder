import type { ReactNode } from "react";
import { MISSING, formatDate, formatPercent, percentChange, type CompanyVM } from "@lasso/spec";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`lasso-card ${className}`}>
      {title ? <h3 className="lasso-card__title">{title}</h3> : null}
      {children}
    </section>
  );
}

/** Regel 1: status er ren tekst i vægt 500 — ingen pille, prik eller farvet flade. */
export function StatusBadge({ status, kind }: { status?: string; kind?: CompanyVM["statusKind"] }) {
  if (!status) return null;
  return <span className={`lasso-badge lasso-badge--${kind ?? "inactive"}`}>{status}</span>;
}

/** Regel 2: ingen dekorative badges. Bevaret som ren tekst, så eksisterende kald virker. */
export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "demo" | "active" | "warning" | "inactive" }) {
  return <span className={`lasso-badge lasso-badge--${tone}`}>{children}</span>;
}

/**
 * De fem tilstande fra kataloget. "filled" tegnes af komponenten selv;
 * de fire andre tegnes her, så alle elementer ser ens ud.
 */
export type DataStateKind = "loading" | "empty" | "notreported" | "error";

export interface DataStateProps {
  state: DataStateKind;
  /** Tom: skal sige HVORFOR der intet er (aldrig "0"). */
  reason?: string;
  /** Fejl: kun teknisk fejl. Giver en "Prøv igen"-knap, når den er sat. */
  onRetry?: () => void;
  /** Henter: skelettet får samme højde som det fyldte element. */
  height?: number;
  lines?: number;
}

export function DataState({ state, reason, onRetry, height, lines = 3 }: DataStateProps) {
  if (state === "loading") return <Skeleton lines={lines} height={height} />;
  if (state === "notreported") return <span className="lasso-notreported">Ikke oplyst</span>;
  if (state === "empty") {
    return (
      <div className="lasso-state" style={height ? { minHeight: height } : undefined}>
        <div className="lasso-small">{reason ?? "Der er ingen data at vise."}</div>
      </div>
    );
  }
  return (
    <div className="lasso-state lasso-state--error" role="alert" style={height ? { minHeight: height } : undefined}>
      <div className="lasso-state__title">Data kunne ikke hentes</div>
      {reason ? <div className="lasso-small">{reason}</div> : null}
      {onRetry ? (
        <button type="button" className="lasso-btn lasso-btn--sm lasso-state__retry" onClick={onRetry}>
          Prøv igen
        </button>
      ) : null}
    </div>
  );
}

/** Enkelt manglende værdi i en celle eller et felt: "—" i text-faint. */
export function Missing() {
  return <span className="lasso-notreported">{MISSING}</span>;
}

/** Regel 8: kildelinje én gang pr. sektion, "Kilde: Navn, opdateret DD.MM.ÅÅÅÅ". */
export function SourceLine({ source, updated }: { source: string; updated?: string | null }) {
  return (
    <p className="lasso-source">
      Kilde: {source}
      {updated ? `, opdateret ${formatDate(updated)}` : ""}
    </p>
  );
}

export type StateKind = "empty" | "loading" | "noaccess" | "error";

/** Ældre kald. Mapper til DataState, så alle tilstande følger kataloget. */
export function StateBox({ kind, message }: { kind: StateKind; message?: string }) {
  if (kind === "loading") return <DataState state="loading" />;
  if (kind === "empty") return <DataState state="empty" reason={message ?? "Ingen resultater. Prøv at fjerne et kriterium eller søge bredere."} />;
  if (kind === "noaccess") return <DataState state="empty" reason={message ?? "Din Lasso-konto har ikke adgang til disse data."} />;
  return <DataState state="error" reason={message} />;
}

export function stateForError(message: string | undefined): StateKind {
  if (!message) return "error";
  return /adgang|401|403/i.test(message) ? "noaccess" : "error";
}

export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div aria-busy="true" aria-label="Henter data" className="lasso-skeleton-group" style={height ? { minHeight: height } : undefined}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="lasso-skeleton" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: readonly number[] }) {
  const pct = percentChange(values);
  if (values.length < 2) return <Missing />;
  const w = 72;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <span className="lasso-trend" title={pct !== null ? `${formatPercent(pct)} over perioden` : undefined}>
      <svg className="lasso-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path d={d} />
        <circle cx={last[0]} cy={last[1]} r="2.2" />
      </svg>
      <span className={`lasso-trend__pct ${pct !== null && pct < 0 ? "lasso-down" : "lasso-up"}`}>{formatPercent(pct)}</span>
    </span>
  );
}

export function Delta({ from, to }: { from?: number | null; to?: number | null }) {
  const pct = percentChange([from, to]);
  if (pct === null && typeof from === "number" && typeof to === "number" && from !== 0 && Math.sign(from) !== Math.sign(to)) {
    // Katalog 09: skifter fortegnet, vises kun pilen.
    return <span className={to < 0 ? "lasso-down" : "lasso-up"} aria-label={to < 0 ? "Til underskud" : "Til overskud"}>{to < 0 ? "▼" : "▲"}</span>;
  }
  if (pct === null) return null;
  return (
    <span className={pct < 0 ? "lasso-down" : "lasso-up"}>
      {pct < 0 ? "▼" : "▲"} {formatPercent(Math.abs(pct), false)}
    </span>
  );
}

export function initials(name: string): string {
  return name
    .replace(/\b(A\/S|ApS|I\/S|K\/S|P\/S|IVS)\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
