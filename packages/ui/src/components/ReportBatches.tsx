import { useState } from "react";
import { formatDate, formatNumber, formatPercent } from "@lasso/spec";
import { Section } from "../primitives.js";
import { Tabs } from "./Tabs.js";

export type BatchStatus = "planned" | "running" | "done" | "failed";

/** De fire rapporttyper fra platform/reporting (28.4). */
export const REPORT_TYPES = ["Revision", "Finans", "Reelle ejere", "Revision udvidet"] as const;

export interface ReportBatchVM {
  id: string;
  name: string;
  /** En af de fire rapporttyper fra API'et: Revision, Finans, Reelle ejere, Revision udvidet. */
  reportType: string;
  owner?: string;
  createdAt: string;
  status: BatchStatus;
  /** Kører: færdige og i alt. */
  done?: number;
  total?: number;
  /** Antal virksomheder i batchen ("142 virksomheder, PDF"); standard `total`. */
  count?: number;
  /** Leveringsformat. */
  format?: "PDF" | "Zip";
  /** Færdig med fejl: fejlene listes ved klik. */
  errors?: string[];
}

export interface ReportOrder {
  name: string;
  reportType: string;
  format: "PDF" | "Zip";
  when: "now" | "planned";
}

export interface ReportBatchesProps {
  batches: readonly ReportBatchVM[];
  /** Tekstlinks pr. række: "Hent PDF"/"Hent zip" (færdig), "Annuller" (planlagt/kører), "se N fejl" (fejl). */
  onAction?: (batch: ReportBatchVM, action: "download" | "cancel" | "errors") => void;
  /**
   * Bestillingsformularen over listen (28.4): antal virksomheder og listen, de kommer fra. Uden den
   * vises kun batchlisten.
   */
  order?: { count: number; listName?: string; defaultName?: string; onOrder?: (o: ReportOrder) => void };
}

function statusText(b: ReportBatchVM): string {
  if (b.status === "planned") return "Planlagt";
  if (b.status === "done") return "Færdig";
  if (b.status === "failed") return `Færdig med fejl${b.total ? `, ${formatNumber(b.done ?? b.total)} af ${formatNumber(b.total)}` : ""}`;
  const pct = b.total ? (100 * (b.done ?? 0)) / b.total : 0;
  return `Kører, ${formatPercent(pct, false)}${b.total ? `, ${formatNumber(b.done ?? 0)} af ${formatNumber(b.total)}` : ""}`;
}

