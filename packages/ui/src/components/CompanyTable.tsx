import { useMemo, useState } from "react";
import {
  currencyUnit,
  DEFAULT_TABLE_COLUMNS,
  formatAmount,
  formatNumber,
  formatPercent,
  percentChange,
  TABLE_COLUMN_LABELS,
  type CompanyRowVM,
  type SearchResultVM,
  type TableColumn,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Missing, Section, Sparkline, stateForError } from "../primitives.js";

const NUMERIC: ReadonlySet<TableColumn> = new Set(["ansatte", "omsaetning", "bruttofortjeneste", "resultat", "udvikling"]);
const SORTABLE: ReadonlySet<TableColumn> = new Set(["navn", "by", "region", "branche", "ansatte", "omsaetning", "bruttofortjeneste", "resultat"]);

function sortValue(r: CompanyRowVM, c: TableColumn): string | number | null | undefined {
  switch (c) {
    case "navn":
      return r.name;
    case "by":
      return r.city;
    case "region":
      return r.region;
    case "branche":
      return r.industryText;
    case "ansatte":
      return r.employees;
    case "omsaetning":
      return r.revenue;
    case "bruttofortjeneste":
      return r.grossProfit;
    case "resultat":
      return r.profit;
    default:
      return undefined;
  }
}

export function cellText(r: CompanyRowVM, c: TableColumn): string {
  switch (c) {
    case "navn":
      return r.name;
    case "cvr":
      return r.cvr ?? "";
    case "by":
      return r.city ?? "";
    case "region":
      return r.region ?? "";
    case "branche":
      return r.industryText ?? "";
    case "status":
      return r.status ?? "";
    case "ansatte":
      return formatNumber(r.employees);
    case "omsaetning":
      return formatAmount(r.revenue, currencyUnit(r.currency));
    case "bruttofortjeneste":
      return formatAmount(r.grossProfit, currencyUnit(r.currency));
    case "resultat":
      return formatAmount(r.profit, currencyUnit(r.currency));
    case "udvikling":
      return "";
  }
}

export function CompanyTable({
  result,
  columns,
  title,
  error,
  onAction,
  canDrillDown,
}: {
  result?: SearchResultVM;
  columns?: readonly TableColumn[];
  title?: string;
  error?: string;
  onAction: (a: ViewAction) => void;
  canDrillDown: boolean;
}) {
  const cols = columns?.length ? columns : DEFAULT_TABLE_COLUMNS;
  const [sort, setSort] = useState<{ col: TableColumn; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    if (!result) return [];
    if (!sort) return result.rows;
    return [...result.rows].sort((a, b) => {
      const va = sortValue(a, sort.col);
      const vb = sortValue(b, sort.col);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb), "da") * sort.dir;
    });
  }, [result, sort]);

  if (!result) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }
  if (result.rows.length === 0) {
    return (
      <Section title={title} span="full">
        <DataState state="empty" reason="Ingen virksomheder matcher kriterierne. Prøv at fjerne et kriterium eller søge bredere." />
      </Section>
    );
  }

  const toggle = (col: TableColumn) =>
    setSort((s) => (s?.col === col ? (s.dir === -1 ? { col, dir: 1 } : null) : { col, dir: NUMERIC.has(col) ? -1 : 1 }));
  const showCvrUnderName = !cols.includes("cvr");
  const total = result.total ?? rows.length;

  return (
    <Section title={title} span="full">
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-table--fold">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} className={[NUMERIC.has(c) ? "lasso-num" : "", sort?.col === c ? "is-sorted" : ""].join(" ").trim() || undefined} scope="col">
                    {SORTABLE.has(c) ? (
                      <button type="button" onClick={() => toggle(c)} aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                        {c === "navn" ? "Virksomhed" : TABLE_COLUMN_LABELS[c]}
                        {sort?.col === c ? <span aria-hidden="true">{sort.dir === 1 ? "▴" : "▾"}</span> : null}
                      </button>
                    ) : (
                      TABLE_COLUMN_LABELS[c]
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.lassoId}
                  className={r.statusKind === "inactive" ? "is-ended" : undefined}
                  data-clickable={canDrillDown}
                  onClick={canDrillDown ? () => onAction({ kind: "open-company", lassoId: r.lassoId, name: r.name }) : undefined}
                >
                  {cols.map((c) => (
                    <td
                      key={c}
                      data-label={TABLE_COLUMN_LABELS[c]}
                      className={[NUMERIC.has(c) ? "lasso-num" : "", sort?.col === c ? "is-sorted" : "", c === "navn" ? "lasso-cell--name" : "", c === "udvikling" ? "lasso-cell--trend" : "", c === "branche" ? "lasso-cell--wrap" : "", c === "by" ? "lasso-cell--nowrap" : ""].join(" ").trim() || undefined}
                    >
                      {c === "navn" ? (
                        <>
                          <span className="lasso-table__name">{r.name}</span>
                          {showCvrUnderName && r.cvr ? <span className="lasso-table__sub">CVR {r.cvr}</span> : null}
                        </>
                      ) : c === "status" ? (
                        r.status ? <span className={`lasso-status lasso-status--${r.statusKind ?? "active"}`}>{r.status}</span> : <Missing />
                      ) : c === "udvikling" ? (
                        (r.trend?.length ?? 0) >= 2 ? <Trend values={r.trend!} /> : <Missing />
                      ) : NUMERIC.has(c) && sortValue(r, c) == null ? (
                        <span className="lasso-notreported">Ikke oplyst</span>
                      ) : (
                        cellText(r, c) || <Missing />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lasso-table-footer">
          <span>
            Viser 1–{rows.length} af {formatNumber(total)}
          </span>
          {canDrillDown ? <span>Klik på en række for at se virksomheden</span> : null}
        </div>
      </div>
    </Section>
  );
}

/** Udvikling i tabeller: sparkline i koral + procent (grøn/rød), katalog 15. */
function Trend({ values }: { values: readonly number[] }) {
  const pct = percentChange([values.at(-2), values.at(-1)]);
  return (
    <span className="lasso-trend">
      <Sparkline values={values} tone="accent" bare />
      <span className={`lasso-trend__pct ${pct !== null && pct < 0 ? "lasso-down" : "lasso-up"}`}>{formatPercent(pct)}</span>
    </span>
  );
}
