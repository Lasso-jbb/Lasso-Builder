import { formatDate, formatNumber, formatPercent } from "@lasso/spec";

export type BatchStatus = "planned" | "running" | "done" | "failed";

export interface ReportBatchVM {
  id: string;
  name: string;
  /** En af de fire rapporttyper fra API'et, fx "Virksomhedsrapport". */
  reportType: string;
  owner?: string;
  createdAt: string;
  status: BatchStatus;
  /** Kører: færdige og i alt. */
  done?: number;
  total?: number;
  /** Færdig med fejl: fejlene listes ved klik. */
  errors?: string[];
}

export interface ReportBatchesProps {
  batches: readonly ReportBatchVM[];
  /** Ét tekstlink pr. række: "Hent" (færdig), "Annullér" (planlagt/kører), "Se fejl" (fejl). */
  onAction?: (batch: ReportBatchVM, action: "download" | "cancel" | "errors") => void;
}

function statusText(b: ReportBatchVM): string {
  if (b.status === "planned") return "Planlagt";
  if (b.status === "done") return "Færdig";
  if (b.status === "failed") return "Færdig med fejl";
  const pct = b.total ? (100 * (b.done ?? 0)) / b.total : 0;
  return `Kører, ${formatPercent(pct, false)}${b.total ? `, ${formatNumber(b.done ?? 0)} af ${formatNumber(b.total)}` : ""}`;
}

/**
 * Rapportbestilling og batchstatus (katalog 28.4, node H7M-0, platform/reporting). Batches deles i
 * organisationen, så listen viser alle brugeres bestillinger med ejer i tooltip. Status er ren tekst:
 * Planlagt (muted), Kører med procent og tælling plus 4 px fremdriftsbjælke, Færdig, Færdig med fejl
 * (udråbstegn-ikon). Handling er ét tekstlink pr. række; ingen ikonknapper. Endpointet er ubekræftet.
 */
export function ReportBatches({ batches, onAction }: ReportBatchesProps) {
  const sorted = [...batches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="lasso-batches">
      <h3 className="lasso-batches__title">Rapportbestillinger</h3>
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold lasso-batches__table">
            <thead>
              <tr>
                <th>Bestilling</th>
                <th>Type</th>
                <th>Bestilt</th>
                <th>Status</th>
                <th className="lasso-num">Handling</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => {
                const action = b.status === "done" ? (["download", "Hent"] as const) : b.status === "failed" ? (["errors", "Se fejl"] as const) : (["cancel", "Annullér"] as const);
                return (
                  <tr key={b.id}>
                    <td data-label="Bestilling" className="lasso-cell--name" title={b.owner ? `Bestilt af ${b.owner}` : undefined}>
                      <span className="lasso-table__name">{b.name}</span>
                    </td>
                    <td data-label="Type">{b.reportType}</td>
                    <td data-label="Bestilt">{formatDate(b.createdAt)}</td>
                    <td data-label="Status">
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
                    </td>
                    <td data-label="Handling" className="lasso-num">
                      {onAction ? (
                        <button type="button" className="lasso-link lasso-batches__action" onClick={() => onAction(b, action[0])}>
                          {action[1]}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