function OrderForm({ order }: { order: NonNullable<ReportBatchesProps["order"]> }) {
  const [name, setName] = useState(order.defaultName ?? order.listName ?? "");
  const [reportType, setType] = useState<string>(REPORT_TYPES[0]);
  const [format, setFormat] = useState<"PDF" | "Zip">("PDF");
  const [when, setWhen] = useState<"now" | "planned">("now");
  return (
    <form
      className="lasso-batches__form"
      onSubmit={(e) => {
        e.preventDefault();
        order.onOrder?.({ name, reportType, format, when });
      }}
    >
      <div className="lasso-batches__fields">
        <label className="lasso-field">
          <span className="lasso-field__name">Batchnavn</span>
          <input className="lasso-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="lasso-field">
          <span className="lasso-field__name">Rapporttype</span>
          <select className="lasso-select" value={reportType} onChange={(e) => setType(e.target.value)}>
            {REPORT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <span className="lasso-field__hint">{REPORT_TYPES.join(", ")}</span>
        </label>
        <div className="lasso-field">
          <span className="lasso-field__name">Format</span>
          <Tabs level={3} compact ariaLabel="Format" items={[{ id: "PDF", label: "PDF" }, { id: "Zip", label: "Zip" }]} value={format} onChange={(v) => setFormat(v as "PDF" | "Zip")} />
        </div>
        <label className="lasso-field">
          <span className="lasso-field__name">Kør</span>
          <select className="lasso-select" value={when} onChange={(e) => setWhen(e.target.value as "now" | "planned")}>
            <option value="now">Nu</option>
            <option value="planned">Planlagt tidspunkt</option>
          </select>
          <span className="lasso-field__hint">eller planlagt tidspunkt</span>
        </label>
      </div>
      <div className="lasso-batches__submit">
        <span className="lasso-batches__info">
          {`${formatNumber(order.count)} virksomheder${order.listName ? ` fra listen "${order.listName}"` : ""}, rapporterne sendes pr. e-mail, når batchen er færdig.`}
        </span>
        <button type="submit" className="lasso-btn lasso-btn--primary" disabled={!order.onOrder}>
          {`Bestil ${formatNumber(order.count)} rapporter`}
        </button>
      </div>
    </form>
  );
}

/**
 * Rapportbestilling og batchstatus (katalog 28.4, node H7M-0, platform/reporting). Kort "Bestil rapporter"
 * med batchnavn, rapporttype (Revision, Finans, Reelle ejere, Revision udvidet), format PDF | Zip, kør nu
 * eller planlagt og primær "Bestil N rapporter"; derunder batchlisten, som deles i organisationen (ejer i
 * tooltip). Batch med "N virksomheder, format" under navnet; status er ren tekst: Planlagt (muted), Kører
 * med procent og tælling plus 4 px fremdriftsbjælke, Færdig, Færdig med fejl (udråbstegn). Handlinger er
 * koral tekstlinks ("Hent zip, se 2 fejl", "Hent PDF", "Annuller"); ingen ikonknapper. Mobil: batcherne som
 * kort med fremdriftsbjælke og "Bestil rapporter" i fuld bredde, der åbner formularen. Endpointet er ubekræftet.
 */
export function ReportBatches({ batches, onAction, order }: ReportBatchesProps) {
  const [formOpen, setFormOpen] = useState(false);
  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const link = (b: ReportBatchVM, action: "download" | "cancel" | "errors", label: string) =>
    onAction ? (
      <button type="button" className="lasso-link lasso-batches__action" onClick={() => onAction(b, action)}>
        {label}
      </button>
    ) : (
      <span className="lasso-batches__action">{label}</span>
    );
  const actions = (b: ReportBatchVM) => {
    const file = b.format === "Zip" ? "Hent zip" : "Hent PDF";
    if (b.status === "done") return link(b, "download", file);
    if (b.status === "failed") {
      const n = b.errors?.length ?? 0;
      return (
        <>
          {link(b, "download", file)}
          {n ? (
            <>
              {", "}
              {link(b, "errors", `se ${formatNumber(n)} fejl`)}
            </>
          ) : null}
        </>
      );
    }
    return link(b, "cancel", "Annuller");
  };
  const sub = (b: ReportBatchVM) => {
    const n = b.count ?? b.total;
    return [n ? `${formatNumber(n)} ${n === 1 ? "virksomhed" : "virksomheder"}` : null, b.format].filter(Boolean).join(", ");
  };
  const status = (b: ReportBatchVM) => (
    <>
      <span className={`lasso-batches__status lasso-batches__status--${b.status}`}>
        {b.status === "failed" ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        ) : null}
        {statusText(b)}
      </span>
      {b.status === "running" && b.total ? (
        <span className="lasso-batches__progress" role="progressbar" aria-valuemin={0} aria-valuemax={b.total} aria-valuenow={b.done ?? 0}>
          <span style={{ width: `${Math.min(100, (100 * (b.done ?? 0)) / b.total)}%` }} />
        </span>
      ) : null}
    </>
  );
  return (
    <div className="lasso-batches">
      {order ? (
        <Section title="Bestil rapporter" card className={`lasso-batches__order${formOpen ? " is-open" : ""}`}>
          <OrderForm order={order} />
        </Section>
      ) : null}
      <Section title="Rapportbestillinger" card className="lasso-batches__list">
        <div className="lasso-table-wrap lasso-batches__wide">
          <table className="lasso-table lasso-batches__table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Type</th>
                <th>Bestilt</th>
                <th>Status</th>
                <th className="lasso-num">Handling</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id}>
                  <td className="lasso-cell--name" title={b.owner ? `Bestilt af ${b.owner}` : undefined}>
                    <span className="lasso-table__name">{b.name}</span>
                    {sub(b) ? <span className="lasso-table__sub">{sub(b)}</span> : null}
                  </td>
                  <td>{b.reportType}</td>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>{status(b)}</td>
                  <td className="lasso-num">{actions(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobil: batcherne som kort med status, fremdriftsbjælke og handling. */}
        <ul className="lasso-batches__cards">
          {sorted.map((b) => (
            <li key={b.id} className="lasso-batches__card">
              <span className="lasso-table__name">{b.name}</span>
              <span className="lasso-table__sub">{[b.reportType, sub(b)].filter(Boolean).join(", ")}</span>
              {status(b)}
              <span className="lasso-batches__card-action">{actions(b)}</span>
            </li>
          ))}
        </ul>
        {order ? (
          <button type="button" className="lasso-btn lasso-btn--primary lasso-batches__mbtn" aria-expanded={formOpen} onClick={() => setFormOpen(!formOpen)}>
            Bestil rapporter
          </button>
        ) : null}
      </Section>
    </div>
  );
}
