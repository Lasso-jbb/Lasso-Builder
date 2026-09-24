import { useMemo, useState } from "react";
import {
  DEFAULT_TABLE_COLUMNS,
  formatAmount,
  formatNumber,
  TABLE_COLUMN_LABELS,
  type CompanyRowVM,
  type SearchResultVM,
  type TableColumn,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Card, Sparkline, StateBox, StatusBadge, stateForError } from "../primitives.js";

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
      return formatAmount(r.revenue);
    case "bruttofortjeneste":
      return formatAmount(r.grossProfit);
    case "resultat":
      return formatAmount(r.profit);
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

  if (!result) return <Card title={title}>{error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />}</Card>;
  if (result.rows.length === 0) return <Card title={title}><StateBox kind="empty" /></Card>;

  const toggle = (col: TableColumn) =>
    setSort((s) => (s?.col === col ? (s.dir === -1 ? { col, dir: 1 } : null) : { col, dir: NUMERIC.has(col) ? -1 : 1 }));

  return (
    <Card title={title} className="lasso-span-2">
      <div className="lasso-table-wrap">
        <table className="lasso-table lasso-table--fold">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} className={NUMERIC.has(c) ? "lasso-num" : undefined} scope="col">
                  {SORTABLE.has(c) ? (
                    <button onClick={() => toggle(c)} aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                      {TABLE_COLUMN_LABELS[c]}
                      <span aria-hidden="true">{sort?.col === c ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
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
                data-clickable={canDrillDown}
                onClick={canDrillDown ? () => onAction({ kind: "open-company", lassoId: r.lassoId, name: r.name }) : undefined}
              >
                {cols.map((c) => (
                  <td
                    key={c}
                    data-label={TABLE_COLUMN_LABELS[c]}
                    className={[NUMERIC.has(c) ? "lasso-num" : "", c === "navn" ? "lasso-cell--name" : "", c === "udvikling" ? "lasso-cell--trend" : "", c === "branche" ? "lasso-cell--wrap" : ""].join(" ").trim() || undefined}
                  >
                    {c === "navn" ? (
                      <span className="lasso-table__name">{r.name}</span>
                    ) : c === "status" ? (
                      <StatusBadge status={r.status} kind={r.statusKind} />
                    ) : c === "udvikling" ? (
                      <Sparkline values={r.trend ?? []} />
                    ) : (
                      cellText(r, c)
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
          Viser {rows.length}
          {result.total !== undefined && result.total > rows.length ? ` af ${formatNumber(result.total)}` : ""} virksomheder
        </span>
        {canDrillDown ? <span>Klik på en række for at se virksomheden</span> : null}
      </div>
    </Card>
  );
}
