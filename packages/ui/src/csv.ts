import { searchKey, TABLE_COLUMN_LABELS, DEFAULT_TABLE_COLUMNS, type Dataset, type ViewSpec } from "@lasso/spec";

function esc(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (semikolon, dansk Excel) af den første tabel i visningen. Rå tal, ikke formaterede. */
export function specToCsv(spec: ViewSpec, ds: Dataset): string | null {
  const table = spec.components.find((c) => c.type === "LassoCompanyTable");
  if (!table || table.type !== "LassoCompanyTable") return null;
  const result = ds.searches[searchKey(table.search)];
  if (!result) return null;
  const cols = (table.columns?.length ? table.columns : DEFAULT_TABLE_COLUMNS).filter((c) => c !== "udvikling");
  const header = ["Lasso-ID", ...cols.map((c) => TABLE_COLUMN_LABELS[c])];
  const lines = result.rows.map((r) => {
    const val: Record<string, string | number | null | undefined> = {
      navn: r.name,
      cvr: r.cvr,
      by: r.city,
      region: r.region,
      branche: r.industryText,
      status: r.status,
      ansatte: r.employees,
      omsaetning: r.revenue,
      bruttofortjeneste: r.grossProfit,
      resultat: r.profit,
    };
    return [r.lassoId, ...cols.map((c) => val[c])].map(esc).join(";");
  });
  return "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");
}
