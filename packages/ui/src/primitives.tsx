import type { ReactNode } from "react";
import { formatPercent, percentChange, type CompanyVM } from "@lasso/spec";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`lasso-card ${className}`}>
      {title ? <h3 className="lasso-card__title">{title}</h3> : null}
      {children}
    </section>
  );
}

export function StatusBadge({ status, kind }: { status?: string; kind?: CompanyVM["statusKind"] }) {
  if (!status) return null;
  return <span className={`lasso-badge lasso-badge--${kind ?? "inactive"}`}>{status}</span>;
}

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "demo" | "active" | "warning" | "inactive" }) {
  return <span className={`lasso-badge lasso-badge--${tone} ${tone === "plain" || tone === "demo" ? "lasso-badge--plain" : ""}`}>{children}</span>;
}

export type StateKind = "empty" | "loading" | "noaccess" | "error";

const STATE_TEXT: Record<StateKind, { title: string; body: string }> = {
  empty: { title: "Ingen resultater", body: "Prøv at fjerne et kriterium eller søge bredere." },
  loading: { title: "Henter data…", body: "" },
  noaccess: { title: "Ingen adgang", body: "Din Lasso-konto har ikke adgang til disse data." },
  error: { title: "Noget gik galt", body: "Data kunne ikke hentes." },
};

/** Fælles tilstande: tom, indlæser, ingen adgang, fejl. */
export function StateBox({ kind, message }: { kind: StateKind; message?: string }) {
  if (kind === "loading") return <Skeleton lines={3} />;
  const t = STATE_TEXT[kind];
  return (
    <div className={`lasso-state ${kind === "error" ? "lasso-state--error" : ""}`} role={kind === "error" ? "alert" : undefined}>
      <div className="lasso-state__title">{t.title}</div>
      <div className="lasso-small">{message ?? t.body}</div>
    </div>
  );
}

export function stateForError(message: string | undefined): StateKind {
  if (!message) return "error";
  return /adgang|401|403/i.test(message) ? "noaccess" : "error";
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Henter data" style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="lasso-skeleton" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: readonly number[] }) {
  const pct = percentChange(values);
  if (values.length < 2) return <span className="lasso-muted">–</span>;
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
