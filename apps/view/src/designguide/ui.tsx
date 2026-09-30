import type { ReactNode } from "react";
import type { Report, Verdict } from "./inspect.js";

/** Sidens hoved: overlinje, titel og indledning. */
export function PageHead({ eyebrow, title, lead, children }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <header className="dg-pagehead">
      {eyebrow ? <div className="dg-eyebrow">{eyebrow}</div> : null}
      <h1 className="dg-h1">{title}</h1>
      {lead ? <p className="dg-lead">{lead}</p> : null}
      {children}
    </header>
  );
}

export function Chip({ children, tone = "plain", title }: { children: ReactNode; tone?: "plain" | "accent" | "ok" | "info" | "problem" | "muted"; title?: string }) {
  return (
    <span className={`dg-chip dg-chip--${tone}`} title={title}>
      {children}
    </span>
  );
}

const VERDICT_TONE: Record<Verdict, "ok" | "info" | "problem"> = { ok: "ok", info: "info", problem: "problem" };

/** Valideringens resultat som chip: ikon + ord (regel 7), aldrig kun farve. */
export function ReportChip({ report }: { report?: Report }) {
  if (!report) return <Chip tone="muted">Måler …</Chip>;
  const icon = report.verdict === "ok" ? "✓" : report.verdict === "problem" ? "!" : "i";
  return (
    <Chip tone={report.state !== "fyldt" && report.verdict === "ok" ? "muted" : VERDICT_TONE[report.verdict]} title={report.findings.map((f) => f.text).join("\n")}>
      <span aria-hidden="true" className="dg-chip__icon">
        {icon}
      </span>
      {report.label}
    </Chip>
  );
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: { id: T; label: ReactNode }[]; onChange: (id: T) => void }) {
  return (
    <div className="dg-tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={it.id === value} className={`dg-tab${it.id === value ? " is-on" : ""}`} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ value, items, onChange, label }: { value: T; items: { id: T; label: ReactNode }[]; onChange: (id: T) => void; label: string }) {
  return (
    <div className="dg-seg" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} className={it.id === value ? "is-on" : ""} aria-pressed={it.id === value} onClick={() => onChange(it.id)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="dg-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="dg-toggle__track" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

/** Kildehenvisning til en fil i repoet (til udviklere; står diskret). */
export function SourceRef({ file, line }: { file: string; line?: number }) {
  return (
    <code className="dg-src">
      {file}
      {line ? `:${line}` : ""}
    </code>
  );
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" });
